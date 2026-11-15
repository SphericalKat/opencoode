import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";

import type { OpenCodeEvent } from "@opencode/client";
import { QueryClient } from "@tanstack/react-query";

import { retryDelay } from "../src/lib/live/backoff";
import { createKeyedDebounce } from "../src/lib/live/debounce";
import { planEvent } from "../src/lib/live/opencode-event-table";
import { createOpenCodeRouter } from "../src/lib/live/opencode-router";
import { queryKeys } from "../src/lib/query-keys";

const event = (type: string, data: Record<string, unknown>) =>
  ({ data, type }) as unknown as OpenCodeEvent;

const page = (id: string) => ({ cursor: { next: null }, data: [{ id }] });

test("retry delay doubles and stops at 15 seconds", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 20].map(retryDelay),
    [1000, 2000, 4000, 8000, 15_000, 15_000, 15_000]
  );
});

test("a debounce key runs once for a burst", async () => {
  const debounce = createKeyedDebounce(10);
  const calls: string[] = [];
  debounce.schedule("a", () => calls.push("a"));
  debounce.schedule("a", () => calls.push("a"));
  debounce.schedule("b", () => calls.push("b"));
  await wait(30);
  assert.deepEqual(calls, ["a", "b"]);
});

test("a history event refreshes the head instead of invalidating messages", () => {
  const operations = planEvent(
    event("session.synthetic", { sessionID: "s1" }),
    "srv"
  );
  assert.deepEqual(operations, [{ kind: "refreshHead", sessionID: "s1" }]);
});

test("a form event reaches session, permission and directory forms", () => {
  const operations = planEvent(
    event("form.created", { form: { sessionID: "s1" } }),
    "srv"
  );
  assert.ok(
    operations.some(
      (operation) =>
        operation.kind === "invalidate" &&
        operation.queryKey.join(",") ===
          queryKeys.session.forms("srv", "s1").join(",")
    )
  );
  assert.ok(
    operations.some(
      (operation) =>
        operation.kind === "invalidateDirs" && operation.tail === "forms"
    )
  );
});

test("server.connected trims messages to page 0 and keeps the transcript", () => {
  const queryClient = new QueryClient();
  const messagesKey = queryKeys.session.messages("srv", "s1");
  queryClient.setQueryData(messagesKey, {
    pageParams: [undefined, "c1"],
    pages: [page("new"), page("old")],
  });
  const router = createOpenCodeRouter({
    core: {} as never,
    queryClient,
    scope: "srv",
  });
  router.handle(event("server.connected", {}));
  const data = queryClient.getQueryData<{ pages: unknown[] }>(messagesKey);
  assert.equal(data?.pages.length, 1);
  assert.deepEqual(data?.pages[0], page("new"));
  router.dispose();
});

test("execution events write the active map and the status", () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.sessions.active("srv"), {});
  const router = createOpenCodeRouter({
    core: {} as never,
    queryClient,
    scope: "srv",
  });
  router.handle(event("session.execution.started", { sessionID: "s1" }));
  assert.deepEqual(queryClient.getQueryData(queryKeys.sessions.active("srv")), {
    s1: { type: "running" },
  });
  assert.deepEqual(
    queryClient.getQueryData(queryKeys.session.status("srv", "s1")),
    { type: "busy" }
  );
  router.dispose();
});
