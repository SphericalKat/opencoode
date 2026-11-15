import type {
  OpenSessionTab,
  SessionPane,
} from "../components/beta-navigation";
import type { WorkspaceSection } from "../screens/workspace-screen";
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
