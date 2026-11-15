export const workspaceSections = [
  "Changes",
  "Files",
  "Terminal",
  "Worktrees",
] as const;

export type WorkspaceSection = (typeof workspaceSections)[number];

export const routes = {
  restoring: "/restoring",
  welcome: "/welcome",
  sessions: "/(opencode)",
  workspace: "/(opencode)/workspace",
  settings: "/(opencode)/settings",
  piChat: "/pi",
  piSettings: "/pi/settings",
} as const;

export const workspacePath = (section: WorkspaceSection) =>
  ({ pathname: routes.workspace, params: { section } }) as const;

export const settingsSectionPath = (section: string) =>
  ({
    pathname: "/(opencode)/settings/[section]",
    params: { section },
  }) as const;

export const piSettingsSectionPath = (section: string) =>
  ({ pathname: "/pi/settings/[section]", params: { section } }) as const;
