import assert from "node:assert/strict";
import test from "node:test";

import type { FormField } from "@opencode/client";

import { initialFormValues, prepareFormAnswer } from "../src/lib/forms";

test("forms omit inactive stale answers and resolve later conditions from active parsed answers", () => {
  const fields: FormField[] = [
    { key: "count", type: "integer" },
    {
      key: "extra",
      required: true,
      type: "string",
      when: [{ key: "count", op: "eq", value: 2 }],
    },
    {
      key: "nested",
      required: true,
      type: "string",
      when: [{ key: "extra", op: "neq", value: "skip" }],
    },
  ];
  assert.deepEqual(
    prepareFormAnswer(fields, { count: "1", extra: "stale", nested: "stale" }),
    { answer: { count: 1 }, errors: {} }
  );
  assert.deepEqual(
    prepareFormAnswer(fields, {
      count: "2",
      extra: "continue",
      nested: "done",
    }),
    { answer: { count: 2, extra: "continue", nested: "done" }, errors: {} }
  );
});

test("multiselect conditions require an answer and check membership", () => {
  const fields: FormField[] = [
    {
      key: "choices",
      options: [{ label: "A", value: "a" }],
      type: "multiselect",
    },
    {
      key: "detail",
      required: true,
      type: "string",
      when: [{ key: "choices", op: "eq", value: "a" }],
    },
    {
      key: "other",
      required: true,
      type: "string",
      when: [{ key: "choices", op: "neq", value: "a" }],
    },
  ];
  assert.deepEqual(prepareFormAnswer(fields, {}).errors, {});
  assert.deepEqual(prepareFormAnswer(fields, { choices: ["a"] }).errors, {
    detail: "Enter a value",
  });
});

test("defaults include hidden values without replacing explicit false or zero", () => {
  const fields: FormField[] = [
    { default: "us", hidden: true, key: "region", type: "string" },
    { default: true, key: "enabled", required: true, type: "boolean" },
    { default: 5, key: "count", required: true, type: "number" },
  ];
  assert.deepEqual(initialFormValues(fields), {
    count: 5,
    enabled: true,
    region: "us",
  });
  assert.deepEqual(prepareFormAnswer(fields, { count: 0, enabled: false }), {
    answer: { count: 0, enabled: false, region: "us" },
    errors: {},
  });
});

test("forms reject invalid numeric and restricted choice answers", () => {
  const fields: FormField[] = [
    { key: "count", maximum: 3, minimum: 1, type: "integer" },
    {
      key: "choice",
      options: [{ label: "Allowed", value: "allowed" }],
      type: "string",
    },
    {
      custom: true,
      key: "multiple",
      maxItems: 1,
      options: [],
      type: "multiselect",
    },
  ];
  const result = prepareFormAnswer(fields, {
    choice: "invalid",
    count: "1.5",
    multiple: ["a", "b"],
  });
  assert.deepEqual(Object.keys(result.errors), ["count", "choice", "multiple"]);
  assert.deepEqual(result.answer, {});
});

test("formats and size constraints block invalid form submissions", () => {
  const fields: FormField[] = [
    { format: "date", key: "date", type: "string" },
    {
      key: "name",
      maxLength: 4,
      minLength: 3,
      pattern: "^[a-z]+$",
      type: "string",
    },
    { key: "url", type: "external", url: "https://example.com" },
  ];
  assert.deepEqual(
    Object.keys(
      prepareFormAnswer(fields, { date: "2026-02-30", name: "A", url: true })
        .errors
    ),
    ["date", "name"]
  );
  assert.deepEqual(
    prepareFormAnswer(fields, { date: "2026-02-28", name: "okay", url: true }),
    { answer: { date: "2026-02-28", name: "okay", url: true }, errors: {} }
  );
});

test("external steps require explicit acknowledgment and cleared defaults stay cleared", () => {
  const fields: FormField[] = [
    { default: "default", key: "choice", type: "string" },
    { key: "auth", type: "external", url: "https://example.com" },
  ];
  assert.deepEqual(prepareFormAnswer(fields, { choice: undefined }), {
    answer: {},
    errors: { auth: "Confirm that you completed this step" },
  });
  assert.deepEqual(
    prepareFormAnswer(fields, { auth: true, choice: undefined }),
    { answer: { auth: true }, errors: {} }
  );
});
