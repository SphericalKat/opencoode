import assert from "node:assert/strict";
import test from "node:test";

import { diffsOf } from "../src/screens/changes/use-changes";
import type { ChangesState } from "../src/screens/changes/use-changes";

test("a pending state keeps the same empty diff list across renders", () => {
  const first: ChangesState = { status: "loading" };
  const second: ChangesState = { status: "loading" };
  assert.equal(diffsOf(first), diffsOf(second));
  assert.deepEqual(diffsOf(first), []);
});

test("an error state keeps the same empty diff list across renders", () => {
  const first: ChangesState = { message: "failed", status: "error" };
  const second: ChangesState = { message: "failed", status: "error" };
  assert.equal(diffsOf(first), diffsOf(second));
});

test("a ready state returns its own diff list", () => {
  const diffs: Extract<ChangesState, { status: "ready" }>["diffs"] = [];
  assert.equal(diffsOf({ diffs, status: "ready" }), diffs);
});
