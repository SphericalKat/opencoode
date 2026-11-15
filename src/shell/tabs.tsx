import type { SessionInfo } from "@opencode/client";
import { useCallback } from "react";
import { View } from "react-native";

import { MotionScreen } from "../components/motion";
import { OpenCodeLogo } from "../components/open-code-logo";
import { BodyText, Heading } from "../components/ui";
import type { ChatBackend } from "../lib/chat-backend";
import type { Connection } from "../lib/client";
import { useThemedStyles } from "../lib/theme";
import { ChatScreen } from "../screens/chat-screen";
import { SessionsScreen } from "../screens/sessions-screen";
import { SettingsScreen } from "../screens/settings-screen";
import { WorkspaceScreen } from "../screens/workspace-screen";
import {
  useSessionLocationStore,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import type { WorkspaceSection } from "../stores/session-location-store";
import { createStyles } from "./styles";
import type { ServerClient, SettingsSectionRequest } from "./types";

interface ChatColumnProps {
  active: Connection;
  betaHome: boolean;
  chatBackend: ChatBackend | null;
  connectionRevision: number;
  onOpenNavigation: () => void;
  onOpenSession: (id: string) => void;
  onOpenSettings: (section: "Models" | "Accounts") => void;
  onSessionChanged: () => void;
  onSessionInfo: (session: SessionInfo) => void;
  projectLabel: string;
  sessionID: string | null;
}

const ChatColumn = ({
  active,
  betaHome,
  chatBackend,
  connectionRevision,
  onOpenNavigation,
  onOpenSession,
  onOpenSettings,
  onSessionChanged,
  onSessionInfo,
  projectLabel,
  sessionID,
}: ChatColumnProps) => {
  const styles = useThemedStyles(createStyles);
  const tab = useSessionLocationStore((state) => state.tab);
  return (
    <View style={[styles.full, betaHome && styles.hidden]}>
      {sessionID && chatBackend ? (
        <ChatScreen
          key={`${active.id}:${connectionRevision}:${sessionID}`}
          backend={chatBackend}
          sessionID={sessionID}
          serverID={active.id}
          draftKey={`${active.id}:${sessionID}`}
          onSessionInfo={onSessionInfo}
          visible={tab === "sessions" && !betaHome}
          onOpenNavigation={onOpenNavigation}
          onSessionChanged={onSessionChanged}
          onOpenSession={onOpenSession}
          onOpenSettings={onOpenSettings}
        />
      ) : (
        <View style={styles.welcome}>
          <OpenCodeLogo width={160} />
          <Heading>Start a session</Heading>
          <BodyText muted style={styles.welcomeDetail}>
            Choose a conversation, or create a new session in {projectLabel}.
          </BodyText>
        </View>
      )}
    </View>
  );
};

interface SessionsTabProps extends ChatColumnProps {
  betaHomeProject: { directory: string; revision: number } | undefined;
  client: ServerClient;
  directory: string;
  onChooseDirectory: () => void;
  onNewSession: (directory: string) => void;
  onOpenSessionFromList: (id: string) => Promise<boolean>;
}

export const SessionsTab = ({
  betaHomeProject,
  client,
  directory,
  onChooseDirectory,
  onNewSession,
  onOpenNavigation,
  onOpenSessionFromList,
  ...chat
}: SessionsTabProps) => {
  const styles = useThemedStyles(createStyles);
  const { active, betaHome, connectionRevision, sessionID } = chat;
  const tab = useSessionLocationStore((state) => state.tab);
  const listHidden = !betaHome && !!sessionID;
  return (
    <MotionScreen
      visible={tab === "sessions"}
      style={[styles.full, styles.row, tab !== "sessions" && styles.hidden]}
    >
      <View style={[styles.full, listHidden && styles.hidden]}>
        <SessionsScreen
          key={`${active.id}:${connectionRevision}`}
          client={client}
          directory={directory}
          projectScope={betaHomeProject}
          onChooseDirectory={onChooseDirectory}
          onNewSession={onNewSession}
          onOpenSession={onOpenSessionFromList}
        />
      </View>
      {!!sessionID && (
        <ChatColumn {...chat} onOpenNavigation={onOpenNavigation} />
      )}
    </MotionScreen>
  );
};

interface WorkspaceTabProps {
  active: Connection;
  client: ServerClient;
  connectionRevision: number;
  directory: string;
  onAttachFile: (path: string, contextText?: string) => Promise<boolean>;
  onDirectoryChange: (directory: string) => void;
  onSectionChange: (section: WorkspaceSection) => void;
  sessionID: string | null;
}

export const WorkspaceTab = ({
  active,
  client,
  connectionRevision,
  directory,
  onAttachFile,
  onDirectoryChange,
  onSectionChange,
  sessionID,
}: WorkspaceTabProps) => {
  const styles = useThemedStyles(createStyles);
  const tab = useSessionLocationStore((state) => state.tab);
  const section = useSessionLocationStore((state) => state.workspaceSection);
  const mounted = useSessionLocationStore((state) => !!state.visited.workspace);
  if (!mounted) {
    return null;
  }
  return (
    <MotionScreen
      visible={tab === "workspace"}
      style={[styles.full, tab !== "workspace" && styles.hidden]}
    >
      <WorkspaceScreen
        key={`${active.id}:${connectionRevision}:${directory}`}
        client={client}
        connection={active}
        directory={directory}
        sessionID={sessionID ?? undefined}
        section={section}
        visible={tab === "workspace"}
        onDirectoryChange={onDirectoryChange}
        onSectionChange={onSectionChange}
        onAttachFile={onAttachFile}
      />
    </MotionScreen>
  );
};

interface SettingsTabProps {
  active: Connection;
  backLabel: string;
  client: ServerClient;
  connectionRevision: number;
  directory: string;
  onBack: () => void;
  onManageServers: () => void;
  onOpenNavigation: () => void;
  sectionRequest: SettingsSectionRequest | undefined;
}

export const SettingsTab = ({
  active,
  backLabel,
  client,
  connectionRevision,
  directory,
  onBack,
  onManageServers,
  onOpenNavigation,
  sectionRequest,
}: SettingsTabProps) => {
  const styles = useThemedStyles(createStyles);
  const locationApi = useSessionLocationStoreApi();
  const tab = useSessionLocationStore((state) => state.tab);
  const mounted = useSessionLocationStore((state) => !!state.visited.settings);
  const onBackStateChange = useCallback(
    (settingsCanGoBack: boolean) => locationApi.setState({ settingsCanGoBack }),
    [locationApi]
  );
  if (!mounted) {
    return null;
  }
  return (
    <MotionScreen
      visible={tab === "settings"}
      style={[styles.full, tab !== "settings" && styles.hidden]}
    >
      <SettingsScreen
        key={`${active.id}:${connectionRevision}:${directory}`}
        client={client}
        directory={directory}
        onManageServers={onManageServers}
        serverLabel={active.name}
        visible={tab === "settings"}
        onBackStateChange={onBackStateChange}
        onBack={onBack}
        backLabel={backLabel}
        onOpenNavigation={onOpenNavigation}
        sectionRequest={sectionRequest}
      />
    </MotionScreen>
  );
};
