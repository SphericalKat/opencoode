import type {
  SessionPane,
  SessionTabItem,
} from "../components/beta-navigation";
import type { WorkspaceSection } from "../lib/routes";
import { workspaceSectionFromParam } from "./route-state";
import type { Tab } from "./types";

const lastPathSegment = /[^/]+(?=\/*$)/u;

const findCurrentOpenTab = (
  openTabs: SessionTabItem[],
  sessionID: string | null,
  directory: string
): SessionTabItem | undefined =>
  sessionID
    ? (openTabs.find((item) => item.id === sessionID) ?? {
        directory,
        id: sessionID,
        title: "Session",
      })
    : undefined;

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
    workspaceSection: workspaceSectionFromParam(section),
  };
};

export interface ShellView {
  currentOpenTab: SessionTabItem | undefined;
  projectLabel: string;
  returnLabel: string;
  selectedPane: SessionPane;
}

export interface ShellViewInput {
  betaHome: boolean;
  directory: string;
  openTabs: SessionTabItem[];
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
