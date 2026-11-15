import type { SessionInfo } from "@opencode/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { Keyboard, Linking, View } from "react-native";

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
import { routes } from "../lib/routes";
import { useServerScope } from "../lib/server-scope";
import { useUnsavedGuard } from "../lib/unsaved";
import { useChatUiStore, useChatUiStoreApi } from "../stores/chat-ui-store";
import type { OpenSessionTab } from "../stores/session-tabs-store";
import { useSheetStore, useSheetStoreApi } from "../stores/sheet-store";
import { ChatScreen } from "./chat-screen";

interface Props {
  children: ReactNode;
  connection: Connection;
  onManageServers: () => void;
  onConnectionLost: (error: unknown) => void;
  foreground: boolean;
}

interface PiWorkspaceValue {
  backend: ReturnType<typeof makePiChatBackend>;
  busy: boolean;
  connection: Connection;
  error: string | null;
  foreground: boolean;
  onBack: () => void;
  onConnectionLost: (error: unknown) => void;
  onManageServers: () => void;
  onOpenNavigation: () => void;
  onOpenMore: () => void;
  onRetry: () => void;
  onSessionChanged: () => void;
  onSessionInfo: (session: SessionInfo) => void;
  onOpenSession: (id: string) => void;
  session: SessionInfo | null;
  settingsOpen: boolean;
}

const PiWorkspaceContext = createContext<PiWorkspaceValue | null>(null);

// Shared by the chat route and the settings routes under the Pi layout.
export const usePiWorkspace = (): PiWorkspaceValue => {
  const value = useContext(PiWorkspaceContext);
  if (!value) {
    throw new Error("Pi workspace is used outside the Pi layout");
  }
  return value;
};

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
  children,
}: Props) => {
  const router = useRouter();
  const settingsOpen = usePathname().startsWith(routes.piSettings);
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
  const chatUi = useChatUiStoreApi();
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
  const onSessionChanged = () => {
    void refreshSession().catch((error_) => {
      if (alive.current) {
        setError(errorMessage(error_));
      }
    });
  };
  const onRetry = () => {
    setError(null);
    void refreshSession().catch((error_) => setError(errorMessage(error_)));
  };
  const latest = useRef({ onRetry, onSessionChanged, openChatSession });
  useLayoutEffect(() => {
    latest.current = { onRetry, onSessionChanged, openChatSession };
  });
  const onOpenSession = useCallback(
    (id: string) => latest.current.openChatSession(id),
    []
  );
  const onRetryStable = useCallback(() => latest.current.onRetry(), []);
  const onSessionChangedStable = useCallback(
    () => latest.current.onSessionChanged(),
    []
  );
  const onOpenMore = useCallback(() => {
    Keyboard.dismiss();
    sheets.setState({ moreOpen: true });
  }, [sheets]);
  const onOpenNavigation = useCallback(
    () => sheets.setState({ navigationOpen: true }),
    [sheets]
  );
  const onBack = useCallback(() => router.back(), [router]);
  const value = useMemo<PiWorkspaceValue>(
    () => ({
      backend,
      busy,
      connection,
      error,
      foreground,
      onBack,
      onConnectionLost,
      onManageServers,
      onOpenMore,
      onOpenNavigation,
      onOpenSession,
      onRetry: onRetryStable,
      onSessionChanged: onSessionChangedStable,
      onSessionInfo: recordSession,
      session,
      settingsOpen,
    }),
    [
      backend,
      busy,
      connection,
      error,
      foreground,
      onBack,
      onConnectionLost,
      onManageServers,
      onOpenMore,
      onOpenNavigation,
      onOpenSession,
      onRetryStable,
      onSessionChangedStable,
      recordSession,
      session,
      settingsOpen,
    ]
  );

  return (
    <PiWorkspaceContext.Provider value={value}>
      <View style={{ flex: 1 }}>
        <PiBus
          backend={backend}
          foreground={foreground && !settingsOpen}
          scope={scope}
          onConnectionLost={onConnectionLost}
        />
        {children}
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
          onSettings={() =>
            afterNavigation(() => router.push(routes.piSettings))
          }
          selectedID={session?.id}
          serverLabel={connection.name}
          tabs={tabs}
        />
      </View>
    </PiWorkspaceContext.Provider>
  );
};

const generations = new WeakMap<Connection, number>();
let nextGeneration = 0;

// Each applied connection is a new object, so a reconnect to the same server
// resets the Pi state, as the old `connectionRevision` key did.
const generationOf = (connection: Connection) => {
  let generation = generations.get(connection);
  if (generation === undefined) {
    nextGeneration += 1;
    generation = nextGeneration;
    generations.set(connection, generation);
  }
  return generation;
};

export const PiWorkspace = (props: Props) => (
  <LiveStoreProvider
    key={`${props.connection.id}:${props.connection.url}:${generationOf(props.connection)}`}
  >
    <PiWorkspaceSession {...props} />
  </LiveStoreProvider>
);

export const PiChat = () => {
  const {
    backend,
    busy,
    connection,
    error,
    foreground,
    onConnectionLost,
    onOpenMore,
    onOpenNavigation,
    onOpenSession,
    onRetry,
    onSessionChanged,
    onSessionInfo,
    session,
    settingsOpen,
  } = usePiWorkspace();
  const selected = useChatUiStore((state) => state.messageSelected);
  const currentTab = session
    ? {
        directory: session.location.directory,
        id: session.id,
        title: session.title || "New session",
      }
    : undefined;

  return (
    <View style={{ flex: 1 }}>
      {!selected && (
        <BetaTabStrip
          current={currentTab}
          busy={busy || !session}
          onOpen={onOpenNavigation}
        />
      )}
      {error && (
        <View style={{ paddingBottom: 8, paddingHorizontal: 12 }}>
          <ErrorNotice error={error} onRetry={onRetry} />
        </View>
      )}
      <SessionSurface framed={!selected}>
        {!selected && session && (
          <BetaSessionNavigation
            pane="Session"
            directory={session.location.directory}
            changes={false}
            onSelect={() => Keyboard.dismiss()}
            onMore={onOpenMore}
          />
        )}
        {session ? (
          <ChatScreen
            backend={backend}
            sessionID={session.id}
            draftKey={`pi:${connection.id}:${session.id}`}
            serverID={connection.id}
            visible={foreground && !settingsOpen}
            onOpenNavigation={onOpenNavigation}
            onSessionInfo={onSessionInfo}
            onSessionChanged={onSessionChanged}
            onOpenSession={onOpenSession}
            onConnectionLost={onConnectionLost}
          />
        ) : (
          <Busy />
        )}
      </SessionSurface>
    </View>
  );
};
