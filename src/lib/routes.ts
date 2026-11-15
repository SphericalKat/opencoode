export type WorkspacePane = "changes" | "files" | "terminal" | "worktrees";

export const routes = {
  restoring: "/restoring",
  welcome: "/welcome",
  sessions: "/(opencode)",
  workspace: "/(opencode)/workspace",
  settings: "/(opencode)/settings",
  piChat: "/pi",
  piSettings: "/pi/settings",
} as const;

export const workspacePath = (pane: WorkspacePane) =>
  ({ pathname: routes.workspace, params: { section: pane } }) as const;

export const settingsSectionPath = (section: string) =>
  ({
    pathname: "/(opencode)/settings/[section]",
    params: { section },
  }) as const;

export const piSettingsSectionPath = (section: string) =>
  ({ pathname: "/pi/settings/[section]", params: { section } }) as const;

export const WIDE_SETTINGS_WIDTH = 920;
