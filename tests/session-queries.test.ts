import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient } from "@tanstack/react-query";

import { sessionDetailOptions } from "../src/lib/queries/sessions";
import { cachedTabTitles } from "../src/shell/use-titled-tabs";

const SCOPE = "server-1";
const tabs = [
  { directory: "/repo", id: "ses_open" },
  { directory: "/repo", id: "ses_deleted" },
];

test("tab titles come from the cached session detail", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    sessionDetailOptions(SCOPE, null, "ses_open").queryKey,
    {
      id: "ses_open",
      title: "Fix the build",
    } as never
  );
  assert.deepEqual(cachedTabTitles(queryClient, SCOPE, tabs), [
    "Fix the build",
    "Session",
  ]);
});

test("a tab title falls back after its session detail leaves the cache", () => {
  const queryClient = new QueryClient();
  const { queryKey } = sessionDetailOptions(SCOPE, null, "ses_deleted");
  queryClient.setQueryData(queryKey, {
    id: "ses_deleted",
    title: "Old",
  } as never);
  queryClient.removeQueries({ queryKey });
  assert.deepEqual(cachedTabTitles(queryClient, SCOPE, tabs), [
    "Session",
    "Session",
  ]);
});
