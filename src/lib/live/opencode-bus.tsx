import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { settle } from "../async";
import { makeOpenCodeChatBackend } from "../chat-backend";
import { errorMessage, isConnectionUnauthorized } from "../client";
import type { Client } from "../client";
import { useLiveActions } from "../live-store";
import type { Scope } from "../query-keys";
import { retryDelay } from "./backoff";
import { createOpenCodeRouter } from "./opencode-router";

// The second failure in a row is a lost connection. A 401 is lost at once.
const LOST_AFTER_FAILURES = 2;
// The first two retries stay quiet. Later ones show the failure message.
const QUIET_ATTEMPTS = 1;

interface OpenCodeBusProps {
  client: Client;
  onConnectionLost?: (error: unknown) => void;
  scope: Scope;
}

const waitForRetry = (delay: number, signal: AbortSignal) => {
  const { promise, resolve } = Promise.withResolvers<null>();
  const timer = setTimeout(() => resolve(null), delay);
  signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
      resolve(null);
    },
    { once: true }
  );
  return promise;
};

type LiveActions = ReturnType<typeof useLiveActions>;

interface LoopOptions {
  actions: LiveActions;
  client: Client;
  lost: { current: ((error: unknown) => void) | undefined };
  queryClient: QueryClient;
  scope: Scope;
  signal: AbortSignal;
}

interface LoopState {
  attempts: number;
  failures: number;
}

const connectOnce = async (
  options: LoopOptions,
  router: ReturnType<typeof createOpenCodeRouter>,
  state: LoopState
) => {
  const { actions, client, signal } = options;
  actions.setStatus(state.attempts ? "Reconnecting" : "Connecting");
  for await (const event of client.event.subscribe({ signal })) {
    if (signal.aborted) {
      break;
    }
    state.attempts = 0;
    state.failures = 0;
    actions.setStatus("Live");
    actions.setFailure(null);
    actions.setStreamError(null);
    router.handle(event);
  }
  if (!signal.aborted) {
    throw new Error("The live connection closed");
  }
};

const recoverFromFailure = async (
  reason: unknown,
  { actions, lost, signal }: LoopOptions,
  router: ReturnType<typeof createOpenCodeRouter>,
  state: LoopState
) => {
  router.flush();
  if (signal.aborted) {
    return;
  }
  actions.setStatus("Reconnecting");
  actions.setStreamError(errorMessage(reason));
  state.failures += 1;
  if (
    isConnectionUnauthorized(reason) ||
    state.failures >= LOST_AFTER_FAILURES
  ) {
    lost.current?.(reason);
  }
  if (state.attempts > QUIET_ATTEMPTS) {
    actions.setFailure(errorMessage(reason));
  }
  const delay = retryDelay(state.attempts);
  state.attempts += 1;
  await waitForRetry(delay, signal);
  if (!signal.aborted) {
    actions.setFailure(null);
  }
};

const runLoop = async (
  options: LoopOptions,
  router: ReturnType<typeof createOpenCodeRouter>,
  state: LoopState
): Promise<void> => {
  if (options.signal.aborted) {
    return;
  }
  await settle(
    () => connectOnce(options, router, state),
    (reason) => recoverFromFailure(reason, options, router, state)
  );
  await runLoop(options, router, state);
};

const startLoop = async (options: LoopOptions) => {
  const router = createOpenCodeRouter({
    core: makeOpenCodeChatBackend(options.client).core,
    queryClient: options.queryClient,
    scope: options.scope,
  });
  await runLoop(options, router, { attempts: 0, failures: 0 });
  router.dispose();
};

// One event stream for each server. It writes events into the query cache and
// reports the stream state to the live store.
export const OpenCodeBus = ({
  client,
  onConnectionLost,
  scope,
}: OpenCodeBusProps) => {
  const queryClient = useQueryClient();
  const actions = useLiveActions();
  const lost = useRef(onConnectionLost);
  useEffect(() => {
    lost.current = onConnectionLost;
  });
  useEffect(() => {
    const controller = new AbortController();
    void startLoop({
      actions,
      client,
      lost,
      queryClient,
      scope,
      signal: controller.signal,
    });
    return () => controller.abort();
  }, [actions, client, queryClient, scope]);
  return null;
};
