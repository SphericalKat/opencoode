import assert from "node:assert/strict";
import test from "node:test";

import { withAlpha } from "../src/lib/color";

test("withAlpha appends an alpha byte to a six-digit hex color", () => {
  assert.equal(withAlpha("#161616", 0.2), "#16161633");
  assert.equal(withAlpha("#ffffff", 1), "#ffffffff");
  assert.equal(withAlpha("#ffffff", 0), "#ffffff00");
});

test("withAlpha multiplies the existing alpha of an eight-digit hex color", () => {
  assert.equal(withAlpha("#ffffff80", 0.5), "#ffffff40");
  assert.equal(withAlpha("#ffffffff", 0.5), "#ffffff80");
});

test("withAlpha returns colors that are not hex unchanged", () => {
  assert.equal(withAlpha("rgb(1,2,3)", 0.5), "rgb(1,2,3)");
  assert.equal(withAlpha("red", 0.5), "red");
  assert.equal(withAlpha("#fff", 0.5), "#fff");
});
