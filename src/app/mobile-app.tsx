import { Keyboard, Linking, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ConnectionFlow } from "../components/connection-flow";
import { OpenCodeLogo } from "../components/open-code-logo";
import { Busy, BodyText } from "../components/ui";
import { useBetaLayout } from "../lib/beta-layout";
import { useSheetCoordinator } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import { useUnsavedGuard } from "../lib/unsaved";
import { PiWorkspace } from "../screens/pi-workspace";
import { ConnectionProbe } from "./connection-probe";
import { flowError } from "./connection-utils";
import { NavigationPanel } from "./navigation-panel";
import { Onboarding } from "./onboarding";
import {
  BetaSheets,
  NavigationDrawer,
  ProjectsSheet,
  ServersSheet,
} from "./sheets";
import { ShellFrame } from "./shell-frame";
import { deriveShellView } from "./shell-view";
import { createStyles } from "./styles";
import { SessionsTab, SettingsTab, WorkspaceTab } from "./tabs";
import { useAppState } from "./use-app-state";
import { useClientBindings } from "./use-client-bindings";
import { useConnection } from "./use-connection";
import { useConnectionRecovery } from "./use-connection-recovery";
import { useNavigationSheets } from "./use-navigation-sheets";
import { useSessionNavigation } from "./use-session-navigation";
import { useWorkspaceActions } from "./use-workspace-actions";

export const MobileApp = () => {
  const { colors } = useTheme();
  const betaLayout = useBetaLayout();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const wide = width >= 920;
  const confirmNavigation = useUnsavedGuard();
  const { suspendSheets, resumeSheets } = useSheetCoordinator();
  const state = useAppState();
  const {
    active,
    activeRef,
    attachmentContext,
    attachmentPath,

    betaHome,
    betaHomeProject,
    betaMoreOpen,
    booting,
    connecting,
    connectionError,
    connectionRevision,
    connections,
    creatingSession,
    directory,
    epochRef,
    error,
    flowRevision,
    foreground,
    form,
    info,
    messageSelected,
    navigationOpen,
    newDirectory,
    openTabs,
    panelRequestIDRef,
    pairingLink,
    pendingBetaActionRef,
    pendingLocation,
    projectBusy,
    projectError,
    projects,
    projectsOpen,
    revision,
    serverSheetRequestRef,
    serversOpen,
    sessionID,
    sessionPanelRequest,
    setAttachmentContext,
    setAttachmentPath,
    setBetaMoreOpen,
    setConnectionError,
    setFlowRevision,
    setForm,
    setMessageSelected,
    setNavigationOpen,
    setNewDirectory,
    setPairingLink,
    setProjectError,
    setProjectsOpen,
    setRevision,
    setServersOpen,
    setSessionPanelRequest,
    setSettingsBackState,
    setTab,
    showServerSheetRef,
    tab,
    unavailableID,
    visited,
    workspaceSection,
  } = state;
  const { chatBackend, client, onPiConnectionLost, recordSessionInfo } =
    useClientBindings(state, { betaLayout });
  const { selectServer } = useConnection(state, { confirmNavigation });
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
  } = useSessionNavigation(state, {
    betaLayout,
    client,
    confirmNavigation,
    recordSessionInfo,
  });
  const {
    onNavigationDismissed,
    openNavigation,
    openProjects,
    showNavigationSheet,
  } = useNavigationSheets(state, {
    client,
    resumeSheets,
    suspendSheets,
    wide,
  });
  const { onProbeFailure, onProbeHealthy } = useConnectionRecovery(state, {
    resumeSheets,
    showNavigationSheet,
  });
  const { attachFile, openDirectory, removeConnection } = useWorkspaceActions(
    state,
    {
      changeDirectory,
      client,
      confirmNavigation,
      syncSelectedLocation,
    }
  );

  const serverForm = (
    <ConnectionFlow
      key={flowRevision}
      form={form}
      connections={connections}
      activeID={active?.id}
      unavailableID={unavailableID ?? undefined}
      connecting={connecting}
      error={flowError(connectionError, active, error)}
      pairingLink={pairingLink}
      onPairingLinkConsumed={() => setPairingLink(null)}
      onChangeForm={setForm}
      onClearError={() => setConnectionError(null)}
      onConnect={(connection, alternatives) =>
        selectServer(connection, undefined, alternatives, !!form.name.trim())
      }
      onRemove={removeConnection}
    />
  );

  const {
    currentOpenTab,
    projectLabel,
    returnLabel,
    selectedPane,
    showMessageSelection,
  } = deriveShellView({
    betaHome,
    directory,
    messageSelected,
    openTabs,
    sessionID,
    tab,
    workspaceSection,
  });
  const framed = betaLayout && tab !== "settings";
  const returnToSessions = () => {
    void changeTab("sessions");
  };
  const afterBetaMenu = (action: () => void) => {
    const owner = activeRef.current;
    const request = epochRef.current;
    pendingBetaActionRef.current = () => {
      if (owner === activeRef.current && request === epochRef.current) {
        action();
      }
    };
    setBetaMoreOpen(false);
  };
  const requestSessionPanel = (panel: "stats" | "actions") => {
    if (!sessionID) {
      return;
    }
    afterBetaMenu(() => {
      setTab("sessions");
      panelRequestIDRef.current += 1;
      setSessionPanelRequest({
        id: panelRequestIDRef.current,
        panel,
        sessionID,
      });
    });
  };
  const openServers = () => {
    setConnectionError(null);
    setForm({ id: "", name: "", token: "", url: "" });
    setPairingLink(null);
    setFlowRevision((value) => value + 1);
    // Use the latest coordinator because queued tab actions retain stale navigation state.
    showServerSheetRef.current();
  };
  const closeNavigation = () => setNavigationOpen(false);
  const navigation =
    client && active ? (
      <NavigationPanel
        active={active}
        client={client}
        connectionRevision={connectionRevision}
        directory={directory}
        info={info}
        onChangeTab={(next) => {
          void changeTab(next);
        }}
        onClose={closeNavigation}
        onOpenProjects={() => {
          void openProjects();
        }}
        onOpenServers={openServers}
        onOpenSession={openSession}
        projectLabel={projectLabel}
        revision={revision}
        sessionID={sessionID}
        tab={tab}
        wide={wide}
      />
    ) : null;
  const openNavigationUnlessWide = wide ? undefined : openNavigation;
  const bumpRevision = () => setRevision((value) => value + 1);

  if (booting) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.boot}>
          <OpenCodeLogo width={160} />
          <Busy />
          <BodyText muted>Restoring your workspace</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  return (
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
      {!active && <Onboarding betaLayout={betaLayout}>{serverForm}</Onboarding>}
      {client && active && (
        <ConnectionProbe
          key={connectionRevision}
          active={active}
          activeRef={activeRef}
          client={client}
          enabled={foreground && !connecting}
          epoch={epochRef}
          onFailure={onProbeFailure}
          onHealthy={onProbeHealthy}
        />
      )}
      {client && active && (
        <ShellFrame
          betaHome={betaHome}
          betaLayout={betaLayout}
          creatingSession={creatingSession}
          currentOpenTab={currentOpenTab}
          directory={directory}
          error={error}
          navigation={navigation}
          onMore={() => {
            Keyboard.dismiss();
            setBetaMoreOpen(true);
          }}
          onOpenNavigation={openNavigation}
          onProject={() => {
            void openProjects();
          }}
          onRetryLocation={() => {
            void syncSelectedLocation();
          }}
          onSelectPane={openBetaPane}
          openTabCount={openTabs.length}
          pendingLocation={pendingLocation}
          selectedPane={selectedPane}
          sessionID={sessionID}
          showMessageSelection={showMessageSelection}
          tab={tab}
          wide={wide}
        >
          <SessionsTab
            active={active}
            attachmentContext={attachmentContext}
            attachmentPath={attachmentPath}
            betaHome={betaHome}
            betaHomeProject={betaHomeProject}
            betaLayout={betaLayout}
            chatBackend={chatBackend}
            client={client}
            connectionRevision={connectionRevision}
            directory={directory}
            onAttachmentConsumed={() => {
              setAttachmentPath(undefined);
              setAttachmentContext(undefined);
            }}
            onChooseDirectory={() => {
              void openProjects();
            }}
            onNewSession={
              betaLayout
                ? (target) => {
                    void createBetaSession(target);
                  }
                : undefined
            }
            onOpenNavigation={openNavigationUnlessWide}
            onOpenSession={(id) => {
              void openSession(id);
              bumpRevision();
            }}
            onOpenSessionFromList={openSession}
            onSelectionChange={setMessageSelected}
            onSessionChanged={() => {
              bumpRevision();
              void syncSelectedLocation();
            }}
            onSessionInfo={recordSessionInfo}
            projectLabel={projectLabel}
            revision={revision}
            sessionID={sessionID}
            sessionPanelRequest={sessionPanelRequest}
            tab={tab}
            wide={wide}
          />
          <WorkspaceTab
            active={active}
            backLabel={returnLabel}
            betaLayout={betaLayout}
            client={client}
            connectionRevision={connectionRevision}
            directory={directory}
            mounted={!!visited.workspace}
            onAttachFile={attachFile}
            onBack={returnToSessions}
            onDirectoryChange={changeDirectory}
            onOpenNavigation={openNavigation}
            section={workspaceSection}
            sessionID={sessionID}
            tab={tab}
            wide={wide}
          />
          <SettingsTab
            active={active}
            backLabel={returnLabel}
            betaLayout={betaLayout}
            client={client}
            connectionRevision={connectionRevision}
            directory={directory}
            mounted={!!visited.settings}
            onBack={returnToSessions}
            onBackStateChange={setSettingsBackState}
            onManageServers={openServers}
            onOpenNavigation={openNavigation}
            tab={tab}
            wide={wide}
          />
        </ShellFrame>
      )}
      <NavigationDrawer
        active={active}
        betaLayout={betaLayout}
        onClose={closeNavigation}
        onDismiss={onNavigationDismissed}
        open={navigationOpen}
        wide={wide}
      >
        {navigation}
      </NavigationDrawer>
      <BetaSheets
        active={active}
        betaLayout={betaLayout}
        currentTabID={currentOpenTab?.id}
        moreOpen={betaMoreOpen}
        navigationOpen={navigationOpen}
        onCloseMore={() => setBetaMoreOpen(false)}
        onCloseNavigation={closeNavigation}
        onCloseTab={(id) => {
          void closeBetaTab(id);
        }}
        onDetails={() => requestSessionPanel("actions")}
        onDismissMore={() => {
          const action = pendingBetaActionRef.current;
          pendingBetaActionRef.current = null;
          action?.();
        }}
        onDismissNavigation={onNavigationDismissed}
        onHelp={() =>
          afterBetaNavigation(() => {
            void Linking.openURL("https://opencode.ai/v2/docs/");
          })
        }
        onHome={() => afterBetaNavigation(showBetaHome)}
        onNew={() =>
          afterBetaNavigation(() => {
            void createBetaSession();
          })
        }
        onSelect={(id) => {
          void openSession(id);
        }}
        onServer={() => afterBetaNavigation(openServers)}
        onSettings={() =>
          afterBetaNavigation(() => {
            void changeTab("settings");
          })
        }
        onUsage={() => requestSessionPanel("stats")}
        onView={(pane) => afterBetaMenu(() => openBetaPane(pane))}
        openTabs={openTabs}
        selectedPane={selectedPane}
      />
      <ServersSheet
        active={active}
        open={serversOpen}
        unavailableID={unavailableID}
        onClose={() => {
          serverSheetRequestRef.current += 1;
          setServersOpen(false);
        }}
        onDismiss={resumeSheets}
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
        onChangeValue={(value) => {
          setNewDirectory(value);
          setProjectError(null);
        }}
        onClose={() => setProjectsOpen(false)}
        onOpenDirectory={(value) => {
          void openDirectory(value);
        }}
        open={projectsOpen}
        projects={projects}
        value={newDirectory}
      />
    </SafeAreaView>
  );
};
