import assert from "node:assert/strict";
import test from "node:test";

import {
  rememberSettingsSection,
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
  assert.deepEqual(
    settingsTabHref({ key: "a:/repo", section: "Models" }, "a:/repo"),
    {
      pathname: "/(opencode)/settings/[section]",
      params: { section: "Models" },
    }
  );
});

test("settings opens at its index without a known section", () => {
  assert.equal(settingsTabHref(undefined, "a:/repo"), "/(opencode)/settings");
  assert.equal(
    settingsTabHref({ key: "a:/repo", section: "nope" }, "a:/repo"),
    "/(opencode)/settings"
  );
});

test("settings opens at its index after a server or directory change", () => {
  const remembered = { key: "a:/repo", section: "Models" };
  assert.equal(settingsTabHref(remembered, "b:/repo"), "/(opencode)/settings");
  assert.equal(settingsTabHref(remembered, "a:/other"), "/(opencode)/settings");
});

test("a section is remembered while settings is the open tab", () => {
  assert.deepEqual(
    rememberSettingsSection(undefined, "a:/repo", "Models", true),
    {
      key: "a:/repo",
      section: "Models",
    }
  );
  const remembered = { key: "a:/repo", section: "Models" };
  assert.equal(
    rememberSettingsSection(remembered, "a:/repo", undefined, false),
    remembered
  );
});

test("a server or directory change discards the remembered section", () => {
  const remembered = { key: "a:/repo", section: "Models" };
  assert.deepEqual(
    rememberSettingsSection(remembered, "b:/repo", "Models", true),
    {
      key: "b:/repo",
      section: undefined,
    }
  );
});
