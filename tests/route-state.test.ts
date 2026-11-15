import assert from "node:assert/strict";
import test from "node:test";

import {
  tabFromPathname,
  workspaceParamFromSection,
  workspaceSectionFromParam,
} from "../src/shell/route-state";

test("the tab comes from the first path segment", () => {
  assert.equal(tabFromPathname("/"), "sessions");
  assert.equal(tabFromPathname("/workspace"), "workspace");
  assert.equal(tabFromPathname("/settings"), "settings");
  assert.equal(tabFromPathname("/settings/models"), "settings");
});

test("a workspace pane round trips through the search parameter", () => {
  assert.equal(workspaceSectionFromParam("terminal"), "Terminal");
  assert.equal(workspaceSectionFromParam(["files", "x"]), "Files");
  assert.equal(workspaceParamFromSection("Worktrees"), "worktrees");
});

test("an unknown or missing pane falls back to Changes", () => {
  assert.equal(workspaceSectionFromParam(undefined), "Changes");
  assert.equal(workspaceSectionFromParam("nope"), "Changes");
});
