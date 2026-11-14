import assert from "node:assert/strict";
import test from "node:test";

import { diffRows, parsePatch, unmodifiedLabel } from "../src/lib/diff";
import type { DiffRow } from "../src/lib/diff";

const TOTAL = 106;
const CHANGED_FROM = 5;
const CHANGED_TO = 24;

const fullContextPatch = () => {
  const body: string[] = [];
  for (let line = 1; line <= TOTAL; line += 1) {
    body.push(
      line >= CHANGED_FROM && line <= CHANGED_TO
        ? `+added ${line}`
        : ` context ${line}`
    );
  }
  const oldCount = TOTAL - (CHANGED_TO - CHANGED_FROM + 1);
  return [
    "diff --git a/f.txt b/f.txt",
    "index 111..222 100644",
    "--- a/f.txt",
    "+++ b/f.txt",
    `@@ -1,${oldCount} +1,${TOTAL} @@`,
    ...body,
    "",
  ].join("\n");
};

const lines = (rows: DiffRow[]) =>
  rows.flatMap((row) => (row.kind === "line" ? [row.line] : []));
const gaps = (rows: DiffRow[]) =>
  rows.flatMap((row) => (row.kind === "gap" ? [row] : []));

test("a full-context patch collapses to the changes and one trailing gap", () => {
  const rows = diffRows(fullContextPatch(), new Set());
  const visible = lines(rows);
  assert.equal(visible.length, 28);
  assert.equal(visible[0].newNumber, 1);
  assert.equal(visible.at(-1)?.newNumber, 28);
  const [gap] = gaps(rows);
  assert.equal(gaps(rows).length, 1);
  assert.equal(gap.gap.position, "trailing");
  assert.equal(gap.gap.count, 78);
  assert.equal(gap.gap.hidden.length, 78);
  assert.equal(unmodifiedLabel(gap.gap.count), "78 unmodified lines");

  const expanded = diffRows(fullContextPatch(), new Set([gap.id]));
  assert.equal(lines(expanded).length, TOTAL);
  assert.equal(gaps(expanded).length, 0);
});

test("removed and added lines carry only their own line number", () => {
  const { hunks } = parsePatch("@@ -3,2 +3,2 @@\n-old\n+new\n same\n");
  const [removed, added, context] = hunks[0].lines;
  assert.deepEqual(
    [removed.type, removed.oldNumber, removed.newNumber],
    ["removed", 3, undefined]
  );
  assert.deepEqual(
    [added.type, added.oldNumber, added.newNumber],
    ["added", undefined, 3]
  );
  assert.deepEqual([context.oldNumber, context.newNumber], [4, 4]);
});

test("a no-newline marker flags the previous line without adding a row", () => {
  const patch = "@@ -1 +1 @@\n-a\n\\ No newline at end of file\n+b\n";
  const rows = diffRows(patch, new Set());
  assert.equal(rows.length, 2);
  const [first, second] = lines(rows);
  assert.equal(first.noNewline, true);
  assert.equal(second.noNewline, undefined);
});

test("a partial patch with two hunks yields a middle gap that cannot expand", () => {
  const patch = [
    "@@ -1,2 +1,2 @@",
    "-a",
    "+b",
    " c",
    "@@ -20,2 +20,2 @@",
    " d",
    "-e",
    "+f",
    "",
  ].join("\n");
  const rows = diffRows(patch, new Set());
  const [gap] = gaps(rows);
  assert.equal(gaps(rows).length, 1);
  assert.equal(gap.gap.position, "middle");
  assert.equal(gap.gap.count, 17);
  assert.equal(gap.gap.hidden.length, 0);
  assert.equal(diffRows(patch, new Set([gap.id])).length, rows.length);
});

test("a patch that starts after line one begins with a leading gap", () => {
  const rows = diffRows("@@ -10,1 +10,1 @@\n-a\n+b\n", new Set());
  assert.equal(rows[0].kind, "gap");
  assert.equal(gaps(rows)[0].gap.position, "leading");
  assert.equal(gaps(rows)[0].gap.count, 9);
});

test("carriage returns are stripped and labels pluralize", () => {
  const { hunks } = parsePatch("@@ -1 +1 @@\r\n-a\r\n+b\r\n");
  assert.deepEqual(
    hunks[0].lines.map((line) => line.text),
    ["a", "b"]
  );
  assert.equal(unmodifiedLabel(1), "1 unmodified line");
});
