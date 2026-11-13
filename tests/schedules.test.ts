import assert from "node:assert/strict";
import test from "node:test";

import { prepareSchedule } from "../src/lib/schedules";
import type { ScheduleDraft } from "../src/lib/schedules";

const draft: ScheduleDraft = {
  after: "",
  mode: "every",
  name: "",
  prompt: "Check the build",
  runs: "",
  timezone: "Asia/Kolkata",
  trigger: "1 hour",
  until: "",
};

test("schedule form rejects empty input and invalid repeat limits before server admission", () => {
  assert.throws(
    () => prepareSchedule("ses_a", { ...draft, prompt: "  " }),
    /Enter the prompt/u
  );
  assert.throws(
    () => prepareSchedule("ses_a", { ...draft, trigger: "" }),
    /Enter when/u
  );
  for (const runs of [
    "0",
    "-1",
    "1.5",
    "Infinity",
    "abc",
    "9007199254740992",
  ]) {
    assert.throws(
      () => prepareSchedule("ses_a", { ...draft, runs }),
      /whole number/u
    );
  }
  assert.throws(
    () => prepareSchedule("ses_a", { ...draft, timezone: "Not/AZone" }),
    /valid time zone/u
  );
});

test("one-shot requests do not inherit repeat limits from a previous form mode", () => {
  const request = prepareSchedule("ses_a", {
    ...draft,
    after: "8 hours",
    mode: "in",
    runs: "invalid",
    trigger: "20 minutes",
  });
  assert.equal(request.ends, undefined);
});
