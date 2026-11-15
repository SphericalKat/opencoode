import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient, QueryObserver } from "@tanstack/react-query";

import { sessionDetailOptions } from "../src/lib/queries/sessions";
import { queryKeys } from "../src/lib/query-keys";
import {
  cachedTabTitles,
  tabDetailObserverOptions,
} from "../src/shell/use-titled-tabs";

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

const observeTab = (queryClient: QueryClient, id: string) => {
  const observer = new QueryObserver(
    queryClient,
    tabDetailObserverOptions(SCOPE, id)
  );
  return observer.subscribe(() => {});
};

test("a tab keeps its cached detail and never fetches it", async () => {
  const queryClient = new QueryClient();
  const { queryKey } = sessionDetailOptions(SCOPE, null, "ses_open");
  let fetches = 0;
  queryClient.setQueryDefaults(queryKey, {
    queryFn: () => {
      fetches += 1;
      return { id: "ses_open", title: "Fetched" };
    },
  });
  queryClient.setQueryData(queryKey, {
    id: "ses_open",
    title: "Kept",
  } as never);
  const unsubscribe = observeTab(queryClient, "ses_open");
  await queryClient.invalidateQueries({
    queryKey: queryKeys.session.all(SCOPE, "ses_open"),
  });
  unsubscribe();
  assert.equal(fetches, 0);
  assert.deepEqual(cachedTabTitles(queryClient, SCOPE, tabs.slice(0, 1)), [
    "Kept",
  ]);
});

test("a deleted session tab sends no detail request", async () => {
  const queryClient = new QueryClient();
  const { queryKey } = sessionDetailOptions(SCOPE, null, "ses_deleted");
  let fetches = 0;
  queryClient.setQueryDefaults(queryKey, {
    queryFn: () => {
      fetches += 1;
      throw new Error("404");
    },
  });
  queryClient.setQueryData(queryKey, {
    id: "ses_deleted",
    title: "Old",
  } as never);
  const unsubscribe = observeTab(queryClient, "ses_deleted");
  queryClient.removeQueries({
    queryKey: queryKeys.session.all(SCOPE, "ses_deleted"),
  });
  const rebuilt = observeTab(queryClient, "ses_deleted");
  await queryClient.invalidateQueries({
    queryKey: queryKeys.session.all(SCOPE, "ses_deleted"),
  });
  unsubscribe();
  rebuilt();
  assert.equal(fetches, 0);
});
