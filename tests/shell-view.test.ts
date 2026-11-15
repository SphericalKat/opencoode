import assert from "node:assert/strict";
import test from "node:test";

import { deriveShellView, parseShellRoute } from "../src/shell/shell-view";

test("the Sessions tab is the OpenCode tab root", () => {
  assert.deepEqual(parseShellRoute(["(opencode)"], undefined), {
    framed: true,
    tab: "sessions",
    workspaceSection: "Changes",
  });
});

test("the Workspace tab reads its pane from the section parameter", () => {
  assert.deepEqual(parseShellRoute(["(opencode)", "workspace"], "terminal"), {
    framed: true,
    tab: "workspace",
    workspaceSection: "Terminal",
  });
  assert.equal(
    parseShellRoute(["(opencode)", "workspace"], "bogus").workspaceSection,
    "Changes"
  );
});

test("settings routes drop the frame", () => {
  const route = parseShellRoute(["(opencode)", "settings", "[section]"], "");
  assert.equal(route.tab, "settings");
  assert.equal(route.framed, false);
});

test("the Pi shell and onboarding stay framed and the boot screen does not", () => {
  assert.equal(parseShellRoute(["pi", "settings"], undefined).framed, true);
  assert.equal(parseShellRoute(["pi", "settings"], undefined).tab, "sessions");
  assert.equal(parseShellRoute(["welcome"], undefined).framed, true);
  assert.equal(parseShellRoute(["restoring"], undefined).framed, false);
});

test("the pane switcher shows the workspace pane only on the Workspace tab", () => {
  const input = {
    betaHome: false,
    directory: "/work/app",
    openTabs: [],
    sessionID: "ses_1",
    workspaceSection: "Files" as const,
  };
  assert.equal(
    deriveShellView({ ...input, tab: "workspace" }).selectedPane,
    "Files"
  );
  assert.equal(
    deriveShellView({ ...input, tab: "sessions" }).selectedPane,
    "Session"
  );
  assert.equal(
    deriveShellView({ ...input, tab: "settings" }).currentOpenTab,
    undefined
  );
  assert.equal(
    deriveShellView({ ...input, tab: "settings" }).returnLabel,
    "Chat"
  );
});
