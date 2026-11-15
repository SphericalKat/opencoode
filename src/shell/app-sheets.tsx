import type { ReactNode } from "react";
import { Linking } from "react-native";

import type { SessionPane } from "../components/beta-navigation";
import { useConnectionStore } from "../stores/connection-store";
import { useSessionTabsStore } from "../stores/session-tabs-store";
import { useSheetStore, useSheetStoreApi } from "../stores/sheet-store";
import { BetaSheets, ProjectsSheet, ServersSheet } from "./sheets";
import type { ServerClient } from "./types";

const HELP_URL = "https://opencode.ai/v2/docs/";

interface AppSheetsProps {
  afterBetaMenu: (action: () => void) => void;
  afterBetaNavigation: (action: () => void) => void;
  client: ServerClient | null;
  currentTabID: string | undefined;
  directory: string;
  onCloseTab: (id: string) => void;
  onCreateSession: () => void;
  onDismissNavigation: () => void;
  onOpenDirectory: (value: string) => void;
  onOpenServers: () => void;
  onOpenSession: (id: string) => void;
  onOpenSettings: () => void;
  onRequestPanel: (panel: "stats" | "actions") => void;
  onResumeSheets: () => void;
  onShowHome: () => void;
  onView: (pane: SessionPane) => void;
  selectedPane: SessionPane;
  serverForm: ReactNode;
}

const useSheetActions = () => {
  const sheetApi = useSheetStoreApi();
  return {
    handleChangeProjectValue: (newDirectory: string) =>
      sheetApi.setState({ newDirectory, projectError: null }),
    handleCloseMore: () => sheetApi.setState({ moreOpen: false }),
    handleCloseNavigation: () => sheetApi.setState({ navigationOpen: false }),
    handleCloseProjects: () => sheetApi.setState({ projectsOpen: false }),
    handleCloseServers: () =>
      sheetApi.setState((state) => ({
        serverSheetRequest: state.serverSheetRequest + 1,
        serversOpen: false,
      })),
    handleDismissMore: () => {
      const action = sheetApi.getState().pendingAction;
      sheetApi.setState({ pendingAction: null });
      action?.();
    },
  };
};

export const AppSheets = ({
  afterBetaMenu,
  afterBetaNavigation,
  client,
  currentTabID,
  directory,
  onCloseTab,
  onCreateSession,
  onDismissNavigation,
  onOpenDirectory,
  onOpenServers,
  onOpenSession,
  onOpenSettings,
  onRequestPanel,
  onResumeSheets,
  onShowHome,
  onView,
  selectedPane,
  serverForm,
}: AppSheetsProps) => {
  const {
    handleChangeProjectValue,
    handleCloseMore,
    handleCloseNavigation,
    handleCloseProjects,
    handleCloseServers,
    handleDismissMore,
  } = useSheetActions();
  const active = useConnectionStore((state) => state.active);
  const connectionRevision = useConnectionStore(
    (state) => state.connectionRevision
  );
  const unavailableID = useConnectionStore((state) => state.unavailableID);
  const openTabs = useSessionTabsStore((state) => state.openTabs);
  const newDirectory = useSheetStore((state) => state.newDirectory);
  const projectBusy = useSheetStore((state) => state.projectBusy);
  const projectError = useSheetStore((state) => state.projectError);
  const projects = useSheetStore((state) => state.projects);
  const projectsOpen = useSheetStore((state) => state.projectsOpen);
  const serversOpen = useSheetStore((state) => state.serversOpen);
  return (
    <>
      <BetaSheets
        active={active}
        currentTabID={currentTabID}
        onCloseMore={handleCloseMore}
        onCloseNavigation={handleCloseNavigation}
        onCloseTab={onCloseTab}
        onDetails={() => onRequestPanel("actions")}
        onDismissMore={handleDismissMore}
        onDismissNavigation={onDismissNavigation}
        onHelp={() =>
          afterBetaNavigation(() => {
            void Linking.openURL(HELP_URL);
          })
        }
        onHome={() => afterBetaNavigation(onShowHome)}
        onNew={() => afterBetaNavigation(onCreateSession)}
        onSelect={onOpenSession}
        onServer={() => afterBetaNavigation(onOpenServers)}
        onSettings={() => afterBetaNavigation(onOpenSettings)}
        onUsage={() => onRequestPanel("stats")}
        onView={(pane) => afterBetaMenu(() => onView(pane))}
        openTabs={openTabs}
        selectedPane={selectedPane}
      />
      <ServersSheet
        active={active}
        open={serversOpen}
        unavailableID={unavailableID}
        onClose={handleCloseServers}
        onDismiss={onResumeSheets}
      >
        {serverForm}
      </ServersSheet>
      <ProjectsSheet
        active={active}
        busy={projectBusy}
        client={client}
        connectionRevision={connectionRevision}
        directory={directory}
        error={projectError}
        onChangeValue={handleChangeProjectValue}
        onClose={handleCloseProjects}
        onOpenDirectory={onOpenDirectory}
        open={projectsOpen}
        projects={projects}
        value={newDirectory}
      />
    </>
  );
};
