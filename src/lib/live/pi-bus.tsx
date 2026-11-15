import type { SessionActive, SessionStatus } from "@opencode/client";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef } from "react";

import { settle } from "../async";
import type { ChatBackend, ChatBackendSnapshot } from "../chat-backend";
import { errorMessage, isConnectionUnauthorized } from "../client";
import { useLiveActions } from "../live-store";
import { writeMessagesSnapshot } from "../queries/messages";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";
import { createStreamBatch } from "../stream-batch";

type LiveActions = ReturnType<typeof useLiveActions>;

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 15_000;
// The second failure in a row reports a lost connection.
const LOST_AFTER_FAILURES = 2;
const FAILURE_NOTICE_AFTER_ATTEMPTS = 1;

interface PiBusProps {
  backend: ChatBackend;
  foreground: boolean;
  onConnectionLost: (error: unknown) => void;
  scope: Scope;
}

// A fetch that is still running would overwrite a live value with an older
// answer, so cancel that fetch before the write.
const writeCache = <T,>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  value: T
) => {
  void queryClient.cancelQueries({ exact: true, queryKey }, { revert: false });
  queryClient.setQueryData<T>(queryKey, value);
};

const writeSnapshot = (
  queryClient: QueryClient,
  scope: Scope,
  backend: ChatBackend,
  snapshot: ChatBackendSnapshot,
  live: LiveActions
) => {
  const sessionID = snapshot.session.id;
  const messagesKey = queryKeys.session.messages(scope, sessionID);
  void queryClient.cancelQueries(
    { exact: true, queryKey: messagesKey },
    { revert: false }
  );
  writeCache(
    queryClient,
    queryKeys.session.detail(scope, sessionID),
    snapshot.session
  );
  writeMessagesSnapshot(queryClient, scope, sessionID, snapshot.messages);
  writeCache<Record<string, SessionActive>>(
    queryClient,
    queryKeys.sessions.active(scope),
    snapshot.active ? { [sessionID]: { type: "running" } } : {}
  );
  writeCache<SessionStatus | null>(
    queryClient,
    queryKeys.session.status(scope, sessionID),
    snapshot.status ?? (snapshot.active ? { type: "busy" } : { type: "idle" })
  );
  live.setStatus("Live");
  live.setFailure(null);
  live.setSessionNotice(sessionID, {
    activityNotice: snapshot.activityNotice ?? backend.activityNotice,
    waiting: snapshot.waiting,
  });
};

const waitFor = (delay: number, signal: AbortSignal) => {
  const { promise, resolve } = Promise.withResolvers<null>();
  const finish = () => {
    clearTimeout(timer);
    signal.removeEventListener("abort", finish);
    resolve(null);
  };
  const timer = setTimeout(finish, delay);
  signal.addEventListener("abort", finish, { once: true });
  return promise;
};

interface LoopContext {
  attempts: number;
  backend: ChatBackend;
  failures: number;
  live: LiveActions;
  onConnectionLost: (error: unknown) => void;
  signal: AbortSignal;
  snapshots: ReturnType<typeof createStreamBatch<ChatBackendSnapshot>>;
}

const consume = async (ctx: LoopContext) => {
  const { backend, signal } = ctx;
  if (!backend.subscribe) {
    throw new Error("This connection does not provide live updates");
  }
  ctx.live.setStatus(ctx.attempts ? "Reconnecting" : "Connecting");
  for await (const snapshot of backend.subscribe({ signal })) {
    if (signal.aborted) {
      return;
    }
    ctx.attempts = 0;
    ctx.failures = 0;
    ctx.snapshots.push(snapshot);
  }
  if (!signal.aborted) {
    throw new Error("The live connection closed");
  }
};

const recover = async (reason: unknown, ctx: LoopContext) => {
  ctx.snapshots.flush();
  if (ctx.signal.aborted) {
    return;
  }
  ctx.live.setStatus("Reconnecting");
  ctx.failures += 1;
  if (isConnectionUnauthorized(reason) || ctx.failures >= LOST_AFTER_FAILURES) {
    ctx.onConnectionLost(reason);
  }
  if (ctx.attempts > FAILURE_NOTICE_AFTER_ATTEMPTS) {
    ctx.live.setFailure(errorMessage(reason));
  }
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** ctx.attempts, BACKOFF_MAX_MS);
  ctx.attempts += 1;
  await waitFor(delay, ctx.signal);
  if (!ctx.signal.aborted) {
    ctx.live.setFailure(null);
  }
};

const runLoop = async (ctx: LoopContext): Promise<void> => {
  if (ctx.signal.aborted) {
    return;
  }
  await settle(
    () => consume(ctx),
    (reason) => recover(reason, ctx)
  );
  await runLoop(ctx);
};

// Runs the Pi snapshot stream for one server. Pi sends whole snapshots, so
// each batch writes the last snapshot and does not use the event table.
export const PiBus = ({
  backend,
  foreground,
  onConnectionLost,
  scope,
}: PiBusProps) => {
  const queryClient = useQueryClient();
  const live = useLiveActions();
  const connectionLost = useRef(onConnectionLost);
  useLayoutEffect(() => {
    connectionLost.current = onConnectionLost;
  });
  useEffect(() => {
    if (!foreground) {
      return;
    }
    const controller = new AbortController();
    const snapshots = createStreamBatch<ChatBackendSnapshot>(
      (batch) => {
        const snapshot = batch.at(-1);
        if (snapshot && !controller.signal.aborted) {
          writeSnapshot(queryClient, scope, backend, snapshot, live);
        }
      },
      { frame: true }
    );
    void runLoop({
      attempts: 0,
      backend,
      failures: 0,
      live,
      onConnectionLost: (reason) => connectionLost.current(reason),
      signal: controller.signal,
      snapshots,
    });
    return () => {
      controller.abort();
      snapshots.clear();
    };
  }, [backend, foreground, live, queryClient, scope]);
  return null;
};
