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

// Navigating to the settings index pops the settings stack to its first
// screen. Re-entering settings targets the section that was last open.
export const settingsTabHref = (section: string | undefined) => {
  const known = allSections.find((candidate) => candidate === section);
  return known ? settingsSectionPath(known) : routes.settings;
};
