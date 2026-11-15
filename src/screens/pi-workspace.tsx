import type { SessionInfo } from "@opencode/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BackHandler, Keyboard, Linking, View } from "react-native";

import type { PiCommand } from "../../packages/pi-mobile/protocol";
import {
  BetaMoreSheet,
  BetaSessionNavigation,
  BetaTabsSheet,
  BetaTabStrip,
  SessionSurface,
} from "../components/beta-navigation";
import { Busy, ErrorNotice } from "../components/ui";
import { errorMessage } from "../lib/client";
import type { Connection } from "../lib/client";
import { LiveStoreProvider } from "../lib/live-store";
import { PiBus } from "../lib/live/pi-bus";
import { makePiChatBackend } from "../lib/pi-chat-backend";
import { createPiClient } from "../lib/pi-client";
import type { PiClient } from "../lib/pi-client";
import { piSessionsOptions } from "../lib/queries/pi";
import { useServerScope } from "../lib/server-scope";
import { useUnsavedGuard } from "../lib/unsaved";
import { useChatUiStore, useChatUiStoreApi } from "../stores/chat-ui-store";
import type { OpenSessionTab } from "../stores/session-tabs-store";
import { useSheetStore, useSheetStoreApi } from "../stores/sheet-store";
import { ChatScreen } from "./chat-screen";
import { SettingsScreen } from "./settings-screen";
import type { Section } from "./settings-screen";

interface Props {
  connection: Connection;
  onManageServers: () => void;
  onConnectionLost: (error: unknown) => void;
  foreground: boolean;
}
const settingsSections: Section[] = ["Look and feel", "Models"];

interface PiSheetsProps {
  client: PiClient;
  foreground: boolean;
  onDetails: () => void;
  onDismiss: () => void;
  onError: (error: string) => void;
  onHelp: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onServer: () => void;
  onSettings: () => void;
  selectedID: string | undefined;
  serverLabel: string;
  tabs: OpenSessionTab[];
}

const PiSheets = ({
  client,
  foreground,
  onDetails,
  onDismiss,
  onError,
  onHelp,
  onNew,
  onSelect,
  onServer,
  onSettings,
  selectedID,
  serverLabel,
  tabs,
}: PiSheetsProps) => {
  const navigationOpen = useSheetStore((state) => state.navigationOpen);
  const moreOpen = useSheetStore((state) => state.moreOpen);
  const sheets = useSheetStoreApi();
  const scope = useServerScope();
  const sessions = useQuery(
    piSessionsOptions(scope, client, foreground && navigationOpen)
  );
  const recent = useMemo<OpenSessionTab[]>(
    () =>
      (sessions.data ?? []).map((item) => ({
        directory: item.cwd,
        id: item.id,
        title: item.name || "New session",
      })),
    [sessions.data]
  );
  const { error: sessionsError } = sessions;
  useEffect(() => {
    if (sessionsError) {
      onError(errorMessage(sessionsError));
    }
  }, [sessionsError, onError]);

  return (
    <>
      <BetaMoreSheet
        visible={moreOpen}
        onClose={() => sheets.setState({ moreOpen: false })}
        onDismiss={onDismiss}
        onDetails={onDetails}
      />
      <BetaTabsSheet
        visible={navigationOpen}
        tabs={tabs}
        recent={recent}
        selectedID={selectedID}
        serverLabel={serverLabel}
        onServer={onServer}
        onClose={() => sheets.setState({ navigationOpen: false })}
        onDismiss={onDismiss}
        onSelect={onSelect}
        onNew={onNew}
        onSettings={onSettings}
        onHelp={onHelp}
      />
    </>
  );
};

const PiWorkspaceSession = ({
  connection,
  foreground,
  onManageServers,
  onConnectionLost,
}: Props) => {
  const client = useMemo(() => createPiClient(connection), [connection]);
  const queryClient = useQueryClient();
  const scope = useServerScope();
  const backend = useMemo(
    () => makePiChatBackend(connection, queryClient, scope, client),
    [connection, queryClient, scope, client]
  );
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [tabs, setTabs] = useState<OpenSessionTab[]>([]);
  const sheets = useSheetStoreApi();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chatUi = useChatUiStoreApi();
  const selected = useChatUiStore((state) => state.messageSelected);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useLayoutEffect(() => {
    // The sheet store is global, so reset the flags to keep them from leaking between shells.
    sheets.setState({ moreOpen: false, navigationOpen: false });
    return () => {
      sheets.setState({ moreOpen: false, navigationOpen: false });
      chatUi.setState({ messageSelected: false, panelRequest: undefined });
    };
  }, [sheets, chatUi]);
  const alive = useRef(true);
  const sessionRef = useRef(session);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const operation = useRef(false);
  const settingsCanGoBack = useRef(false);
  const lostConnection = useRef(onConnectionLost);
  useLayoutEffect(() => {
    sessionRef.current = session;
    lostConnection.current = onConnectionLost;
  });
  const confirmNavigation = useUnsavedGuard();

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      pendingNavigation.current = null;
    };
  }, []);

  const recordSession = useCallback((next: SessionInfo) => {
    if (!alive.current) {
      return;
    }
    setSession((current) =>
      current?.id === next.id &&
      current.title === next.title &&
      current.location.directory === next.location.directory
        ? current
        : next
    );
    const tab = {
      directory: next.location.directory,
      id: next.id,
      title: next.title || "New session",
    };
    setTabs((current) => {
      const previous = current.find((item) => item.id === next.id);
      if (
        previous?.title === tab.title &&
        previous.directory === tab.directory
      ) {
        return current;
      }
      return previous
        ? current.map((item) => (item.id === tab.id ? tab : item))
        : [...current, tab];
    });
  }, []);

  const refreshSession = useCallback(
    async (signal?: AbortSignal) => {
      const info = await client.info(signal);
      const next = await backend.core.session.get(
        { sessionID: info.session.id },
        { signal }
      );
      if (!signal?.aborted) {
        recordSession(next);
      }
    },
    [backend, client, recordSession]
  );

  useEffect(() => {
    if (!foreground || session) {
      return;
    }
    const controller = new AbortController();
    void refreshSession(controller.signal).catch((error_) => {
      if (controller.signal.aborted) {
        return;
      }
      setError(errorMessage(error_));
      lostConnection.current(error_);
    });
    return () => controller.abort();
  }, [foreground, session, refreshSession]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (settingsCanGoBack.current) {
          return false;
        }
        setSettingsOpen(false);
        return true;
      }
    );
    return () => subscription.remove();
  }, [settingsOpen]);

  const changeSession = async (
    command: Extract<PiCommand, { type: "new" | "switch" }>
  ) => {
    if (operation.current || !foreground) {
      return;
    }
    if (!(await confirmNavigation()) || !alive.current) {
      return;
    }
    operation.current = true;
    setBusy(true);
    setError(null);
    const runCommand = async () => {
      const { current } = sessionRef;
      if (!current) {
        return;
      }
      await client.command({ ...command, expectedSessionID: current.id });
      if (alive.current) {
        await refreshSession();
      }
    };
    try {
      await runCommand();
    } catch (error_) {
      if (alive.current) {
        setError(errorMessage(error_));
      }
    }
    operation.current = false;
    if (alive.current) {
      setBusy(false);
    }
  };

  const openSession = (id: string) => {
    if (!id || id === sessionRef.current?.id) {
      return;
    }
    void changeSession({ sessionID: id, type: "switch" });
  };
  const openChatSession = (id: string) => {
    if (!id || !foreground) {
      return;
    }
    void (async () => {
      const info = await client.info();
      if (!alive.current) {
        return;
      }
      if (info.session.id === id) {
        recordSession(await backend.core.session.get({ sessionID: id }));
      } else {
        await changeSession({ sessionID: id, type: "switch" });
      }
    })().catch((error_) => {
      if (alive.current) {
        setError(errorMessage(error_));
      }
    });
  };
  const afterNavigation = (action: () => void) => {
    pendingNavigation.current = action;
    sheets.setState({ navigationOpen: false });
  };
  const onNavigationDismissed = () => {
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    if (alive.current) {
      action?.();
    }
  };
  const showDetails = () => {
    const { current } = sessionRef;
    if (current) {
      const id = chatUi.getState().panelRequestID + 1;
      chatUi.setState({
        panelRequest: { id, panel: "actions", sessionID: current.id },
        panelRequestID: id,
      });
    }
  };
  const afterMenu = (action: () => void) => {
    pendingNavigation.current = action;
    sheets.setState({ moreOpen: false });
  };
  const onSettingsBackState = useCallback((value: boolean) => {
    settingsCanGoBack.current = value;
  }, []);
  const currentTab = session
    ? {
        directory: session.location.directory,
        id: session.id,
        title: session.title || "New session",
      }
    : undefined;

  return (
    <View style={{ flex: 1 }}>
      <PiBus
        backend={backend}
        foreground={foreground && !settingsOpen}
        scope={scope}
        onConnectionLost={onConnectionLost}
      />
      {!settingsOpen && !selected && (
        <BetaTabStrip
          current={currentTab}
          busy={busy || !session}
          onOpen={() => sheets.setState({ navigationOpen: true })}
        />
      )}
      {error && (
        <View style={{ paddingBottom: 8, paddingHorizontal: 12 }}>
          <ErrorNotice
            error={error}
            onRetry={() => {
              setError(null);
              void refreshSession().catch((error_) =>
                setError(errorMessage(error_))
              );
            }}
          />
        </View>
      )}
      <SessionSurface framed={!settingsOpen && !selected}>
        {!settingsOpen && !selected && session && (
          <BetaSessionNavigation
            pane="Session"
            directory={session.location.directory}
            changes={false}
            onSelect={() => setSettingsOpen(false)}
            onMore={() => {
              Keyboard.dismiss();
              sheets.setState({ moreOpen: true });
            }}
          />
        )}
        {session ? (
          <>
            <View style={[{ flex: 1 }, settingsOpen && { display: "none" }]}>
              <ChatScreen
                backend={backend}
                sessionID={session.id}
                draftKey={`pi:${connection.id}:${session.id}`}
                serverID={connection.id}
                visible={foreground && !settingsOpen}
                onOpenNavigation={() =>
                  sheets.setState({ navigationOpen: true })
                }
                onSessionInfo={recordSession}
                onSessionChanged={() => {
                  void refreshSession().catch((error_) => {
                    if (alive.current) {
                      setError(errorMessage(error_));
                    }
                  });
                }}
                onOpenSession={openChatSession}
                onConnectionLost={onConnectionLost}
              />
            </View>
            {settingsOpen && (
              <SettingsScreen
                modelCatalog={backend.core.model}
                directory={session.location.directory}
                sections={settingsSections}
                visible
                onBack={() => setSettingsOpen(false)}
                backLabel="Chat"
                onBackStateChange={onSettingsBackState}
                onManageServers={onManageServers}
                serverLabel={connection.name}
              />
            )}
          </>
        ) : (
          <Busy />
        )}
      </SessionSurface>
      <PiSheets
        client={client}
        foreground={foreground}
        onDetails={() => afterMenu(showDetails)}
        onDismiss={onNavigationDismissed}
        onError={setError}
        onHelp={() =>
          afterNavigation(() => {
            void Linking.openURL("https://pi.dev/docs/latest/");
          })
        }
        onNew={() =>
          afterNavigation(() => {
            void changeSession({ type: "new" });
          })
        }
        onSelect={(id) => afterNavigation(() => openSession(id))}
        onServer={() => afterNavigation(onManageServers)}
        onSettings={() => afterNavigation(() => setSettingsOpen(true))}
        selectedID={session?.id}
        serverLabel={connection.name}
        tabs={tabs}
      />
    </View>
  );
};

export const PiWorkspace = (props: Props) => (
  <LiveStoreProvider key={`${props.connection.id}:${props.connection.url}`}>
    <PiWorkspaceSession {...props} />
  </LiveStoreProvider>
);
