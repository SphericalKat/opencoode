import type { SessionInfo } from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter, usePathname } from "expo-router";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { Keyboard, Linking, View } from "react-native";

import {
  BetaMoreSheet,
  BetaSessionNavigation,
  BetaTabsSheet,
  BetaTabStrip,
  SessionSurface,
} from "../components/beta-navigation";
import type { SessionTabItem } from "../components/beta-navigation";
import { Busy, ErrorNotice } from "../components/ui";
import { errorMessage } from "../lib/client";
import type { Connection } from "../lib/client";
import type { makePiChatBackend } from "../lib/pi-chat-backend";
import type { PiClient } from "../lib/pi-client";
import { piSessionsOptions } from "../lib/queries/pi";
import { routes } from "../lib/routes";
import { useServerScope } from "../lib/server-scope";
import { useChatUiActions, useChatUiStore } from "../stores/chat-ui-store";
import { useSheetActions, useSheetStore } from "../stores/sheet-store";
import { ChatScreen } from "./chat-screen";
import { usePiSession } from "./use-pi-session";

interface Props {
  backend: PiWorkspaceValue["backend"];
  children: ReactNode;
  client: PiClient;
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
  tabs: SessionTabItem[];
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
  const { hideMore, hideNavigation } = useSheetActions();
  const scope = useServerScope();
  const sessions = useQuery(
    piSessionsOptions(scope, client, foreground && navigationOpen)
  );
  const recent = useMemo<SessionTabItem[]>(
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
        onClose={hideMore}
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
        onClose={hideNavigation}
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
  backend,
  client,
  connection,
  foreground,
  onManageServers,
  onConnectionLost,
  children,
}: Props) => {
  const router = useRouter();
  const settingsOpen = usePathname().startsWith(routes.piSettings);
  const sheetActions = useSheetActions();
  const chatUiActions = useChatUiActions();
  const pendingNavigation = useRef<(() => void) | null>(null);
  const {
    busy,
    changeSession,
    error,
    onRetry,
    onSessionChanged,
    openChatSession,
    openSession,
    recordSession,
    session,
    sessionRef,
    setError,
    tabs,
  } = usePiSession({
    backend,
    client,
    connection,
    foreground,
    onConnectionLost,
  });
  useLayoutEffect(
    () => () => {
      pendingNavigation.current = null;
    },
    []
  );

  const afterNavigation = (action: () => void) => {
    pendingNavigation.current = action;
    sheetActions.hideNavigation();
  };
  const afterMenu = (action: () => void) => {
    pendingNavigation.current = action;
    sheetActions.hideMore();
  };
  const onNavigationDismissed = () => {
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    action?.();
  };
  const showDetails = () => {
    const { current } = sessionRef;
    if (current) {
      chatUiActions.requestPanel(current.id, "actions");
    }
  };
  const latest = useRef({ onRetry, onSessionChanged, openChatSession });
  useLayoutEffect(() => {
    latest.current = { onRetry, onSessionChanged, openChatSession };
  });
  const onOpenSession = useCallback((id: string) => {
    latest.current.openChatSession(id);
  }, []);
  const onRetryStable = useCallback(() => {
    latest.current.onRetry();
  }, []);
  const onSessionChangedStable = useCallback(() => {
    latest.current.onSessionChanged();
  }, []);
  const onOpenMore = useCallback(() => {
    Keyboard.dismiss();
    sheetActions.showMore();
  }, [sheetActions]);
  const onOpenNavigation = sheetActions.showNavigation;
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

export const PiWorkspace = (props: Props) => <PiWorkspaceSession {...props} />;

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
  const selected = useChatUiStore((state) =>
    session ? !!state.selected[session.id] : false
  );
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
