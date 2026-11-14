import assert from "node:assert/strict";
import test from "node:test";

import { sessionLabel } from "../src/lib/session-title";

test("sessionLabel names an untitled session without a parent New session", () => {
  assert.equal(sessionLabel({}), "New session");
  assert.equal(sessionLabel({ title: "" }), "New session");
});

test("sessionLabel names an untitled child session Child session", () => {
  assert.equal(sessionLabel({ parentID: "ses_parent" }), "Child session");
});

test("sessionLabel drops the timestamp from a historical fallback title", () => {
  assert.equal(
    sessionLabel({ title: "New session - 2026-11-14T08:50:33.000Z" }),
    "New session"
  );
  assert.equal(
    sessionLabel({
      parentID: "ses_parent",
      title: "Child session - 2026-11-14T08:50:33.000Z",
    }),
    "Child session"
  );
});

test("sessionLabel returns a normal title unchanged", () => {
  assert.equal(sessionLabel({ title: "Fix login bug" }), "Fix login bug");
});
