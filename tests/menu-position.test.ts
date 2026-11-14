import assert from "node:assert/strict";
import test from "node:test";

import { placeMenu } from "../src/lib/menu-position";

const window = { height: 800, width: 400 };
const insets = { bottom: 0, left: 0, right: 0, top: 0 };
const menu = { height: 200, width: 160 };

test("bottom-start places the menu under the anchor start edge", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 100, x: 20, y: 100 },
    insets,
    menu,
    placement: "bottom-start",
    window,
  });
  assert.equal(result.left, 20);
  assert.equal(result.top, 144);
  assert.deepEqual(result.origin, { x: "left", y: "top" });
  assert.equal(result.maxHeight, 800 - 8 - 144);
});

test("the menu flips above the anchor near the bottom edge", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 100, x: 20, y: 700 },
    insets,
    menu,
    placement: "bottom-start",
    window,
  });
  assert.equal(result.top, 700 - 4 - 200);
  assert.deepEqual(result.origin, { x: "left", y: "bottom" });
});

test("a top placement flips below when the anchor sits at the top", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 100, x: 20, y: 20 },
    insets,
    menu,
    placement: "top-start",
    window,
  });
  assert.equal(result.top, 64);
  assert.equal(result.origin.y, "top");
});

test("the menu clamps at the right edge", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 40, x: 380, y: 100 },
    insets,
    menu,
    placement: "bottom-start",
    window,
  });
  assert.equal(result.left, 400 - 8 - 160);
});

test("end placement aligns the menu end edge with the anchor end edge", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 100, x: 200, y: 100 },
    insets,
    menu,
    placement: "bottom-end",
    window,
  });
  assert.equal(result.left, 200 + 100 - 160);
  assert.deepEqual(result.origin, { x: "right", y: "top" });
});

test("end placement clamps at the left edge", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 40, x: 0, y: 100 },
    insets,
    menu,
    placement: "bottom-end",
    window,
  });
  assert.equal(result.left, 8);
});

test("maxHeight shrinks to the space on the larger side when neither side fits", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 100, x: 20, y: 300 },
    insets,
    menu: { height: 900, width: 160 },
    placement: "bottom-start",
    window,
  });
  assert.equal(result.maxHeight, 800 - 8 - (300 + 40 + 4));
  assert.equal(result.top, 344);
});

test("the maxHeight input caps the space-derived height", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 100, x: 20, y: 100 },
    insets,
    maxHeight: 120,
    menu,
    placement: "bottom-start",
    window,
  });
  assert.equal(result.maxHeight, 120);
});

test("a flipped menu that exceeds the space above stays below the top inset", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 100, x: 20, y: 600 },
    insets: { bottom: 0, left: 0, right: 0, top: 50 },
    menu: { height: 900, width: 160 },
    placement: "bottom-start",
    window,
  });
  assert.equal(result.top, 58);
  assert.equal(result.maxHeight, 600 - 4 - 58);
});

test("insets reduce the usable area on every edge", () => {
  const result = placeMenu({
    anchor: { height: 40, width: 40, x: 380, y: 740 },
    insets: { bottom: 40, left: 30, right: 30, top: 0 },
    menu,
    placement: "bottom-start",
    window,
  });
  assert.equal(result.left, 400 - 30 - 8 - 160);
  assert.equal(result.top, 740 - 4 - 200);
});
