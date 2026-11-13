import assert from "node:assert/strict";
import test from "node:test";

import {
  MERGE_WINDOW,
  REVEAL_DURATION,
  pruneChunks,
  recordGrowth,
  splitReveal,
  withAlpha,
} from "../src/lib/stream-reveal";

test("text that existed before the growth stays fully opaque", () => {
  const chunks = recordGrowth([], 10, 15, 1000);
  assert.deepEqual(splitReveal("0123456789abcde", 0, chunks, 1000), [
    { opacity: 1, text: "0123456789" },
    { opacity: 0, text: "abcde" },
  ]);
});

test("growth inside the merge window joins the last chunk", () => {
  const first = recordGrowth([], 0, 5, 1000);
  const second = recordGrowth(first, 5, 9, 1000 + MERGE_WINDOW - 1);
  assert.deepEqual(splitReveal("abcdefghi", 0, second, 1000), [
    { opacity: 0, text: "abcdefghi" },
  ]);
});

test("growth after the merge window starts a new chunk", () => {
  const first = recordGrowth([], 0, 5, 1000);
  const second = recordGrowth(first, 5, 9, 1000 + MERGE_WINDOW);
  const now = 1000 + REVEAL_DURATION / 2;
  assert.deepEqual(splitReveal("abcdefghi", 0, second, now), [
    { opacity: 0.5, text: "abcde" },
    {
      opacity: (REVEAL_DURATION / 2 - MERGE_WINDOW) / REVEAL_DURATION,
      text: "fghi",
    },
  ]);
});

test("opacity rises linearly and reaches full at the reveal duration", () => {
  const chunks = recordGrowth([], 0, 3, 0);
  const opacityAt = (now: number) =>
    splitReveal("abc", 0, chunks, now)[0].opacity;
  assert.equal(opacityAt(0), 0);
  assert.equal(opacityAt(REVEAL_DURATION / 4), 0.25);
  assert.equal(opacityAt(REVEAL_DURATION / 2), 0.5);
  assert.equal(opacityAt(REVEAL_DURATION), 1);
  assert.equal(opacityAt(REVEAL_DURATION * 2), 1);
});

test("finished chunks are pruned and their text stays opaque", () => {
  const first = recordGrowth([], 0, 4, 0);
  const second = recordGrowth(first, 4, 8, 300);
  const pruned = pruneChunks(second, REVEAL_DURATION);
  assert.equal(pruned.length, 1);
  assert.deepEqual(splitReveal("abcdefgh", 0, pruned, REVEAL_DURATION), [
    { opacity: 1, text: "abcd" },
    { opacity: 0.5, text: "efgh" },
  ]);
  assert.deepEqual(pruneChunks(second, 300 + REVEAL_DURATION), []);
});

test("growth after every chunk finished starts a fresh chunk", () => {
  const first = recordGrowth([], 0, 4, 0);
  const second = recordGrowth(first, 4, 8, REVEAL_DURATION + 10);
  assert.deepEqual(splitReveal("abcdefgh", 0, second, REVEAL_DURATION + 10), [
    { opacity: 1, text: "abcd" },
    { opacity: 0, text: "efgh" },
  ]);
});

test("shrinking clamps chunks to the remaining text", () => {
  const first = recordGrowth([], 0, 4, 0);
  const second = recordGrowth(first, 4, 8, 200);
  const shrunk = recordGrowth(second, 8, 4, 300);
  assert.equal(shrunk.length, 1);
  assert.deepEqual(splitReveal("abcd", 0, shrunk, 300), [
    { opacity: 0.5, text: "abcd" },
  ]);
  const grown = recordGrowth(shrunk, 4, 6, 450);
  assert.deepEqual(splitReveal("abcdef", 0, grown, 450), [
    { opacity: 0.75, text: "abcd" },
    { opacity: 0, text: "ef" },
  ]);
});

test("a leaf takes only the chunk ranges it overlaps", () => {
  const first = recordGrowth([], 10, 20, 0);
  const second = recordGrowth(first, 20, 30, 300);
  const now = 300;
  assert.deepEqual(splitReveal("abcde", 0, second, now), [
    { opacity: 1, text: "abcde" },
  ]);
  assert.deepEqual(splitReveal("abcdefghij", 8, second, now), [
    { opacity: 1, text: "ab" },
    { opacity: 0.5, text: "cdefghij" },
  ]);
  assert.deepEqual(splitReveal("abcdefghij", 15, second, now), [
    { opacity: 0.5, text: "abcde" },
    { opacity: 0, text: "fghij" },
  ]);
  assert.deepEqual(splitReveal("abc", 25, second, now), [
    { opacity: 0, text: "abc" },
  ]);
});

test("adjacent pieces with equal opacity merge", () => {
  const first = recordGrowth([], 0, 4, 0);
  const second = recordGrowth(first, 4, 8, 200);
  assert.deepEqual(splitReveal("abcdefgh", 0, second, 1000), [
    { opacity: 1, text: "abcdefgh" },
  ]);
});

test("alpha scales hex colors and leaves other colors unfaded", () => {
  assert.equal(withAlpha("#ffffff", 0.5), "#ffffff80");
  assert.equal(withAlpha("#abc", 1), "#aabbccff");
  assert.equal(withAlpha("#11223380", 0.5), "#11223340");
  assert.equal(withAlpha("#123", 0), "#11223300");
  assert.equal(withAlpha("rgb(1, 2, 3)", 0.5), undefined);
});
