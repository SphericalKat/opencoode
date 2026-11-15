import type { WorkspacePane } from "../lib/routes";
import type { WorkspaceSection } from "../stores/session-location-store";
import type { Tab } from "./types";

const sectionByPane: Record<WorkspacePane, WorkspaceSection> = {
  changes: "Changes",
  files: "Files",
  terminal: "Terminal",
  worktrees: "Worktrees",
};

const paneBySection: Record<WorkspaceSection, WorkspacePane> = {
  Changes: "changes",
  Files: "files",
  Terminal: "terminal",
  Worktrees: "worktrees",
};

const isWorkspacePane = (value: string): value is WorkspacePane =>
  Object.hasOwn(sectionByPane, value);

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
  return value && isWorkspacePane(value) ? sectionByPane[value] : "Changes";
};

export const workspaceParamFromSection = (
  section: WorkspaceSection
): WorkspacePane => paneBySection[section];
