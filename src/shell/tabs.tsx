import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback } from "react";
import { BackHandler, View } from "react-native";

import { OpenCodeLogo } from "../components/open-code-logo";
import { BodyText, Heading } from "../components/ui";
import { useThemedStyles } from "../lib/theme";
import { ChatScreen } from "../screens/chat-screen";
import { SessionsScreen } from "../screens/sessions-screen";
import { WorkspaceScreen } from "../screens/workspace-screen";
import { useChatUiStoreApi } from "../stores/chat-ui-store";
import {
  useSessionLocationStore,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import { workspaceSectionFromParam } from "./route-state";
import { useShellActions } from "./shell-actions";
import { createStyles } from "./styles";

const lastPathSegment = /[^/]+(?=\/*$)/u;

const ChatColumn = () => {
  const styles = useThemedStyles(createStyles);
  const {
    active,
    chatBackend,
    onOpenNavigation,
    onOpenSession,
    onOpenSettings,
    onSessionChanged,
    onSessionInfo,
  } = useShellActions();
  const betaHome = useSessionLocationStore((state) => state.betaHome);
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const projectLabel = lastPathSegment.exec(directory)?.[0] || "Project";
  return (
    <View style={[styles.full, betaHome && styles.hidden]}>
      {sessionID && chatBackend ? (
        <ChatScreen
          key={`${active.id}:${sessionID}`}
          backend={chatBackend}
          sessionID={sessionID}
          serverID={active.id}
          draftKey={`${active.id}:${sessionID}`}
          onSessionInfo={onSessionInfo}
          visible={!betaHome}
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

// The chat stays mounted under the session list. While this route has focus,
// Android back from an open chat returns to the list.
const useChatBackToHome = (onShowHome: () => void) => {
  const location = useSessionLocationStoreApi();
  const chatUi = useChatUiStoreApi();
  useFocusEffect(
    useCallback(() => {
      const back = BackHandler.addEventListener("hardwareBackPress", () => {
        const { betaHome, sessionID } = location.getState();
        if (!sessionID || betaHome || chatUi.getState().messageSelected) {
          return false;
        }
        onShowHome();
        return true;
      });
      return () => back.remove();
    }, [chatUi, location, onShowHome])
  );
};

export const SessionsTab = () => {
  const styles = useThemedStyles(createStyles);
  const {
    active,
    client,
    onChooseDirectory,
    onCreateSession,
    onOpenSessionFromList,
    onShowHome,
  } = useShellActions();
  const betaHome = useSessionLocationStore((state) => state.betaHome);
  const betaHomeProject = useSessionLocationStore(
    (state) => state.betaHomeProject
  );
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const listHidden = !betaHome && !!sessionID;
  useChatBackToHome(onShowHome);
  return (
    <View style={[styles.full, styles.row]}>
      <View style={[styles.full, listHidden && styles.hidden]}>
        <SessionsScreen
          key={active.id}
          client={client}
          directory={directory}
          projectScope={betaHomeProject}
          onChooseDirectory={onChooseDirectory}
          onNewSession={onCreateSession}
          onOpenSession={onOpenSessionFromList}
        />
      </View>
      {!!sessionID && <ChatColumn />}
    </View>
  );
};

interface WorkspaceTabProps {
  section: string | string[] | undefined;
}

export const WorkspaceTab = ({ section }: WorkspaceTabProps) => {
  const styles = useThemedStyles(createStyles);
  const focused = useIsFocused();
  const { active, client, onAttachFile, onChangeDirectory, onSelectPane } =
    useShellActions();
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  return (
    <View style={styles.full}>
      <WorkspaceScreen
        key={`${active.id}:${directory}`}
        client={client}
        connection={active}
        directory={directory}
        sessionID={sessionID ?? undefined}
        section={workspaceSectionFromParam(section)}
        visible={focused}
        onDirectoryChange={onChangeDirectory}
        onSectionChange={onSelectPane}
        onAttachFile={onAttachFile}
      />
    </View>
  );
};
