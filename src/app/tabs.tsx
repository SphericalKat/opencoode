import type { SessionInfo } from "@opencode/client";
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
import type { WorkspaceSection } from "../screens/workspace-screen";
import { createStyles } from "./styles";
import type { ServerClient, SessionPanelRequest, Tab } from "./types";

interface ChatColumnProps {
  active: Connection;
  attachmentContext: string | undefined;
  attachmentPath: string | undefined;
  betaHome: boolean;
  chatBackend: ChatBackend | null;
  connectionRevision: number;
  onAttachmentConsumed: () => void;
  onOpenNavigation: () => void;
  onOpenSession: (id: string) => void;
  onSelectionChange: (selected: boolean) => void;
  onSessionChanged: () => void;
  onSessionInfo: (session: SessionInfo) => void;
  projectLabel: string;
  sessionID: string | null;
  sessionPanelRequest: SessionPanelRequest | undefined;
  tab: Tab;
}

const ChatColumn = ({
  active,
  attachmentContext,
  attachmentPath,
  betaHome,
  chatBackend,
  connectionRevision,
  onAttachmentConsumed,
  onOpenNavigation,
  onOpenSession,
  onSelectionChange,
  onSessionChanged,
  onSessionInfo,
  projectLabel,
  sessionID,
  sessionPanelRequest,
  tab,
}: ChatColumnProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.full, betaHome && styles.hidden]}>
      {sessionID && chatBackend ? (
        <ChatScreen
          key={`${active.id}:${connectionRevision}:${sessionID}`}
          backend={chatBackend}
          sessionID={sessionID}
          serverID={active.id}
          draftKey={`${active.id}:${sessionID}`}
          onSelectionChange={onSelectionChange}
          onSessionInfo={onSessionInfo}
          sessionPanelRequest={sessionPanelRequest}
          visible={tab === "sessions" && !betaHome}
          onOpenNavigation={onOpenNavigation}
          onSessionChanged={onSessionChanged}
          onOpenSession={onOpenSession}
          attachmentPath={attachmentPath}
          attachmentContext={attachmentContext}
          onAttachmentConsumed={onAttachmentConsumed}
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
  revision: number;
}

export const SessionsTab = ({
  betaHomeProject,
  client,
  directory,
  onChooseDirectory,
  onNewSession,
  onOpenNavigation,
  onOpenSessionFromList,
  revision,
  ...chat
}: SessionsTabProps) => {
  const styles = useThemedStyles(createStyles);
  const { active, betaHome, connectionRevision, sessionID, tab } = chat;
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
          selectedSessionID={sessionID ?? undefined}
          revision={revision}
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
  mounted: boolean;
  onAttachFile: (path: string, contextText?: string) => Promise<boolean>;
  onDirectoryChange: (directory: string) => void;
  section: WorkspaceSection;
  sessionID: string | null;
  tab: Tab;
}

export const WorkspaceTab = ({
  active,
  client,
  connectionRevision,
  directory,
  mounted,
  onAttachFile,
  onDirectoryChange,
  section,
  sessionID,
  tab,
}: WorkspaceTabProps) => {
  const styles = useThemedStyles(createStyles);
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
  mounted: boolean;
  onBack: () => void;
  onBackStateChange: (canGoBack: boolean) => void;
  onManageServers: () => void;
  onOpenNavigation: () => void;
  tab: Tab;
}

export const SettingsTab = ({
  active,
  backLabel,
  client,
  connectionRevision,
  directory,
  mounted,
  onBack,
  onBackStateChange,
  onManageServers,
  onOpenNavigation,
  tab,
}: SettingsTabProps) => {
  const styles = useThemedStyles(createStyles);
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
      />
    </MotionScreen>
  );
};
