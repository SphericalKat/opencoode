import type { SessionInfo } from "@opencode/client";
import React, {
  useCallback,
  useEffect,
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
} from "../components/BetaNavigation";
import type { OpenSessionTab } from "../components/BetaNavigation";
import { Busy, ErrorNotice } from "../components/ui";
import { useBetaLayout } from "../lib/betaLayout";
import { errorMessage } from "../lib/client";
import type { Connection } from "../lib/client";
import { makePiChatBackend } from "../lib/piChatBackend";
import { createPiClient } from "../lib/piClient";
import { useUnsavedGuard } from "../lib/unsaved";
import { ChatScreen } from "./ChatScreen";
import { SettingsScreen } from "./SettingsScreen";
import type { Section } from "./SettingsScreen";

interface Props {
  connection: Connection;
  onManageServers: () => void;
  onConnectionLost: (error: unknown) => void;
  foreground: boolean;
}
const settingsSections: Section[] = ["Appearance", "Models"];

export function PiWorkspace(props: Props) {
  return (
    <PiWorkspaceSession
      key={`${props.connection.id}:${props.connection.url}`}
      {...props}
    />
  );
}

function PiWorkspaceSession({
  connection,
  foreground,
  onManageServers,
  onConnectionLost,
}: Props) {
  const betaLayout = useBetaLayout();
  const client = useMemo(() => createPiClient(connection), [connection]);
  const backend = useMemo(
    () => makePiChatBackend(connection, client),
    [connection, client]
  );
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [tabs, setTabs] = useState<OpenSessionTab[]>([]);
  const [recent, setRecent] = useState<OpenSessionTab[]>([]);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelRequest, setPanelRequest] = useState<{
    id: number;
    sessionID: string;
    panel: "actions";
  }>();
  const alive = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const pendingNavigation = useRef<(() => void) | null>(null);
  const operation = useRef(false);
  const requestID = useRef(0);
  const settingsCanGoBack = useRef(false);
  const lostConnection = useRef(onConnectionLost);
  lostConnection.current = onConnectionLost;
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
    if (!foreground || !navigationOpen) {
      return;
    }
    const controller = new AbortController();
    void client
      .sessions(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setRecent(
            value.map((item) => ({
              directory: item.cwd,
              id: item.id,
              title: item.name || "New session",
            }))
          );
        }
      })
      .catch((error_) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(error_));
        }
      });
    return () => controller.abort();
  }, [client, foreground, navigationOpen]);

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
    try {
      const { current } = sessionRef;
      if (!current) {
        return;
      }
      await client.command({ ...command, expectedSessionID: current.id });
      if (alive.current) {
        await refreshSession();
      }
    } catch (error_) {
      if (alive.current) {
        setError(errorMessage(error_));
      }
    } finally {
      operation.current = false;
      if (alive.current) {
        setBusy(false);
      }
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
    setNavigationOpen(false);
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
      setPanelRequest({
        id: ++requestID.current,
        panel: "actions",
        sessionID: current.id,
      });
    }
  };
  const afterMenu = (action: () => void) => {
    pendingNavigation.current = action;
    setMoreOpen(false);
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
      {!settingsOpen && !selected && (
        <BetaTabStrip
          current={currentTab}
          count={tabs.length}
          busy={busy || !session}
          onOpen={() => setNavigationOpen(true)}
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
      <SessionSurface framed={betaLayout && !settingsOpen && !selected}>
        {!settingsOpen && !selected && session && betaLayout && (
          <BetaSessionNavigation
            pane="Session"
            directory={session.location.directory}
            changes={false}
            onSelect={() => setSettingsOpen(false)}
            onMore={() => {
              Keyboard.dismiss();
              setMoreOpen(true);
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
                betaLayout={betaLayout}
                visible={foreground && !settingsOpen}
                projectLabel={session.location.directory
                  .split(/[\\/]/)
                  .filter(Boolean)
                  .pop()}
                onOpenNavigation={() => setNavigationOpen(true)}
                onSelectionChange={setSelected}
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
                sessionPanelRequest={panelRequest}
              />
            </View>
            {settingsOpen && (
              <SettingsScreen
                modelCatalog={backend.core.model}
                directory={session.location.directory}
                sections={settingsSections}
                betaLayout={betaLayout}
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
      <BetaMoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        onDismiss={onNavigationDismissed}
        onDetails={() => afterMenu(showDetails)}
      />
      <BetaTabsSheet
        visible={navigationOpen}
        tabs={tabs}
        recent={recent}
        selectedID={session?.id}
        serverLabel={connection.name}
        onServer={() => afterNavigation(onManageServers)}
        onClose={() => setNavigationOpen(false)}
        onDismiss={onNavigationDismissed}
        onSelect={(id) => afterNavigation(() => openSession(id))}
        onNew={() =>
          afterNavigation(() => {
            void changeSession({ type: "new" });
          })
        }
        onSettings={() => afterNavigation(() => setSettingsOpen(true))}
        onHelp={() =>
          afterNavigation(() => {
            void Linking.openURL("https://pi.dev/docs/latest/");
          })
        }
      />
    </View>
  );
}
