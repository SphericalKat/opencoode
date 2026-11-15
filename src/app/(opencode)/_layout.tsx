import { useRouter } from "expo-router";
import { useEffect, useMemo } from "react";
import { BackHandler } from "react-native";

import { OpenCodeBus } from "../../lib/live/opencode-bus";
import { settingsSectionPath } from "../../lib/routes";
import { useSheetCoordinator } from "../../lib/sheets";
import { useUnsavedGuard } from "../../lib/unsaved";
import { SettingsHostContext } from "../../screens/settings-layout";
import { AppSheets } from "../../shell/app-sheets";
import { ConnectionProbe } from "../../shell/connection-probe";
import { ShellActionsProvider } from "../../shell/shell-actions";
import { ShellContent } from "../../shell/shell-content";
import { useClientBindings } from "../../shell/use-client-bindings";
import { useConnectionRecovery } from "../../shell/use-connection-recovery";
import { useNavigationSheets } from "../../shell/use-navigation-sheets";
import { useOpenServers } from "../../shell/use-open-servers";
import {
  useCurrentTab,
  useSessionNavigation,
} from "../../shell/use-session-navigation";
import { useShellView } from "../../shell/use-shell-view";
import { useWorkspaceActions } from "../../shell/use-workspace-actions";
import { useAppLifecycleStore } from "../../stores/app-lifecycle-store";
import { useChatUiStoreApi } from "../../stores/chat-ui-store";
import {
  useConnectionStore,
  useConnectionStoreApi,
} from "../../stores/connection-store";
import { useSessionLocationStore } from "../../stores/session-location-store";
import { useSheetStoreApi } from "../../stores/sheet-store";

type ChangeTab = (next: "sessions" | "settings") => Promise<void>;

const leaveSettings = async (
  confirm: () => Promise<boolean>,
  changeTab: ChangeTab
) => {
  if (await confirm()) {
    await changeTab("sessions");
  }
};

const openSettingsSection = async (
  section: "Models" | "Accounts",
  changeTab: ChangeTab,
  router: ReturnType<typeof useRouter>
) => {
  await changeTab("settings");
  router.navigate(settingsSectionPath(section));
};

const OpenCodeLayout = () => {
  const confirmNavigation = useUnsavedGuard();
  const { suspendSheets, resumeSheets } = useSheetCoordinator();
  const connectionApi = useConnectionStoreApi();
  const sheetApi = useSheetStoreApi();
  const chatUiApi = useChatUiStoreApi();
  const active = useConnectionStore((state) => state.active);
  const connecting = useConnectionStore((state) => state.connecting);
  const foreground = useAppLifecycleStore((state) => state.foreground);
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const view = useShellView();
  const openServers = useOpenServers();

  const router = useRouter();
  const confirmSettingsExit = useUnsavedGuard(`configuration:${directory}`);
  const { chatBackend, client, recordSessionInfo } = useClientBindings();
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
  const { attachFile, openDirectory } = useWorkspaceActions({
    changeDirectory,
    client,
    syncSelectedLocation,
  });

  const currentTab = useCurrentTab();
  useEffect(() => {
    if (currentTab !== "settings") {
      return;
    }
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      void leaveSettings(confirmSettingsExit, changeTab);
      return true;
    });
    return () => back.remove();
  }, [changeTab, confirmSettingsExit, currentTab]);

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
  const requestSessionPanel = (panel: "stats" | "actions") => {
    if (!sessionID) {
      return;
    }
    afterBetaMenu(() => {
      void changeTab("sessions");
      const panelRequestID = chatUiApi.getState().panelRequestID + 1;
      chatUiApi.setState({
        panelRequest: { id: panelRequestID, panel, sessionID },
        panelRequestID,
      });
    });
  };

  const shellActions = useMemo(
    () =>
      client && active
        ? {
            active,
            chatBackend,
            client,
            onAttachFile: attachFile,
            onChangeDirectory: changeDirectory,
            onChooseDirectory: () => {
              void openProjects();
            },
            onCreateSession: (target: string) => {
              void createBetaSession(target);
            },
            onOpenNavigation: openNavigation,
            onOpenSession: (id: string) => {
              void openSession(id);
            },
            onOpenSessionFromList: openSession,
            onOpenSettings: (section: "Models" | "Accounts") => {
              void openSettingsSection(section, changeTab, router);
            },
            onSelectPane: openBetaPane,
            onSessionChanged: () => {
              void syncSelectedLocation();
            },
            onSessionInfo: recordSessionInfo,
            onShowHome: showBetaHome,
          }
        : null,
    [
      active,
      attachFile,
      changeDirectory,
      chatBackend,
      client,
      createBetaSession,
      openBetaPane,
      openNavigation,
      openProjects,
      openSession,
      changeTab,
      router,
      recordSessionInfo,
      showBetaHome,
      syncSelectedLocation,
    ]
  );
  const settingsHost = useMemo(
    () => ({
      backLabel: view.returnLabel,
      client: client ?? undefined,
      directory,
      onBack: () => {
        void leaveSettings(confirmSettingsExit, changeTab);
      },
      onManageServers: openServers,
      onOpenNavigation: openNavigation,
    }),
    [
      changeTab,
      client,
      confirmSettingsExit,
      directory,
      openNavigation,
      openServers,
      view.returnLabel,
    ]
  );
  if (!client || !active || !shellActions) {
    return null;
  }
  return (
    <ShellActionsProvider value={shellActions}>
      <SettingsHostContext.Provider value={settingsHost}>
        {foreground && (
          <OpenCodeBus
            key={active.id}
            client={client}
            scope={active.id}
            onConnectionLost={(cause) => onProbeFailure(active, cause)}
          />
        )}
        <ConnectionProbe
          active={active}
          client={client}
          enabled={foreground && !connecting}
          onFailure={onProbeFailure}
          onHealthy={onProbeHealthy}
        />
        <ShellContent
          onChooseDirectory={() => {
            void openProjects();
          }}
          onOpenNavigation={openNavigation}
          onRetryLocation={() => {
            void syncSelectedLocation();
          }}
          onSelectPane={openBetaPane}
          view={view}
        />
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
          onShowHome={showBetaHome}
          onView={openBetaPane}
          selectedPane={view.selectedPane}
        />
      </SettingsHostContext.Provider>
    </ShellActionsProvider>
  );
};

export default OpenCodeLayout;
