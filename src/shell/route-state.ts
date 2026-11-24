import { routes, settingsSectionPath, workspaceSections } from "../lib/routes";
import type { WorkspaceSection } from "../lib/routes";
import { allSections } from "../screens/settings/sections";
import type { Tab } from "./types";

const isWorkspaceSection = (value: string): value is WorkspaceSection =>
  workspaceSections.some((section) => section === value);

const workspacePath = /^\/workspace(?:\/|$)/u;
const settingsPath = /^\/settings(?:\/|$)/u;

export const tabFromPathname = (pathname: string): Tab => {
  if (workspacePath.test(pathname)) {
    return "workspace";
  }
  return settingsPath.test(pathname) ? "settings" : "sessions";
};

export const workspaceSectionFromParam = (
  param: string | string[] | undefined
): WorkspaceSection => {
  const value = Array.isArray(param) ? param[0] : param;
  return value && isWorkspaceSection(value) ? value : "Changes";
};

export interface RememberedSettingsSection {
  key: string;
  section: string | undefined;
}

// Navigating to the settings index pops the settings stack to its first
// screen. Re-entering settings targets the section that was last open, unless
// the server or directory (the key) changed since then.
export const settingsTabHref = (
  remembered: RememberedSettingsSection | undefined,
  key: string
) => {
  const known =
    remembered?.key === key
      ? allSections.find((candidate) => candidate === remembered.section)
      : undefined;
  return known ? settingsSectionPath(known) : routes.settings;
};

// Settings can still be the open tab in the render where the key changes. That
// render carries the section of the old server, so it must not be recorded.
export const rememberSettingsSection = (
  previous: RememberedSettingsSection | undefined,
  key: string,
  section: string | undefined,
  settingsOpen: boolean
): RememberedSettingsSection | undefined => {
  if (previous && previous.key !== key) {
    return { key, section: undefined };
  }
  return settingsOpen ? { key, section } : previous;
};
