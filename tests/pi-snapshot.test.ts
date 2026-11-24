import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient } from "@tanstack/react-query";

import type { PiSnapshot } from "../packages/pi-mobile/protocol";
import { piSnapshotOptions } from "../src/lib/queries/pi";
import { queryKeys } from "../src/lib/query-keys";

const snapshot = (cursor: number, instanceID = "a"): PiSnapshot =>
  ({
    cursor,
    instanceID,
    messages: [],
    session: { cwd: "/", id: "s", idle: true, name: "", thinkingLevel: "" },
    tools: [],
  }) as PiSnapshot;

const key = queryKeys.pi.snapshot("scope");

test("reuses a snapshot that is newer than 250 ms", async () => {
  const queryClient = new QueryClient();
  let calls = 0;
  const load = () => {
    calls += 1;
    return Promise.resolve(snapshot(calls));
  };
  await queryClient.fetchQuery(piSnapshotOptions(queryClient, "scope", load));
  const second = await queryClient.fetchQuery(
    piSnapshotOptions(queryClient, "scope", load)
  );
  assert.equal(calls, 1);
  assert.equal(second.cursor, 1);
});

test("a fresh fetch ignores the window", async () => {
  const queryClient = new QueryClient();
  let calls = 0;
  const load = () => {
    calls += 1;
    return Promise.resolve(snapshot(calls));
  };
  await queryClient.fetchQuery(piSnapshotOptions(queryClient, "scope", load));
  const second = await queryClient.fetchQuery(
    piSnapshotOptions(queryClient, "scope", load, true)
  );
  assert.equal(calls, 2);
  assert.equal(second.cursor, 2);
});

test("an older answer does not replace a newer write from the same instance", async () => {
  const queryClient = new QueryClient();
  const { promise, resolve } = Promise.withResolvers<PiSnapshot>();
  const pending = queryClient.fetchQuery(
    piSnapshotOptions(queryClient, "scope", () => promise)
  );
  queryClient.setQueryData(key, snapshot(5));
  resolve(snapshot(3));
  const settled = await pending;
  assert.equal(settled.cursor, 5);
  assert.equal(queryClient.getQueryData<PiSnapshot>(key)?.cursor, 5);
});

test("an answer from another instance is dropped after a write", async () => {
  const queryClient = new QueryClient();
  const { promise, resolve } = Promise.withResolvers<PiSnapshot>();
  const pending = queryClient.fetchQuery(
    piSnapshotOptions(queryClient, "scope", () => promise)
  );
  queryClient.setQueryData(key, snapshot(1, "a"));
  resolve(snapshot(9, "b"));
  const settled = await pending;
  assert.equal(settled.instanceID, "a");
});

test("an answer is stored when nothing was written during the fetch", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(key, snapshot(5, "a"));
  const next = await queryClient.fetchQuery(
    piSnapshotOptions(
      queryClient,
      "scope",
      () => Promise.resolve(snapshot(1, "b")),
      true
    )
  );
  assert.equal(next.instanceID, "b");
});
