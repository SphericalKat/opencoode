import type {
  OpenCodeEvent,
  SessionActive,
  SessionInfo,
  SessionStatus,
} from "@opencode/client";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { isAssistantProgress } from "../chat";
import type { ChatBackend } from "../chat-backend";
import {
  applyLiveMessageEvents,
  refreshMessagesHead,
  resetMessages,
} from "../queries/messages";
import type { SessionPage } from "../queries/sessions";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";
import { createStreamBatch } from "../stream-batch";
import { createKeyedDebounce } from "./debounce";
import { isDeltaEvent, planEvent, sessionIDOf } from "./opencode-event-table";
import type { CacheOperation, DirTail } from "./opencode-event-table";

const INVALIDATE_DEBOUNCE_MS = 250;

interface RouterOptions {
  core: ChatBackend["core"];
  queryClient: QueryClient;
  scope: Scope;
}

const isDirQuery = (key: readonly unknown[], scope: Scope) =>
  key[0] === scope && key[1] === "dir";

// A live value must not be overwritten by a fetch that is still running, so
// cancel that fetch before the write.
const writeCache = <T>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  update: (current: T | undefined) => T | undefined
) => {
  void queryClient.cancelQueries({ exact: true, queryKey }, { revert: false });
  queryClient.setQueryData<T>(queryKey, (current) => update(current));
};

export const createOpenCodeRouter = ({
  core,
  queryClient,
  scope,
}: RouterOptions) => {
  const debounce = createKeyedDebounce(INVALIDATE_DEBOUNCE_MS);

  const batch = createStreamBatch<OpenCodeEvent>(
    (events) => {
      const bySession = new Map<string, OpenCodeEvent[]>();
      for (const event of events) {
        const sessionID = sessionIDOf(event);
        if (sessionID) {
          bySession.set(sessionID, [
            ...(bySession.get(sessionID) ?? []),
            event,
          ]);
        }
      }
      for (const [sessionID, group] of bySession) {
        applyLiveMessageEvents(queryClient, scope, sessionID, group);
      }
    },
    { frame: true }
  );

  const invalidate = (queryKey: readonly unknown[]) =>
    debounce.schedule(JSON.stringify(queryKey), () => {
      void queryClient.invalidateQueries({ queryKey });
    });

  const invalidateDirs = (tail: DirTail) =>
    debounce.schedule(`dirs:${tail}`, () => {
      void queryClient.invalidateQueries({
        predicate: (query) =>
          isDirQuery(query.queryKey, scope) && query.queryKey[3] === tail,
      });
    });

  const invalidateChildren = (parentID: string | undefined) => {
    if (parentID) {
      invalidate(queryKeys.sessions.children(scope, parentID));
      return;
    }
    debounce.schedule("children", () => {
      void queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          queryKey[0] === scope &&
          queryKey[1] === "sessions" &&
          queryKey[2] === "children",
      });
    });
  };

  const refreshHead = (sessionID: string) =>
    debounce.schedule(`head:${sessionID}`, () => {
      refreshMessagesHead(queryClient, scope, core, sessionID).catch(() => {
        // The next event or the reconnect refreshes the transcript again.
      });
    });

  const setActive = (sessionID: string, running: boolean) => {
    const queryKey = queryKeys.sessions.active(scope);
    writeCache<Record<string, SessionActive>>(
      queryClient,
      queryKey,
      (current) => {
        const others = Object.entries(current ?? {}).filter(
          ([id]) => id !== sessionID
        );
        return Object.fromEntries(
          running ? [...others, [sessionID, { type: "running" }]] : others
        );
      }
    );
  };

  const setStatus = (
    sessionID: string,
    update: (current: SessionStatus | null) => SessionStatus | null
  ) =>
    writeCache<SessionStatus | null>(
      queryClient,
      queryKeys.session.status(scope, sessionID),
      (current) => update(current ?? null)
    );

  const patchChild = (sessionID: string, patch: Partial<SessionInfo>) => {
    const queries = queryClient.getQueryCache().findAll({
      predicate: ({ queryKey }) =>
        queryKey[0] === scope &&
        queryKey[1] === "sessions" &&
        queryKey[2] === "children",
    });
    for (const { queryKey } of queries) {
      queryClient.setQueryData<InfiniteData<SessionPage, string | undefined>>(
        queryKey,
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              data: page.data.map((item) =>
                item.id === sessionID ? { ...item, ...patch } : item
              ),
            })),
          }
      );
    }
  };

  // Refreshes every open session except its message pages, which only get
  // a head refresh.
  const refreshOpenSessions = () => {
    const cached = queryClient.getQueryCache().findAll({
      predicate: ({ queryKey }) =>
        queryKey[0] === scope && queryKey[1] === "session",
    });
    for (const { queryKey } of cached) {
      if (queryKey[3] === "messages") {
        refreshHead(String(queryKey[2]));
      } else {
        invalidate(queryKey);
      }
    }
  };

  const run = (operation: CacheOperation) => {
    switch (operation.kind) {
      case "invalidate": {
        invalidate(operation.queryKey);
        break;
      }
      case "invalidateDirs": {
        invalidateDirs(operation.tail);
        break;
      }
      case "invalidateChildren": {
        invalidateChildren(operation.parentID);
        break;
      }
      case "refreshHead": {
        refreshHead(operation.sessionID);
        break;
      }
      case "resetMessages": {
        void resetMessages(queryClient, scope, operation.sessionID);
        break;
      }
      case "setActive": {
        setActive(operation.sessionID, operation.running);
        break;
      }
      case "setStatus": {
        setStatus(operation.sessionID, () => operation.status);
        break;
      }
      case "clearRetry": {
        setStatus(operation.sessionID, (current) =>
          current?.type === "retry" ? { type: "busy" } : current
        );
        break;
      }
      case "patchChild": {
        patchChild(operation.sessionID, operation.patch);
        break;
      }
      case "refreshOpenSessions": {
        refreshOpenSessions();
        break;
      }
      case "patchUsage": {
        writeCache<SessionInfo>(
          queryClient,
          queryKeys.session.detail(scope, operation.sessionID),
          (current) =>
            current
              ? ({
                  ...current,
                  cost: operation.cost,
                  tokens: operation.tokens,
                } as SessionInfo)
              : current
        );
        break;
      }
      default: {
        break;
      }
    }
  };

  // The stream restarted, so cached live state may be old. Keep only the
  // first page of each open transcript, forget transient statuses, then
  // refetch everything that is in use.
  const reconnected = () => {
    batch.flush();
    const cached = queryClient.getQueryCache().findAll({
      predicate: ({ queryKey }) =>
        queryKey[0] === scope && queryKey[1] === "session",
    });
    for (const { queryKey } of cached) {
      const sessionID = String(queryKey[2]);
      if (queryKey[3] === "messages") {
        void resetMessages(queryClient, scope, sessionID);
      } else if (queryKey[3] === "status") {
        queryClient.setQueryData(queryKey, null);
      }
    }
    void queryClient.invalidateQueries({ queryKey: [scope] });
  };

  const handle = (event: OpenCodeEvent) => {
    if (event.type === "server.connected") {
      reconnected();
      return;
    }
    if (event.type === "session.compaction.delta") {
      return;
    }
    const sessionID = sessionIDOf(event);
    if (sessionID && isAssistantProgress(event)) {
      run({ kind: "clearRetry", sessionID });
    }
    if (isDeltaEvent(event)) {
      batch.push(event);
      return;
    }
    batch.flush();
    if (sessionID && "assistantMessageID" in (event.data as object)) {
      applyLiveMessageEvents(queryClient, scope, sessionID, [event]);
      return;
    }
    for (const operation of planEvent(event, scope)) {
      run(operation);
    }
  };

  return {
    dispose() {
      batch.clear();
      debounce.clear();
    },
    flush: batch.flush,
    handle,
  };
};
