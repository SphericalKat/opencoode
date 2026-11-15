import type {
  OpenCodeEvent,
  SessionActive,
  SessionInfo,
  SessionStatus,
} from "@opencode/client";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useEffect } from "react";
import type { RefObject } from "react";

import { noop } from "../../lib/async";
import { projectLiveEvents } from "../../lib/chat";
import type { ChatBackend, ChatBackendSnapshot } from "../../lib/chat-backend";
import { queryKeys } from "../../lib/query-keys";
import type { Scope } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import { createStreamBatch } from "../../lib/stream-batch";
import { startLive } from "./session-sync";
import type { LiveContext, StatusUpdate } from "./session-sync";
import type { Alive, SyncScope } from "./types";
import type { SessionData } from "./use-session-data";
import type { MessageState } from "./use-session-state";

const REFRESH_DEBOUNCE_MS = 300;
const SCOPE_DEBOUNCE_MS = 200;

interface UseLiveSessionOptions {
  alive: Alive;
  backend: ChatBackend;
  connectionFailures: RefObject<number>;
  data: SessionData;
  foreground: boolean;
  reportConnectionFailure: (reason: unknown) => void;
  sessionID: string;
  showError: (reason: unknown) => void;
  state: MessageState;
  visible: boolean;
}

// Writes a live value into the cache. A fetch that is still running would
// overwrite it with an older answer, so cancel that fetch first.
const writeCache = <T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  update: (current: T | undefined) => T | undefined
) => {
  void queryClient.cancelQueries({ exact: true, queryKey }, { revert: false });
  queryClient.setQueryData<T>(queryKey, (current) => update(current));
};

const scopeKeys = (
  scope: Scope,
  sessionID: string,
  syncScope: SyncScope,
  directory: string | undefined
): QueryKey[] => {
  switch (syncScope) {
    case "metadata": {
      return [queryKeys.session.detail(scope, sessionID)];
    }
    case "history": {
      return [queryKeys.session.messages(scope, sessionID)];
    }
    case "inbox": {
      return [queryKeys.session.inbox(scope, sessionID)];
    }
    default: {
      return [
        queryKeys.session.forms(scope, sessionID),
        queryKeys.session.permissions(scope, sessionID),
        ...(directory ? [queryKeys.dir.forms(scope, directory)] : []),
      ];
    }
  }
};

export const useLiveSession = ({
  alive,
  backend,
  connectionFailures,
  data,
  foreground,
  reportConnectionFailure,
  sessionID,
  showError,
  state,
  visible,
}: UseLiveSessionOptions) => {
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const client = backend.core;
  const {
    setMessages,
    setStreamFailure,
    setStreamStatus,
    setActivityNotice,
    setBackendWaiting,
    flushStreamRef,
    liveMessagesRef,
    resetHistory,
  } = state;
  const { retryCatalog } = data;
  useEffect(() => {
    if (!foreground || !visible) {
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const live: LiveContext["live"] = { attempts: 0 };
    const scopeTimers = new Map<SyncScope, ReturnType<typeof setTimeout>>();
    const detailKey = queryKeys.session.detail(scope, sessionID);
    const statusKey = queryKeys.session.status(scope, sessionID);
    const activeKey = queryKeys.sessions.active(scope);
    const sessionDirectory = () =>
      queryClient.getQueryData<SessionInfo>(detailKey)?.location.directory;
    const setSession = (update: (session: SessionInfo) => SessionInfo) =>
      writeCache<SessionInfo>(queryClient, detailKey, (current) =>
        current ? update(current) : current
      );
    const setSessionStatus = (update: StatusUpdate) =>
      writeCache<SessionStatus | null>(queryClient, statusKey, (current) =>
        typeof update === "function" ? update(current ?? null) : update
      );
    const setActive = (running: boolean) =>
      writeCache<Record<string, SessionActive>>(
        queryClient,
        activeKey,
        (current) => {
          const others = Object.entries(current ?? {}).filter(
            ([id]) => id !== sessionID
          );
          return Object.fromEntries(
            running ? [...others, [sessionID, { type: "running" }]] : others
          );
        }
      );
    const applyEvents = (events: OpenCodeEvent[]) => {
      setMessages((current) => {
        const next = projectLiveEvents(current, events, sessionID);
        if (next === current) {
          return current;
        }
        const touched = new Set<string>();
        for (const event of events) {
          const eventData = event.data as Record<string, unknown>;
          if (typeof eventData.assistantMessageID === "string") {
            touched.add(eventData.assistantMessageID);
          }
        }
        for (const message of next) {
          if (message.type === "assistant" && touched.has(message.id)) {
            liveMessagesRef.current.set(message.id, message);
          }
        }
        return next;
      });
    };
    const stream = createStreamBatch<OpenCodeEvent>(applyEvents, {
      frame: true,
    });
    const snapshots = createStreamBatch<ChatBackendSnapshot>(
      (batch) => {
        const snapshot = batch.at(-1);
        if (!snapshot || controller.signal.aborted || !alive.current) {
          return;
        }
        setStreamStatus("Live");
        liveMessagesRef.current.clear();
        queryClient.setQueryData(detailKey, snapshot.session);
        setMessages(snapshot.messages);
        setActive(snapshot.active);
        setSessionStatus(
          snapshot.status ??
            (snapshot.active ? { type: "busy" } : { type: "idle" })
        );
        setActivityNotice(snapshot.activityNotice ?? backend.activityNotice);
        setBackendWaiting(snapshot.waiting);
        setStreamFailure(null);
      },
      { frame: true }
    );
    const flushPending = () => {
      stream.flush();
      snapshots.flush();
    };
    flushStreamRef.current = flushPending;
    const refresh = () => {
      const directory = sessionDirectory();
      return Promise.all(
        [
          queryKeys.session.all(scope, sessionID),
          activeKey,
          ...(directory ? [queryKeys.dir.forms(scope, directory)] : []),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
      );
    };
    const scheduleRefresh = () => {
      if (timer) {
        return;
      }
      timer = setTimeout(() => {
        timer = undefined;
        void refresh();
      }, REFRESH_DEBOUNCE_MS);
    };
    const scheduleScope = (syncScope: SyncScope) => {
      if (scopeTimers.has(syncScope)) {
        return;
      }
      scopeTimers.set(
        syncScope,
        setTimeout(() => {
          scopeTimers.delete(syncScope);
          for (const queryKey of scopeKeys(
            scope,
            sessionID,
            syncScope,
            sessionDirectory()
          )) {
            void queryClient.invalidateQueries({ queryKey });
          }
        }, SCOPE_DEBOUNCE_MS)
      );
    };
    void startLive({
      applyEvents,
      backend,
      client,
      connectionFailures,
      flushPending,
      live,
      refresh,
      refreshCatalog: retryCatalog,
      reportConnectionFailure,
      resetHistory,
      scheduleRefresh,
      scheduleScope,
      sessionDirectory,
      sessionID,
      setActive,
      setSession,
      setSessionStatus,
      setStreamFailure,
      setStreamStatus,
      signal: controller.signal,
      snapshots,
      stream,
    }).catch(showError);
    return () => {
      controller.abort();
      stream.clear();
      snapshots.clear();
      if (flushStreamRef.current === flushPending) {
        flushStreamRef.current = noop;
      }
      clearTimeout(timer);
      clearTimeout(live.retryTimer);
      for (const scopeTimer of scopeTimers.values()) {
        clearTimeout(scopeTimer);
      }
      live.retryResolve?.();
    };
  }, [
    alive,
    backend,
    client,
    connectionFailures,
    flushStreamRef,
    foreground,
    liveMessagesRef,
    queryClient,
    reportConnectionFailure,
    resetHistory,
    retryCatalog,
    scope,
    sessionID,
    setActivityNotice,
    setBackendWaiting,
    setMessages,
    setStreamFailure,
    setStreamStatus,
    showError,
    visible,
  ]);
};
