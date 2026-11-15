import { useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OpenCodeLogo } from "../components/open-code-logo";
import { Busy, BodyText } from "../components/ui";
import { LiveStoreProvider } from "../lib/live-store";
import { OpenCodeBus } from "../lib/live/opencode-bus";
import { ServerScopeProvider } from "../lib/server-scope";
import { useSheetCoordinator } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import { useUnsavedGuard } from "../lib/unsaved";
import { PiWorkspace } from "../screens/pi-workspace";
import { useAppLifecycleStore } from "../stores/app-lifecycle-store";
import { useChatUiStoreApi } from "../stores/chat-ui-store";
import {
  emptyConnectionForm,
  useConnectionStore,
  useConnectionStoreApi,
} from "../stores/connection-store";
import {
  useSessionLocationStore,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import { useSessionTabsStore } from "../stores/session-tabs-store";
import { useSheetStoreApi } from "../stores/sheet-store";
import { AppSheets } from "./app-sheets";
import { ConnectionProbe } from "./connection-probe";
import { Onboarding } from "./onboarding";
import { ServerForm } from "./server-form";
import { ShellContent } from "./shell-content";
import { deriveShellView } from "./shell-view";
import { createStyles } from "./styles";
import type { SettingsSectionRequest } from "./types";
import { useClientBindings } from "./use-client-bindings";
import { useConnection } from "./use-connection";
import { useConnectionRecovery } from "./use-connection-recovery";
import { useNavigationSheets } from "./use-navigation-sheets";
import { useSessionNavigation } from "./use-session-navigation";
import { useWorkspaceActions } from "./use-workspace-actions";

const BootScreen = () => {
  const styles = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.boot}>
        <OpenCodeLogo width={160} />
        <Busy />
        <BodyText muted>Restoring your workspace</BodyText>
      </View>
    </SafeAreaView>
  );
};

export const MobileApp = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const confirmNavigation = useUnsavedGuard();
  const { suspendSheets, resumeSheets } = useSheetCoordinator();
  const connectionApi = useConnectionStoreApi();
  const sheetApi = useSheetStoreApi();
  const locationApi = useSessionLocationStoreApi();
  const chatUiApi = useChatUiStoreApi();
  const active = useConnectionStore((state) => state.active);
  const booting = useConnectionStore((state) => state.booting);
  const connecting = useConnectionStore((state) => state.connecting);
  const connectionRevision = useConnectionStore(
    (state) => state.connectionRevision
  );
  const foreground = useAppLifecycleStore((state) => state.foreground);
  const betaHome = useSessionLocationStore((state) => state.betaHome);
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const tab = useSessionLocationStore((state) => state.tab);
  const workspaceSection = useSessionLocationStore(
    (state) => state.workspaceSection
  );
  const openTabs = useSessionTabsStore((state) => state.openTabs);
  const [pairingLink, setPairingLink] = useState<string | null>(null);
  const [flowRevision, setFlowRevision] = useState(0);
  const [settingsRequest, setSettingsRequest] = useState<
    SettingsSectionRequest | undefined
  >();
  const settingsRequestID = useRef(0);

  const { chatBackend, client, onPiConnectionLost, recordSessionInfo } =
    useClientBindings();
  const { selectServer } = useConnection({ confirmNavigation });
  const {
    afterBetaNavigation,
    changeDirectory,
    changeTab,
    closeBetaTab,
    createBetaSession,
    openBetaPane,
    openSession,
    showBetaHome,
    syncSelectedLocation,
  } = useSessionNavigation({ client, confirmNavigation, recordSessionInfo });
  const {
    onNavigationDismissed,
    openNavigation,
    openProjects,
    showNavigationSheet,
  } = useNavigationSheets({ client, resumeSheets, suspendSheets });
  const { onProbeFailure, onProbeHealthy } = useConnectionRecovery({
    resumeSheets,
    showNavigationSheet,
  });
  const { attachFile, hiddenConnections, openDirectory, removeConnection } =
    useWorkspaceActions({
      changeDirectory,
      client,
      confirmNavigation,
      syncSelectedLocation,
    });

  const view = deriveShellView({
    betaHome,
    directory,
    openTabs,
    sessionID,
    tab,
    workspaceSection,
  });
  const framed = tab !== "settings";

  const afterBetaMenu = (action: () => void) => {
    const owner = connectionApi.getState().active;
    const request = connectionApi.getState().epoch;
    sheetApi.setState({
      moreOpen: false,
      pendingAction: () => {
        const current = connectionApi.getState();
        if (owner === current.active && request === current.epoch) {
          action();
        }
      },
    });
  };
  const openSettingsSection = (section: SettingsSectionRequest["section"]) => {
    settingsRequestID.current += 1;
    setSettingsRequest({ id: settingsRequestID.current, section });
    void changeTab("settings");
  };
  const requestSessionPanel = (panel: "stats" | "actions") => {
    if (!sessionID) {
      return;
    }
    afterBetaMenu(() => {
      locationApi.setState({ tab: "sessions" });
      const panelRequestID = chatUiApi.getState().panelRequestID + 1;
      chatUiApi.setState({
        panelRequest: { id: panelRequestID, panel, sessionID },
        panelRequestID,
      });
    });
  };
  const openServers = () => {
    connectionApi.setState({
      connectionError: null,
      form: emptyConnectionForm(),
    });
    setPairingLink(null);
    setFlowRevision((value) => value + 1);
    // Use the latest coordinator because queued tab actions retain stale navigation state.
    sheetApi.getState().showServerSheet();
  };
  const openProjectsSheet = () => {
    void openProjects();
  };

  const serverForm = (
    <ServerForm
      flowRevision={flowRevision}
      hiddenConnections={hiddenConnections}
      pairingLink={pairingLink}
      onPairingLinkConsumed={() => setPairingLink(null)}
      onRemove={removeConnection}
      selectServer={selectServer}
    />
  );

  if (booting) {
    return <BootScreen />;
  }

  return (
    <ServerScopeProvider scope={active?.id ?? null}>
      <LiveStoreProvider>
        <SafeAreaView
          style={[styles.safe, framed && { backgroundColor: colors.frame }]}
          edges={["top", "left", "right", "bottom"]}
        >
          {active?.backend === "pi" && (
            <PiWorkspace
              key={`${active.id}:${connectionRevision}`}
              connection={active}
              foreground={foreground && !connecting}
              onManageServers={openServers}
              onConnectionLost={onPiConnectionLost}
            />
          )}
          {!active && <Onboarding>{serverForm}</Onboarding>}
          {client && active && foreground && (
            <OpenCodeBus
              key={`${active.id}:${connectionRevision}`}
              client={client}
              scope={active.id}
              onConnectionLost={(cause) => onProbeFailure(active, cause)}
            />
          )}
          {client && active && (
            <ConnectionProbe
              key={connectionRevision}
              active={active}
              client={client}
              enabled={foreground && !connecting}
              onFailure={onProbeFailure}
              onHealthy={onProbeHealthy}
            />
          )}
          {client && active && (
            <ShellContent
              active={active}
              chatBackend={chatBackend}
              client={client}
              onAttachFile={attachFile}
              onChangeDirectory={changeDirectory}
              onChooseDirectory={openProjectsSheet}
              onCreateSession={(target) => {
                void createBetaSession(target);
              }}
              onManageServers={openServers}
              onOpenNavigation={openNavigation}
              onOpenSession={(id) => {
                void openSession(id);
              }}
              onOpenSessionFromList={openSession}
              onOpenSettings={openSettingsSection}
              onRetryLocation={() => {
                void syncSelectedLocation();
              }}
              onReturn={() => {
                void changeTab("sessions");
              }}
              onSelectPane={openBetaPane}
              onSessionChanged={() => {
                void syncSelectedLocation();
              }}
              onSessionInfo={recordSessionInfo}
              settingsRequest={settingsRequest}
              view={view}
            />
          )}
          <AppSheets
            afterBetaMenu={afterBetaMenu}
            afterBetaNavigation={afterBetaNavigation}
            client={client}
            currentTabID={view.currentOpenTab?.id}
            directory={directory}
            onCloseTab={(id) => {
              void closeBetaTab(id);
            }}
            onCreateSession={() => {
              void createBetaSession();
            }}
            onDismissNavigation={onNavigationDismissed}
            onOpenDirectory={(value) => {
              void openDirectory(value);
            }}
            onOpenServers={openServers}
            onOpenSession={(id) => {
              void openSession(id);
            }}
            onOpenSettings={() => {
              void changeTab("settings");
            }}
            onRequestPanel={requestSessionPanel}
            onResumeSheets={resumeSheets}
            onShowHome={showBetaHome}
            onView={openBetaPane}
            selectedPane={view.selectedPane}
            serverForm={serverForm}
          />
        </SafeAreaView>
      </LiveStoreProvider>
    </ServerScopeProvider>
  );
};
