import type { SessionInfo } from "@opencode/client";
import type { Dispatch, SetStateAction } from "react";

import { errorMessage } from "../../lib/client";
import type { Client } from "../../lib/client";

export const SESSION_PAGE_SIZE = 40;
export const REQUEST_TIMEOUT_MS = 15_000;

export const rejectOnAbort = (
  signal: AbortSignal,
  createError: () => Error
) => {
  const { promise, reject } = Promise.withResolvers<never>();
  const onAbort = () => reject(createError());
  signal.addEventListener("abort", onAbort, { once: true });
  return {
    dispose: () => signal.removeEventListener("abort", onAbort),
    promise,
  };
};

export const startRefreshRequest = (external?: AbortSignal) => {
  const controller = new AbortController();
  const state = { timedOut: false };
  const cancelled = rejectOnAbort(
    controller.signal,
    () =>
      new Error(
        state.timedOut
          ? "The server did not respond within 15 seconds. Check your connection, then retry."
          : "Session refresh cancelled"
      )
  );
  const cancel = () => controller.abort();
  if (external?.aborted) {
    cancel();
  } else {
    external?.addEventListener("abort", cancel, { once: true });
  }
  const timeout = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  return {
    cancelled: cancelled.promise,
    controller,
    finish: () => {
      clearTimeout(timeout);
      external?.removeEventListener("abort", cancel);
      cancelled.dispose();
    },
    state,
  };
};

type RefreshRequest = ReturnType<typeof startRefreshRequest>;

export interface PageQuery {
  archived: boolean;
  cursor: string | undefined;
  directory: string | undefined;
  limit: number;
  search: string;
}

export const fetchSessionPage = async (
  client: Client,
  query: PageQuery,
  request: RefreshRequest
) => {
  const { signal } = request.controller;
  try {
    const [page, running] = await Promise.race([
      Promise.allSettled([
        client.session.list(
          {
            archived: query.archived,
            cursor: query.cursor,
            directory: query.directory,
            limit: query.limit,
            order: "desc",
            search: query.search.trim() || undefined,
          },
          { signal }
        ),
        client.session.active({ signal }),
      ]),
      request.cancelled,
    ]);
    return { ok: true as const, page, running };
  } catch (error_) {
    return { error: error_, ok: false as const };
  }
};

type PageFetch = Awaited<ReturnType<typeof fetchSessionPage>>;

export interface RefreshSink {
  loadedCount: { current: number };
  setActive: Dispatch<SetStateAction<Set<string>>>;
  setListError: Dispatch<SetStateAction<string | undefined>>;
  setListUnavailable: Dispatch<SetStateAction<boolean>>;
  setNextCursor: Dispatch<SetStateAction<string | undefined>>;
  setSessions: Dispatch<SetStateAction<SessionInfo[]>>;
  setStatusError: Dispatch<SetStateAction<string | undefined>>;
}

export interface RefreshOutcome {
  aborted: boolean;
  cursor: string | undefined;
  timedOut: boolean;
}

const mergeSessions = (
  previous: SessionInfo[],
  incoming: SessionInfo[]
): SessionInfo[] => [
  ...new Map(
    [...previous, ...incoming].map((item) => [item.id, item])
  ).values(),
];

const reportListFailure = (error_: unknown, sink: RefreshSink) => {
  sink.setListUnavailable(true);
  sink.setListError(errorMessage(error_));
};

export const applyRefreshResult = (
  result: PageFetch,
  outcome: RefreshOutcome,
  sink: RefreshSink
) => {
  if (!result.ok) {
    if (outcome.timedOut || !outcome.aborted) {
      reportListFailure(result.error, sink);
    }
    return;
  }
  if (outcome.aborted) {
    return;
  }
  const { page, running } = result;
  if (page.status === "rejected") {
    reportListFailure(page.reason, sink);
    return;
  }
  sink.setListUnavailable(false);
  sink.setListError(undefined);
  sink.setSessions((previous) => {
    const next = outcome.cursor
      ? mergeSessions(previous, page.value.data)
      : page.value.data;
    sink.loadedCount.current = Math.max(SESSION_PAGE_SIZE, next.length);
    return next;
  });
  sink.setNextCursor(page.value.cursor.next ?? undefined);
  if (running.status === "fulfilled") {
    sink.setActive(new Set(Object.keys(running.value)));
    sink.setStatusError(undefined);
  } else {
    sink.setActive(new Set());
    sink.setStatusError(
      `Active status unavailable: ${errorMessage(running.reason)}`
    );
  }
};
