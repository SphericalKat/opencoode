import type { SessionPane } from "../components/beta-navigation";
import type { WorkspaceSection } from "../stores/session-location-store";
import type { OpenSessionTab } from "../stores/session-tabs-store";
import type { Tab } from "./types";

const lastPathSegment = /[^/]+(?=\/*$)/u;

const findCurrentOpenTab = (
  openTabs: OpenSessionTab[],
  sessionID: string | null,
  directory: string
): OpenSessionTab | undefined =>
  sessionID
    ? (openTabs.find((item) => item.id === sessionID) ?? {
        directory,
        id: sessionID,
        title: "Session",
      })
    : undefined;

const workspaceSections: Record<string, WorkspaceSection> = {
  changes: "Changes",
  files: "Files",
  terminal: "Terminal",
  worktrees: "Worktrees",
};

export interface ShellRoute {
  // False on the settings routes and the boot screen, which draw no frame.
  framed: boolean;
  tab: Tab;
  workspaceSection: WorkspaceSection;
}

// Reads the selected tab and workspace pane from the route segments and the
// `section` search parameter of the focused route.
export const parseShellRoute = (
  segments: readonly string[],
  section: string | undefined
): ShellRoute => {
  const inOpenCode = segments[0] === "(opencode)";
  let tab: Tab = "sessions";
  if (inOpenCode && segments[1] === "workspace") {
    tab = "workspace";
  } else if (inOpenCode && segments[1] === "settings") {
    tab = "settings";
  }
  return {
    framed: tab !== "settings" && segments[0] !== "restoring",
    tab,
    workspaceSection: workspaceSections[section ?? ""] ?? "Changes",
  };
};

export interface ShellView {
  currentOpenTab: OpenSessionTab | undefined;
  projectLabel: string;
  returnLabel: string;
  selectedPane: SessionPane;
}

export interface ShellViewInput {
  betaHome: boolean;
  directory: string;
  openTabs: OpenSessionTab[];
  sessionID: string | null;
  tab: Tab;
  workspaceSection: WorkspaceSection;
}

export const deriveShellView = ({
  betaHome,
  directory,
  openTabs,
  sessionID,
  tab,
  workspaceSection,
}: ShellViewInput): ShellView => ({
  currentOpenTab:
    !betaHome && tab !== "settings"
      ? findCurrentOpenTab(openTabs, sessionID, directory)
      : undefined,
  projectLabel: lastPathSegment.exec(directory)?.[0] || "Project",
  returnLabel: sessionID ? "Chat" : "Sessions",
  selectedPane: tab === "workspace" ? workspaceSection : "Session",
});
