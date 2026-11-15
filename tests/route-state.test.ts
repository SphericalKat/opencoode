import assert from "node:assert/strict";
import test from "node:test";

import {
  settingsTabHref,
  tabFromPathname,
  workspaceSectionFromParam,
} from "../src/shell/route-state";

test("the tab comes from the first path segment", () => {
  assert.equal(tabFromPathname("/"), "sessions");
  assert.equal(tabFromPathname("/workspace"), "workspace");
  assert.equal(tabFromPathname("/settings"), "settings");
  assert.equal(tabFromPathname("/settings/models"), "settings");
});

test("a workspace pane comes from the search parameter", () => {
  assert.equal(workspaceSectionFromParam("Terminal"), "Terminal");
  assert.equal(workspaceSectionFromParam(["Files", "x"]), "Files");
});

test("an unknown or missing pane falls back to Changes", () => {
  assert.equal(workspaceSectionFromParam(undefined), "Changes");
  assert.equal(workspaceSectionFromParam("nope"), "Changes");
});

test("re-entering settings targets the section that was last open", () => {
  assert.deepEqual(settingsTabHref("Models"), {
    pathname: "/(opencode)/settings/[section]",
    params: { section: "Models" },
  });
});

test("settings opens at its index without a known section", () => {
  assert.equal(settingsTabHref(undefined), "/(opencode)/settings");
  assert.equal(settingsTabHref("nope"), "/(opencode)/settings");
});
