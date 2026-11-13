import assert from "node:assert/strict";
import test from "node:test";

import {
  MIN_RELEASE,
  REVEAL_DURATION,
  SETTLE_AFTER,
  clampReveal,
  pruneChunks,
  releaseText,
  splitReveal,
  withAlpha,
} from "../src/lib/stream-reveal";
import type { RevealChunk } from "../src/lib/stream-reveal";

const TEXT = "Arch bridges carry loads along a curved structure to each end.";

test("a release ends at a word boundary and becomes a new chunk", () => {
  const next = releaseText({ chunks: [], shown: 0 }, TEXT, [], 8, 1000);
  assert.equal(TEXT.slice(0, next.shown), "Arch bridges ");
  assert.deepEqual(next.chunks, [{ start: 0, startedAt: 1000 }]);
});

test("consecutive releases start where the previous one ended", () => {
  const first = releaseText({ chunks: [], shown: 0 }, TEXT, [], 8, 1000);
  const second = releaseText(first, TEXT, [], 8, 1100);
  assert.equal(TEXT.slice(first.shown, second.shown), "carry loads ");
  assert.deepEqual(second.chunks, [
    { start: 0, startedAt: 1000 },
    { start: first.shown, startedAt: 1100 },
  ]);
});

test("an empty pacer budget still releases at the minimum rate", () => {
  const next = releaseText({ chunks: [], shown: 0 }, TEXT, [], 0, 0);
  assert.ok(next.shown >= MIN_RELEASE);
});

test("a release never passes the end of the text", () => {
  const next = releaseText({ chunks: [], shown: 50 }, TEXT, [], 500, 0);
  assert.equal(next.shown, TEXT.length);
  const done = releaseText(next, TEXT, [], 500, 100);
  assert.equal(done, next);
});

test("a release that lands inside a code block releases the whole block", () => {
  const atomic = [{ end: 40, start: 5 }];
  const next = releaseText({ chunks: [], shown: 0 }, TEXT, atomic, 8, 0);
  assert.equal(next.shown, 40);
});

test("a chunk stays live until its fade and mount grace have passed", () => {
  const chunks: RevealChunk[] = [{ start: 0, startedAt: 0 }];
  assert.equal(pruneChunks(chunks, REVEAL_DURATION).length, 1);
  assert.equal(pruneChunks(chunks, SETTLE_AFTER - 1).length, 1);
  assert.deepEqual(pruneChunks(chunks, SETTLE_AFTER), []);
});

test("releasing prunes chunks that have settled", () => {
  const first = releaseText({ chunks: [], shown: 0 }, TEXT, [], 8, 0);
  const second = releaseText(first, TEXT, [], 8, SETTLE_AFTER);
  assert.deepEqual(second.chunks, [
    { start: first.shown, startedAt: SETTLE_AFTER },
  ]);
});

test("shrinking text clamps the shown length and drops chunks past it", () => {
  const state = {
    chunks: [
      { start: 0, startedAt: 0 },
      { start: 10, startedAt: 100 },
    ],
    shown: 20,
  };
  assert.deepEqual(clampReveal(state, 8), {
    chunks: [{ start: 0, startedAt: 0 }],
    shown: 8,
  });
  assert.equal(clampReveal(state, 30), state);
});

test("a leaf takes only the chunk ranges it overlaps", () => {
  const chunks: RevealChunk[] = [
    { start: 10, startedAt: 0 },
    { start: 20, startedAt: 300 },
  ];
  assert.deepEqual(splitReveal("abcde", 0, chunks), [{ text: "abcde" }]);
  assert.deepEqual(splitReveal("abcdefghij", 8, chunks), [
    { text: "ab" },
    { startedAt: 0, text: "cdefghij" },
  ]);
  assert.deepEqual(splitReveal("abcdefghij", 15, chunks), [
    { startedAt: 0, text: "abcde" },
    { startedAt: 300, text: "fghij" },
  ]);
  assert.deepEqual(splitReveal("abc", 25, chunks), [
    { startedAt: 300, text: "abc" },
  ]);
});

test("alpha scales hex colors and leaves other colors unfaded", () => {
  assert.equal(withAlpha("#ffffff", 0.5), "#ffffff80");
  assert.equal(withAlpha("#abc", 1), "#aabbccff");
  assert.equal(withAlpha("#11223380", 0.5), "#11223340");
  assert.equal(withAlpha("#123", 0), "#11223300");
  assert.equal(withAlpha("rgb(1, 2, 3)", 0.5), undefined);
});
