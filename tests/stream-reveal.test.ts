import assert from "node:assert/strict";
import test from "node:test";

import {
  MERGE_WINDOW,
  REVEAL_DURATION,
  SETTLE_AFTER,
  pruneChunks,
  recordGrowth,
  splitReveal,
  withAlpha,
} from "../src/lib/stream-reveal";

test("text that existed before the growth stays fully opaque", () => {
  const chunks = recordGrowth([], 10, 15, 1000);
  assert.deepEqual(splitReveal("0123456789abcde", 0, chunks), [
    { text: "0123456789" },
    { startedAt: 1000, text: "abcde" },
  ]);
});

test("growth inside the merge window joins the last chunk", () => {
  const first = recordGrowth([], 0, 5, 1000);
  const second = recordGrowth(first, 5, 9, 1000 + MERGE_WINDOW - 1);
  assert.deepEqual(splitReveal("abcdefghi", 0, second), [
    { startedAt: 1000, text: "abcdefghi" },
  ]);
});

test("growth after the merge window starts a new chunk", () => {
  const first = recordGrowth([], 0, 5, 1000);
  const second = recordGrowth(first, 5, 9, 1000 + MERGE_WINDOW);
  assert.deepEqual(splitReveal("abcdefghi", 0, second), [
    { startedAt: 1000, text: "abcde" },
    { startedAt: 1000 + MERGE_WINDOW, text: "fghi" },
  ]);
});

test("a chunk stays live until its fade and mount grace have passed", () => {
  const chunks = recordGrowth([], 0, 3, 0);
  assert.equal(pruneChunks(chunks, REVEAL_DURATION).length, 1);
  assert.equal(pruneChunks(chunks, SETTLE_AFTER - 1).length, 1);
  assert.deepEqual(pruneChunks(chunks, SETTLE_AFTER), []);
});

test("finished chunks are pruned and their text stays opaque", () => {
  const first = recordGrowth([], 0, 4, 0);
  const second = recordGrowth(first, 4, 8, 300);
  const pruned = pruneChunks(second, SETTLE_AFTER);
  assert.equal(pruned.length, 1);
  assert.deepEqual(splitReveal("abcdefgh", 0, pruned), [
    { text: "abcd" },
    { startedAt: 300, text: "efgh" },
  ]);
  assert.deepEqual(pruneChunks(second, 300 + SETTLE_AFTER), []);
});

test("growth after every chunk finished starts a fresh chunk", () => {
  const first = recordGrowth([], 0, 4, 0);
  const second = recordGrowth(first, 4, 8, SETTLE_AFTER + 10);
  assert.deepEqual(splitReveal("abcdefgh", 0, second), [
    { text: "abcd" },
    { startedAt: SETTLE_AFTER + 10, text: "efgh" },
  ]);
});

test("shrinking clamps chunks to the remaining text", () => {
  const first = recordGrowth([], 0, 4, 0);
  const second = recordGrowth(first, 4, 8, 200);
  const shrunk = recordGrowth(second, 8, 4, 300);
  assert.equal(shrunk.length, 1);
  assert.deepEqual(splitReveal("abcd", 0, shrunk), [
    { startedAt: 0, text: "abcd" },
  ]);
  const grown = recordGrowth(shrunk, 4, 6, 450);
  assert.deepEqual(splitReveal("abcdef", 0, grown), [
    { startedAt: 0, text: "abcd" },
    { startedAt: 450, text: "ef" },
  ]);
});

test("a leaf takes only the chunk ranges it overlaps", () => {
  const first = recordGrowth([], 10, 20, 0);
  const second = recordGrowth(first, 20, 30, 300);
  assert.deepEqual(splitReveal("abcde", 0, second), [{ text: "abcde" }]);
  assert.deepEqual(splitReveal("abcdefghij", 8, second), [
    { text: "ab" },
    { startedAt: 0, text: "cdefghij" },
  ]);
  assert.deepEqual(splitReveal("abcdefghij", 15, second), [
    { startedAt: 0, text: "abcde" },
    { startedAt: 300, text: "fghij" },
  ]);
  assert.deepEqual(splitReveal("abc", 25, second), [
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
