import { errorMessage } from "../../lib/client";
import type { Client } from "../../lib/client";
import { REQUEST_TIMEOUT_MS, rejectOnAbort } from "./refresh";

const LIVE_RETRY_BASE_MS = 1000;
const LIVE_RETRY_MAX_MS = 15_000;
const LIVE_RETRY_MAX_EXPONENT = 4;
const REFRESH_DEBOUNCE_MS = 300;

const sessionListEvents = new Set([
  "session.created",
  "session.renamed",
  "session.archived",
  "session.unarchived",
  "session.deleted",
  "session.forked",
  "session.moved",
  "session.viewed",
  "session.agent.selected",
  "session.model.selected",
  "session.execution.started",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.inbox.enqueued",
  "session.inbox.delivered",
  "session.shell.started",
  "session.shell.ended",
]);

interface LiveEvent {
  type: string;
}

const raceIterator = <T>(
  iterator: AsyncIterator<T>,
  cancelled: Promise<never>
): AsyncIterable<T> => ({
  [Symbol.asyncIterator]: () => ({
    next: () => Promise.race([iterator.next(), cancelled]),
  }),
});

const createRefreshScheduler = (
  signal: AbortSignal,
  refresh: (signal: AbortSignal) => Promise<void>
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    cancel: () => clearTimeout(timer),
    schedule: () => {
      if (timer) {
        return;
      }
      timer = setTimeout(() => {
        timer = undefined;
        if (!signal.aborted) {
          void refresh(signal);
        }
      }, REFRESH_DEBOUNCE_MS);
    },
  };
};

const createRetryWait = () => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let release: (() => void) | undefined;
  return {
    cancel: () => {
      clearTimeout(timer);
      release?.();
    },
    wait: (delay: number) => {
      const { promise, resolve } = Promise.withResolvers<undefined>();
      const finish = () => resolve(undefined);
      release = finish;
      timer = setTimeout(finish, delay);
      return promise;
    },
  };
};

interface LiveSession {
  attempts: { count: number };
  client: Client;
  refresh: (signal: AbortSignal) => Promise<void>;
  retry: ReturnType<typeof createRetryWait>;
  scheduler: ReturnType<typeof createRefreshScheduler>;
  setStreamError: (message: string | undefined) => void;
  signal: AbortSignal;
}

const handleLiveEvent = (live: LiveSession, event: LiveEvent) => {
  live.setStreamError(undefined);
  live.attempts.count = 0;
  if (
    event.type === "server.connected" ||
    event.type === "location.shutdown" ||
    sessionListEvents.has(event.type)
  ) {
    live.scheduler.schedule();
  }
};

const consumeLiveEvents = async (live: LiveSession) => {
  const { signal } = live;
  const attempt = new AbortController();
  const cancelAttempt = () => attempt.abort();
  signal.addEventListener("abort", cancelAttempt, { once: true });
  const state = { timedOut: false };
  const cancelled = rejectOnAbort(
    attempt.signal,
    () =>
      new Error(
        state.timedOut
          ? "The live connection did not respond within 15 seconds. Check your server connection."
          : "Live connection cancelled"
      )
  );
  if (signal.aborted) {
    cancelAttempt();
  }
  const initialTimeout = setTimeout(() => {
    state.timedOut = true;
    attempt.abort();
  }, REQUEST_TIMEOUT_MS);
  const eventStream = live.client.event.subscribe({ signal: attempt.signal });
  const iterator = eventStream[Symbol.asyncIterator]();
  try {
    for await (const event of raceIterator(iterator, cancelled.promise)) {
      if (signal.aborted) {
        break;
      }
      clearTimeout(initialTimeout);
      handleLiveEvent(live, event);
    }
  } finally {
    clearTimeout(initialTimeout);
    signal.removeEventListener("abort", cancelAttempt);
    attempt.abort();
    cancelled.dispose();
    void iterator.return?.().catch(() => {
      // Closing the iterator is best effort.
    });
  }
  if (!signal.aborted) {
    throw new Error("The live connection closed");
  }
};

const keepLive = async (live: LiveSession): Promise<void> => {
  const { signal } = live;
  if (signal.aborted) {
    return;
  }
  try {
    await consumeLiveEvents(live);
  } catch (error_) {
    if (signal.aborted) {
      return;
    }
    live.setStreamError(`Live updates unavailable: ${errorMessage(error_)}`);
    const retryDelay = Math.min(
      LIVE_RETRY_BASE_MS *
        2 ** Math.min(live.attempts.count, LIVE_RETRY_MAX_EXPONENT),
      LIVE_RETRY_MAX_MS
    );
    live.attempts.count += 1;
    await live.retry.wait(retryDelay);
    if (!signal.aborted) {
      await live.refresh(signal);
    }
  }
  await keepLive(live);
};

interface LiveUpdatesOptions {
  client: Client;
  refresh: (signal: AbortSignal) => Promise<void>;
  setStreamError: (message: string | undefined) => void;
}

export const startLiveUpdates = ({
  client,
  refresh,
  setStreamError,
}: LiveUpdatesOptions): (() => void) => {
  const controller = new AbortController();
  const live: LiveSession = {
    attempts: { count: 0 },
    client,
    refresh,
    retry: createRetryWait(),
    scheduler: createRefreshScheduler(controller.signal, refresh),
    setStreamError,
    signal: controller.signal,
  };
  void refresh(controller.signal);
  keepLive(live).catch((error_) => {
    if (!controller.signal.aborted) {
      setStreamError(errorMessage(error_));
    }
  });
  return () => {
    controller.abort();
    live.scheduler.cancel();
    live.retry.cancel();
  };
};
