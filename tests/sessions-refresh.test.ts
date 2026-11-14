import assert from "node:assert/strict";
import test from "node:test";

import type { SessionInfo } from "@opencode/client";

import { applyRefreshResult } from "../src/screens/sessions/refresh";
import type { RefreshSink } from "../src/screens/sessions/refresh";

type PageFetch = Parameters<typeof applyRefreshResult>[0];

const PAGE_LIMIT = 40;

const session = (id: string): SessionInfo => ({
  cost: 0,
  id,
  location: { directory: "/work/app" },
  projectID: "prj_app",
  time: { created: 1, updated: 1 },
  tokens: { cache: { read: 0, write: 0 }, input: 0, output: 0, reasoning: 0 },
});

const sessionPage = (count: number): SessionInfo[] =>
  Array.from({ length: count }, (_, index) => session(`ses_${index}`));

const fetchedPage = (data: SessionInfo[], next: string | null): PageFetch => ({
  ok: true,
  page: { status: "fulfilled", value: { cursor: { next }, data } },
  running: { status: "fulfilled", value: {} },
});

const createSink = () => {
  const state: { nextCursor: string | undefined; sessions: SessionInfo[] } = {
    nextCursor: undefined,
    sessions: [],
  };
  const sink: RefreshSink = {
    loadedCount: { current: PAGE_LIMIT },
    setActive: () => {},
    setListError: () => {},
    setListUnavailable: () => {},
    setNextCursor: (value) => {
      state.nextCursor =
        typeof value === "function" ? value(state.nextCursor) : value;
    },
    setSessions: (value) => {
      state.sessions =
        typeof value === "function" ? value(state.sessions) : value;
    },
    setStatusError: () => {},
  };
  return { sink, state };
};

test("a short first page with a cursor shows no next page", () => {
  const { sink, state } = createSink();

  applyRefreshResult(
    fetchedPage(sessionPage(6), "cursor_next"),
    { aborted: false, cursor: undefined, limit: PAGE_LIMIT, timedOut: false },
    sink
  );

  assert.equal(state.sessions.length, 6);
  assert.equal(state.nextCursor, undefined);
});

test("a full page keeps the cursor for the next page", () => {
  const { sink, state } = createSink();

  applyRefreshResult(
    fetchedPage(sessionPage(PAGE_LIMIT), "cursor_next"),
    { aborted: false, cursor: undefined, limit: PAGE_LIMIT, timedOut: false },
    sink
  );

  assert.equal(state.nextCursor, "cursor_next");
});

test("a refresh that returns a short page after a full page clears the next page", () => {
  const { sink, state } = createSink();

  applyRefreshResult(
    fetchedPage(sessionPage(PAGE_LIMIT), "cursor_next"),
    { aborted: false, cursor: undefined, limit: PAGE_LIMIT, timedOut: false },
    sink
  );
  applyRefreshResult(
    fetchedPage(sessionPage(6), "cursor_stale"),
    { aborted: false, cursor: undefined, limit: PAGE_LIMIT, timedOut: false },
    sink
  );

  assert.equal(state.nextCursor, undefined);
});
