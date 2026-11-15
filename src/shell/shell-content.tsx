import type { SessionInfo } from "@opencode/client";
import { Keyboard } from "react-native";

import type { SessionPane } from "../components/beta-navigation";
import type { ChatBackend } from "../lib/chat-backend";
import type { Connection } from "../lib/client";
import { useConnectionStore } from "../stores/connection-store";
import { useSessionLocationStore } from "../stores/session-location-store";
import { useSheetStoreApi } from "../stores/sheet-store";
import { ShellFrame } from "./shell-frame";
import type { ShellView } from "./shell-view";
import { SessionsTab, SettingsTab, WorkspaceTab } from "./tabs";
import type { ServerClient, SettingsSectionRequest } from "./types";

interface ShellContentProps {
  active: Connection;
  chatBackend: ChatBackend | null;
  client: ServerClient;
  onAttachFile: (path: string, contextText?: string) => Promise<boolean>;
  onChangeDirectory: (directory: string) => void;
  onChooseDirectory: () => void;
  onCreateSession: (directory: string) => void;
  onManageServers: () => void;
  onOpenNavigation: () => void;
  onOpenSession: (id: string) => void;
  onOpenSessionFromList: (id: string) => Promise<boolean>;
  onOpenSettings: (section: "Models" | "Accounts") => void;
  onRetryLocation: () => void;
  onReturn: () => void;
  onSelectPane: (pane: SessionPane) => void;
  onSessionChanged: () => void;
  onSessionInfo: (session: SessionInfo) => void;
  settingsRequest: SettingsSectionRequest | undefined;
  view: ShellView;
}

export const ShellContent = ({
  active,
  chatBackend,
  client,
  onAttachFile,
  onChangeDirectory,
  onChooseDirectory,
  onCreateSession,
  onManageServers,
  onOpenNavigation,
  onOpenSession,
  onOpenSessionFromList,
  onOpenSettings,
  onRetryLocation,
  onReturn,
  onSelectPane,
  onSessionChanged,
  onSessionInfo,
  settingsRequest,
  view,
}: ShellContentProps) => {
  const sheetApi = useSheetStoreApi();
  const connectionRevision = useConnectionStore(
    (state) => state.connectionRevision
  );
  const betaHome = useSessionLocationStore((state) => state.betaHome);
  const betaHomeProject = useSessionLocationStore(
    (state) => state.betaHomeProject
  );
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const { currentOpenTab, projectLabel, returnLabel, selectedPane } = view;
  return (
    <ShellFrame
      currentOpenTab={currentOpenTab}
      onMore={() => {
        Keyboard.dismiss();
        sheetApi.setState({ moreOpen: true });
      }}
      onOpenNavigation={onOpenNavigation}
      onProject={onChooseDirectory}
      onRetryLocation={onRetryLocation}
      onSelectPane={onSelectPane}
      selectedPane={selectedPane}
    >
      <SessionsTab
        active={active}
        betaHome={betaHome}
        betaHomeProject={betaHomeProject}
        chatBackend={chatBackend}
        client={client}
        connectionRevision={connectionRevision}
        directory={directory}
        onChooseDirectory={onChooseDirectory}
        onNewSession={onCreateSession}
        onOpenNavigation={onOpenNavigation}
        onOpenSession={onOpenSession}
        onOpenSessionFromList={onOpenSessionFromList}
        onOpenSettings={onOpenSettings}
        onSessionChanged={onSessionChanged}
        onSessionInfo={onSessionInfo}
        projectLabel={projectLabel}
        sessionID={sessionID}
      />
      <WorkspaceTab
        active={active}
        client={client}
        connectionRevision={connectionRevision}
        directory={directory}
        onAttachFile={onAttachFile}
        onDirectoryChange={onChangeDirectory}
        onSectionChange={onSelectPane}
        sessionID={sessionID}
      />
      <SettingsTab
        active={active}
        backLabel={returnLabel}
        client={client}
        connectionRevision={connectionRevision}
        directory={directory}
        onBack={onReturn}
        onManageServers={onManageServers}
        onOpenNavigation={onOpenNavigation}
        sectionRequest={settingsRequest}
      />
    </ShellFrame>
  );
};
