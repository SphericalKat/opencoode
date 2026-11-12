import {
  ClientError,
  isLocationNotFoundError,
  isUnauthorizedError,
} from "@opencode/client";
import type { Project, ServerInfo, SessionInfo } from "@opencode/client";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode, RefObject } from "react";
import {
  AppState,
  BackHandler,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  KeyboardAvoidingView,
  KeyboardProvider,
} from "react-native-keyboard-controller";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import ibmPlexMonoFont from "./assets/fonts/IBMPlexMono-Text.ttf";
import interFont from "./assets/fonts/Inter.ttf";
import {
  BetaMoreSheet,
  BetaSessionNavigation,
  BetaTabsSheet,
  BetaTabStrip,
  SessionSurface,
} from "./src/components/beta-navigation";
import type {
  OpenSessionTab,
  SessionPane,
} from "./src/components/beta-navigation";
import { ConnectionFlow } from "./src/components/connection-flow";
import type { ConnectionForm } from "./src/components/connection-flow";
import { NavIcon } from "./src/components/icons";
import { MotionDrawer, MotionScreen } from "./src/components/motion";
import { OpenCodeLogo } from "./src/components/open-code-logo";
import { ProjectDirectoryBrowser } from "./src/components/project-directory-browser";
import { ShellIcon } from "./src/components/shell-icon";
import {
  Busy,
  confirmAction,
  ErrorNotice,
  Heading,
  BodyText,
  sans,
  Sheet,
} from "./src/components/ui";
import { BetaLayoutContext, useBetaLayout } from "./src/lib/beta-layout";
import { makeOpenCodeChatBackend } from "./src/lib/chat-backend";
import type { ChatBackend } from "./src/lib/chat-backend";
import {
  clearPairingRetry,
  connect,
  connectionErrorMessage,
  createClient,
  errorMessage,
  isConnectionUnauthorized,
  normalizeConnection,
  withServerDeadline,
} from "./src/lib/client";
import type { Connection } from "./src/lib/client";
import { pageInset } from "./src/lib/layout";
import {
  SheetCoordinatorProvider,
  useSheetCoordinator,
} from "./src/lib/sheets";
import {
  loadActiveConnectionId,
  loadConnections,
  loadWorkspace,
  saveActiveConnectionId,
  saveConnections,
  saveWorkspace,
} from "./src/lib/storage";
import { ThemeProvider, useTheme, useThemedStyles } from "./src/lib/theme";
import type { ThemeColors } from "./src/lib/theme";
import { UnsavedProvider, useUnsavedGuard } from "./src/lib/unsaved";
import { ChatScreen } from "./src/screens/chat-screen";
import { PiWorkspace } from "./src/screens/pi-workspace";
import { SessionsScreen } from "./src/screens/sessions-screen";
import { SettingsScreen } from "./src/screens/settings-screen";
import { WorkspaceScreen } from "./src/screens/workspace-screen";
import type { WorkspaceSection } from "./src/screens/workspace-screen";

type Tab = "sessions" | "workspace" | "settings";
const destinations: { id: Tab; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "settings", label: "Settings" },
];
const fonts = {
  IBMPlexMono: ibmPlexMonoFont,
  Inter: interFont,
};
const noop = (): null => null;
const lastPathSegment = /[^/]+(?=\/*$)/u;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    banner: { paddingBottom: 8, paddingHorizontal: 12 },
    betaOnboarding: { justifyContent: "center", paddingVertical: 32 },
    body: { flex: 1, flexDirection: "row", minHeight: 0 },
    boot: { alignItems: "center", flex: 1, justifyContent: "center" },
    contextDetail: { fontSize: 11, lineHeight: 16 },
    contextText: { flex: 1, gap: 1, minWidth: 0 },
    drawer: {
      backgroundColor: colors.bg,
      borderColor: colors.border,
      borderRightWidth: 1,
      height: "100%",
    },
    flex: { flex: 1 },
    full: { flex: 1, minHeight: 0, minWidth: 0 },
    hidden: { display: "none" },
    iconButton: {
      alignItems: "center",
      borderRadius: 8,
      height: Platform.OS === "android" ? 48 : 44,
      justifyContent: "center",
      width: Platform.OS === "android" ? 48 : 44,
    },
    main: { flex: 1, minHeight: 0, minWidth: 0 },
    navigationBrand: {
      alignItems: "center",
      flexDirection: "row",
      height: Platform.OS === "android" ? 48 : 64,
      justifyContent: "space-between",
      paddingHorizontal: pageInset,
    },
    navigationFooter: {
      borderColor: colors.border,
      borderTopWidth: 1,
      gap: 4,
      paddingHorizontal: pageInset,
      paddingTop: 8,
    },
    navigationLink: {
      alignItems: "center",
      borderRadius: 8,
      flex: 1,
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      minHeight: Platform.OS === "android" ? 48 : 44,
    },
    navigationLinkText: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 19,
    },
    navigationLinks: { flexDirection: "row", gap: 4 },
    navigationSessions: { flex: 1, marginTop: 8, minHeight: 0 },
    onboarding: {
      alignSelf: "center",
      flexGrow: 1,
      gap: 16,
      maxWidth: 520,
      padding: 24,
      paddingVertical: 40,
      width: "100%",
    },
    onboardingBrand: { gap: 16, marginBottom: 20 },
    pressed: { backgroundColor: colors.selected },
    projectChoice: {
      alignItems: "center",
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      marginHorizontal: pageInset,
      minHeight: Platform.OS === "android" ? 48 : 56,
      paddingHorizontal: 15,
      paddingVertical: 10,
    },
    projectName: { fontSize: 14, fontWeight: "500" },
    row: { flexDirection: "row" },
    safe: { backgroundColor: colors.bg, flex: 1 },
    selectedDestination: { backgroundColor: colors.panel },
    serverChoice: {
      alignItems: "center",
      borderRadius: 8,
      flexDirection: "row",
      gap: 10,
      minHeight: 48,
      paddingHorizontal: 16,
    },
    serverName: { fontSize: 13, fontWeight: "500" },
    shell: { flex: 1, flexDirection: "row", minHeight: 0 },
    sidebar: {
      backgroundColor: colors.bg,
      borderColor: colors.border,
      borderRightWidth: 1,
      width: 288,
    },
    welcome: {
      alignItems: "center",
      flex: 1,
      gap: 20,
      justifyContent: "center",
      padding: 32,
    },
    welcomeDetail: { lineHeight: 24, maxWidth: 320, textAlign: "center" },
  });

type ServerClient = NonNullable<ReturnType<typeof createClient>>;

const getWorkspaceLocation = (
  nextClient: ServerClient,
  workspace: { directory?: string } | null | undefined,
  signal: AbortSignal,
  onFallback: () => void
) =>
  nextClient.location
    .get(
      workspace?.directory
        ? { location: { directory: workspace.directory } }
        : undefined,
      { signal }
    )
    .catch((error_) => {
      if (
        signal.aborted ||
        !workspace?.directory ||
        !isLocationNotFoundError(error_)
      ) {
        throw error_;
      }
      onFallback();
      return nextClient.location.get(undefined, { signal });
    });

interface AppliedConnection {
  connected: Connection;
  connections: Connection[];
  directory: string;
  info: ServerInfo | null;
  preserveWorkspace: boolean;
  sessionID: string | undefined;
}

type ConnectResult = Awaited<ReturnType<typeof connect>>;
type WorkspaceSnapshot =
  | { directory?: string; sessionID?: string }
  | null
  | undefined;

const attempt = async <T,>(
  work: () => Promise<T>,
  onError: (error: unknown) => T,
  onFinally?: () => void
): Promise<T> => {
  try {
    return await work();
  } catch (error_) {
    return onError(error_);
  } finally {
    onFinally?.();
  }
};

const usernameOf = (connection: Connection) =>
  connection.username || "opencode";

const mergeMatchingConnection = (
  result: Connection,
  requested: Connection,
  current: Connection[],
  explicitName: boolean
): Connection => {
  if (explicitName || current.some((item) => item.id === requested.id)) {
    return result;
  }
  const matching = current.find(
    (item) => item.url === result.url && usernameOf(item) === usernameOf(result)
  );
  return matching
    ? { ...result, id: matching.id, name: matching.name }
    : result;
};

const isSameServer = (owner: Connection | null, connected: Connection) =>
  owner?.id === connected.id &&
  owner.url === connected.url &&
  owner.backend === connected.backend &&
  usernameOf(owner) === usernameOf(connected);

const locateWorkspace = async (
  result: ConnectResult,
  connected: Connection,
  workspace: WorkspaceSnapshot
): Promise<{ directory: string; sessionID: string | undefined }> => {
  if (result.backend === "pi") {
    return {
      directory: result.info.session.cwd,
      sessionID: result.info.session.id,
    };
  }
  let sessionID = workspace?.sessionID;
  const location = await withServerDeadline((signal) =>
    getWorkspaceLocation(createClient(connected), workspace, signal, () => {
      sessionID = undefined;
    })
  );
  return { directory: location.directory, sessionID };
};

const PROBE_INTERVAL_MS = 5000;
const PROBE_TIMEOUT_MS = 5000;
const PROBE_RETRY_MS = 1000;
const PROBE_FAILURES_BEFORE_RECOVERY = 2;

interface ProbeHandle {
  cancel?: () => void;
}

const checkServer = async (client: ServerClient, handle: ProbeHandle) => {
  const controller = new AbortController();
  const timeout = Promise.withResolvers<never>();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const pending = client.server.info({ signal: controller.signal });
    handle.cancel = () => {
      controller.abort();
      timeout.reject(new Error("The connection check was canceled"));
    };
    deadline = setTimeout(() => {
      timeout.reject(
        new Error(
          "OpenCode did not respond within five seconds. Check the server address and your network."
        )
      );
      controller.abort();
    }, PROBE_TIMEOUT_MS);
    return await Promise.race([pending, timeout.promise]);
  } finally {
    clearTimeout(deadline);
    handle.cancel = undefined;
  }
};

const assertOpenCodeTwo = (
  result: { version?: unknown } | null | undefined
) => {
  if (
    !result ||
    typeof result.version !== "string" ||
    !result.version.startsWith("2.")
  ) {
    throw new Error("This address no longer returns an OpenCode 2 server.");
  }
};

const hasUnauthorizedStatus = (error: unknown) =>
  error instanceof ClientError &&
  error.reason === "UnexpectedStatus" &&
  !!error.cause &&
  typeof error.cause === "object" &&
  "status" in error.cause &&
  error.cause.status === 401;

const isProbeUnauthorized = (error: unknown) =>
  isUnauthorizedError(error) || hasUnauthorizedStatus(error);

interface ProbeOptions {
  activeRef: RefObject<Connection | null>;
  client: ServerClient;
  epoch: RefObject<number>;
  onFailure: (owner: Connection, cause: unknown) => void;
  onHealthy: (owner: Connection) => void;
  owner: Connection;
  request: number;
}

const startConnectionProbe = ({
  activeRef,
  client,
  epoch,
  onFailure,
  onHealthy,
  owner,
  request,
}: ProbeOptions) => {
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const handle: ProbeHandle = {};
  const current = () =>
    !stopped && activeRef.current === owner && epoch.current === request;
  const probe = async () => {
    if (!current()) {
      return;
    }
    try {
      const result = await checkServer(client, handle);
      if (!current()) {
        return;
      }
      assertOpenCodeTwo(result);
      failures = 0;
      onHealthy(owner);
      timer = setTimeout(() => {
        void probe();
      }, PROBE_INTERVAL_MS);
    } catch (error_) {
      if (!current()) {
        return;
      }
      failures += 1;
      const unauthorized = isProbeUnauthorized(error_);
      if (unauthorized || failures >= PROBE_FAILURES_BEFORE_RECOVERY) {
        onFailure(owner, error_);
      }
      timer = setTimeout(
        () => {
          void probe();
        },
        failures === 1 && !unauthorized ? PROBE_RETRY_MS : PROBE_INTERVAL_MS
      );
    }
  };
  void probe();
  return () => {
    stopped = true;
    clearTimeout(timer);
    handle.cancel?.();
  };
};

type ConnectionProbeProps = Omit<ProbeOptions, "owner" | "request"> & {
  active: Connection;
  enabled: boolean;
};

const ConnectionProbe = ({
  active,
  activeRef,
  client,
  enabled,
  epoch,
  onFailure,
  onHealthy,
}: ConnectionProbeProps) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    return startConnectionProbe({
      activeRef,
      client,
      epoch,
      onFailure,
      onHealthy,
      owner: active,
      request: epoch.current,
    });
  }, [active, activeRef, client, enabled, epoch, onFailure, onHealthy]);
  return null;
};

const isAppForeground = () =>
  AppState.currentState !== "background" &&
  AppState.currentState !== "inactive";

const flowError = (
  connectionError: string | null,
  active: Connection | null,
  error: string | null
) => connectionError ?? (active ? null : error);

const ThemedStatusBar = () => {
  const { scheme, colors } = useTheme();
  const background = colors.frame;
  useEffect(() => {
    if (Platform.OS !== "web") {
      void SystemUI.setBackgroundColorAsync(background);
    }
  }, [background]);
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
};

interface NavigationPanelProps {
  active: Connection;
  client: ServerClient;
  connectionRevision: number;
  directory: string;
  info: ServerInfo | null;
  onChangeTab: (tab: Tab) => void;
  onClose: () => void;
  onOpenProjects: () => void;
  onOpenServers: () => void;
  onOpenSession: (id: string, keepNavigation?: boolean) => Promise<boolean>;
  projectLabel: string;
  revision: number;
  sessionID: string | null;
  tab: Tab;
  wide: boolean;
}

const NavigationPanel = ({
  active,
  client,
  connectionRevision,
  directory,
  info,
  onChangeTab,
  onClose,
  onOpenProjects,
  onOpenServers,
  onOpenSession,
  projectLabel,
  revision,
  sessionID,
  tab,
  wide,
}: NavigationPanelProps) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <View style={styles.navigationBrand}>
        <OpenCodeLogo width={Platform.OS === "android" ? 112 : 136} />
        {!wide && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigation"
            onPress={onClose}
            style={styles.iconButton}
          >
            <ShellIcon name="close" color={colors.muted} />
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Switch project directory. Current project: ${projectLabel}`}
        accessibilityHint={directory}
        onPress={onOpenProjects}
        style={({ pressed }) => [
          styles.projectChoice,
          pressed && styles.pressed,
        ]}
      >
        <NavIcon name="workspace" color={colors.muted} size={18} />
        <View style={styles.contextText}>
          <BodyText numberOfLines={1} style={styles.projectName}>
            {projectLabel}
          </BodyText>
          {Platform.OS !== "android" && (
            <BodyText
              muted
              numberOfLines={1}
              ellipsizeMode="middle"
              style={styles.contextDetail}
            >
              {directory}
            </BodyText>
          )}
        </View>
        <ShellIcon name="chevron" size={14} color={colors.faint} />
      </Pressable>
      <View style={styles.navigationSessions}>
        <SessionsScreen
          compact
          key={`${active.id}:${connectionRevision}:navigation`}
          client={client}
          directory={directory}
          selectedSessionID={sessionID ?? undefined}
          revision={revision}
          onOpenSession={onOpenSession}
        />
      </View>
      <View style={styles.navigationFooter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch server"
          onPress={onOpenServers}
          style={({ pressed }) => [
            styles.serverChoice,
            pressed && styles.pressed,
          ]}
        >
          <ShellIcon name="server" color={colors.muted} size={18} />
          <View style={styles.contextText}>
            <BodyText numberOfLines={1} style={styles.serverName}>
              {active.name}
            </BodyText>
            <BodyText muted style={styles.contextDetail}>
              OpenCode {info?.version ? `· v${info.version}` : ""}
            </BodyText>
          </View>
          <ShellIcon name="chevron" size={14} color={colors.faint} />
        </Pressable>
        <View style={styles.navigationLinks}>
          {destinations.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.label}`}
              aria-current={tab === item.id ? "page" : undefined}
              onPress={() => onChangeTab(item.id)}
              style={({ pressed }) => [
                styles.navigationLink,
                tab === item.id && styles.selectedDestination,
                pressed && styles.pressed,
              ]}
            >
              <NavIcon name={item.id} color={colors.muted} size={16} />
              <BodyText style={styles.navigationLinkText}>
                {item.label}
              </BodyText>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
};

interface OnboardingProps {
  betaLayout: boolean;
  children: ReactNode;
}

const Onboarding = ({ betaLayout, children }: OnboardingProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
      automaticOffset
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.onboarding,
          betaLayout && styles.betaOnboarding,
        ]}
      >
        {!betaLayout && (
          <View style={styles.onboardingBrand}>
            <OpenCodeLogo width={180} />
            <BodyText muted>Mobile client</BodyText>
          </View>
        )}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

interface StatusBannersProps {
  error: string | null;
  onRetryLocation: () => void;
  pendingLocation: { directory: string; sessionID: string } | null;
  sessionID: string | null;
}

const StatusBanners = ({
  error,
  onRetryLocation,
  pendingLocation,
  sessionID,
}: StatusBannersProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      {error && (
        <View style={styles.banner}>
          <ErrorNotice error={error} />
        </View>
      )}
      {pendingLocation?.sessionID === sessionID && (
        <View style={styles.banner}>
          <ErrorNotice
            error={`This session uses ${pendingLocation.directory}. Update the workspace before you attach files or open its terminal.`}
            onRetry={onRetryLocation}
          />
        </View>
      )}
    </>
  );
};

interface ChatColumnProps {
  active: Connection;
  attachmentContext: string | undefined;
  attachmentPath: string | undefined;
  betaHome: boolean;
  betaLayout: boolean;
  chatBackend: ChatBackend | null;
  connectionRevision: number;
  onAttachmentConsumed: () => void;
  onOpenNavigation: (() => void) | undefined;
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
  betaLayout,
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
  const hidden = betaLayout && betaHome;
  return (
    <View style={[styles.full, hidden && styles.hidden]}>
      {sessionID && chatBackend ? (
        <ChatScreen
          key={`${active.id}:${connectionRevision}:${sessionID}`}
          backend={chatBackend}
          sessionID={sessionID}
          serverID={active.id}
          draftKey={`${active.id}:${sessionID}`}
          betaLayout={betaLayout}
          onSelectionChange={onSelectionChange}
          onSessionInfo={onSessionInfo}
          sessionPanelRequest={sessionPanelRequest}
          visible={tab === "sessions" && (!betaLayout || !betaHome)}
          projectLabel={projectLabel}
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
  onNewSession: ((directory: string) => void) | undefined;
  onOpenSessionFromList: (id: string) => Promise<boolean>;
  revision: number;
  wide: boolean;
}

const SessionsTab = ({
  betaHomeProject,
  client,
  directory,
  onChooseDirectory,
  onNewSession,
  onOpenNavigation,
  onOpenSessionFromList,
  revision,
  wide,
  ...chat
}: SessionsTabProps) => {
  const styles = useThemedStyles(createStyles);
  const { active, betaHome, betaLayout, connectionRevision, sessionID, tab } =
    chat;
  const showList = !wide && (betaLayout || !sessionID);
  const showChat = wide || !!sessionID;
  const listHidden = betaLayout && !betaHome && !!sessionID;
  return (
    <MotionScreen
      visible={tab === "sessions"}
      style={[styles.full, styles.row, tab !== "sessions" && styles.hidden]}
    >
      {showList && (
        <View style={[styles.full, listHidden && styles.hidden]}>
          <SessionsScreen
            key={`${active.id}:${connectionRevision}`}
            client={client}
            directory={directory}
            betaLayout={betaLayout}
            projectScope={betaHomeProject}
            onChooseDirectory={onChooseDirectory}
            onNewSession={onNewSession}
            selectedSessionID={sessionID ?? undefined}
            revision={revision}
            onOpenSession={onOpenSessionFromList}
            onOpenNavigation={onOpenNavigation}
          />
        </View>
      )}
      {showChat && <ChatColumn {...chat} onOpenNavigation={onOpenNavigation} />}
    </MotionScreen>
  );
};

interface SessionPanelRequest {
  id: number;
  panel: "stats" | "actions";
  sessionID: string;
}

interface ShellFrameProps {
  betaHome: boolean;
  betaLayout: boolean;
  children: ReactNode;
  creatingSession: boolean;
  currentOpenTab: OpenSessionTab | undefined;
  directory: string;
  error: string | null;
  navigation: ReactNode;
  onMore: () => void;
  onOpenNavigation: () => void;
  onProject: () => void;
  onRetryLocation: () => void;
  onSelectPane: (pane: SessionPane) => void;
  openTabCount: number;
  pendingLocation: { directory: string; sessionID: string } | null;
  selectedPane: SessionPane;
  sessionID: string | null;
  showMessageSelection: boolean;
  tab: Tab;
  wide: boolean;
}

const ShellFrame = ({
  betaHome,
  betaLayout,
  children,
  creatingSession,
  currentOpenTab,
  directory,
  error,
  navigation,
  onMore,
  onOpenNavigation,
  onProject,
  onRetryLocation,
  onSelectPane,
  openTabCount,
  pendingLocation,
  selectedPane,
  sessionID,
  showMessageSelection,
  tab,
  wide,
}: ShellFrameProps) => {
  const styles = useThemedStyles(createStyles);
  const framed = betaLayout && tab !== "settings" && !showMessageSelection;
  const showSessionNavigation = framed && !betaHome && !!sessionID;
  return (
    <View style={styles.shell}>
      {wide && <View style={styles.sidebar}>{navigation}</View>}
      <View style={styles.main}>
        {framed && (
          <BetaTabStrip
            current={currentOpenTab}
            count={openTabCount}
            busy={creatingSession}
            onOpen={onOpenNavigation}
          />
        )}
        <StatusBanners
          error={error}
          onRetryLocation={onRetryLocation}
          pendingLocation={pendingLocation}
          sessionID={sessionID}
        />
        <SessionSurface style={styles.body} framed={framed}>
          {showSessionNavigation && (
            <BetaSessionNavigation
              pane={selectedPane}
              directory={directory}
              onSelect={onSelectPane}
              onMore={onMore}
              onProject={onProject}
            />
          )}
          {children}
        </SessionSurface>
      </View>
    </View>
  );
};

interface WorkspaceTabProps {
  active: Connection;
  backLabel: string;
  betaLayout: boolean;
  client: ServerClient;
  connectionRevision: number;
  directory: string;
  mounted: boolean;
  onAttachFile: (path: string, contextText?: string) => Promise<boolean>;
  onBack: () => void;
  onDirectoryChange: (directory: string) => void;
  onOpenNavigation: () => void;
  section: WorkspaceSection;
  sessionID: string | null;
  tab: Tab;
  wide: boolean;
}

const WorkspaceTab = ({
  active,
  backLabel,
  betaLayout,
  client,
  connectionRevision,
  directory,
  mounted,
  onAttachFile,
  onBack,
  onDirectoryChange,
  onOpenNavigation,
  section,
  sessionID,
  tab,
  wide,
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
        section={betaLayout ? section : undefined}
        hideChrome={betaLayout}
        visible={tab === "workspace"}
        onDirectoryChange={onDirectoryChange}
        onAttachFile={onAttachFile}
        onBack={wide ? undefined : onBack}
        backLabel={backLabel}
        onOpenNavigation={wide ? undefined : onOpenNavigation}
      />
    </MotionScreen>
  );
};

interface SettingsTabProps {
  active: Connection;
  backLabel: string;
  betaLayout: boolean;
  client: ServerClient;
  connectionRevision: number;
  directory: string;
  mounted: boolean;
  onBack: () => void;
  onBackStateChange: (canGoBack: boolean) => void;
  onManageServers: () => void;
  onOpenNavigation: () => void;
  tab: Tab;
  wide: boolean;
}

const SettingsTab = ({
  active,
  backLabel,
  betaLayout,
  client,
  connectionRevision,
  directory,
  mounted,
  onBack,
  onBackStateChange,
  onManageServers,
  onOpenNavigation,
  tab,
  wide,
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
        betaLayout={betaLayout}
        onManageServers={onManageServers}
        serverLabel={active.name}
        visible={tab === "settings"}
        onBackStateChange={onBackStateChange}
        onBack={wide ? undefined : onBack}
        backLabel={backLabel}
        onOpenNavigation={wide ? undefined : onOpenNavigation}
      />
    </MotionScreen>
  );
};

interface NavigationDrawerProps {
  active: Connection | null;
  betaLayout: boolean;
  children: ReactNode;
  onClose: () => void;
  onDismiss: () => void;
  open: boolean;
  wide: boolean;
}

const NavigationDrawer = ({
  active,
  betaLayout,
  children,
  onClose,
  onDismiss,
  open,
  wide,
}: NavigationDrawerProps) => {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  return (
    <MotionDrawer
      visible={open && !wide && !!active && !betaLayout}
      width={Math.min(width - 32, 352)}
      onClose={onClose}
      onDismiss={onDismiss}
      panelStyle={styles.drawer}
    >
      <SafeAreaView style={styles.full} edges={["top", "bottom", "left"]}>
        {children}
      </SafeAreaView>
    </MotionDrawer>
  );
};

interface BetaSheetsProps {
  active: Connection | null;
  betaLayout: boolean;
  currentTabID: string | undefined;
  moreOpen: boolean;
  navigationOpen: boolean;
  onCloseMore: () => void;
  onCloseNavigation: () => void;
  onCloseTab: (id: string) => void;
  onDetails: () => void;
  onDismissMore: () => void;
  onDismissNavigation: () => void;
  onHelp: () => void;
  onHome: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onServer: () => void;
  onSettings: () => void;
  onUsage: () => void;
  onView: (pane: SessionPane) => void;
  openTabs: OpenSessionTab[];
  selectedPane: SessionPane;
}

const BetaSheets = ({
  active,
  betaLayout,
  currentTabID,
  moreOpen,
  navigationOpen,
  onCloseMore,
  onCloseNavigation,
  onCloseTab,
  onDetails,
  onDismissMore,
  onDismissNavigation,
  onHelp,
  onHome,
  onNew,
  onSelect,
  onServer,
  onSettings,
  onUsage,
  onView,
  openTabs,
  selectedPane,
}: BetaSheetsProps) => {
  if (!betaLayout) {
    return null;
  }
  return (
    <>
      {active && (
        <BetaTabsSheet
          visible={navigationOpen}
          tabs={openTabs}
          selectedID={currentTabID}
          serverLabel={active.name}
          onServer={onServer}
          onClose={onCloseNavigation}
          onDismiss={onDismissNavigation}
          onSelect={onSelect}
          onCloseTab={onCloseTab}
          onNew={onNew}
          onHome={onHome}
          onSettings={onSettings}
          onHelp={onHelp}
        />
      )}
      <BetaMoreSheet
        visible={moreOpen}
        pane={selectedPane}
        onClose={onCloseMore}
        onDismiss={onDismissMore}
        onView={onView}
        onUsage={onUsage}
        onDetails={onDetails}
      />
    </>
  );
};

interface ServersSheetProps {
  active: Connection | null;
  children: ReactNode;
  onClose: () => void;
  onDismiss: () => void;
  open: boolean;
  unavailableID: string | null;
}

const ServersSheet = ({
  active,
  children,
  onClose,
  onDismiss,
  open,
  unavailableID,
}: ServersSheetProps) => (
  <Sheet
    visible={open && !!active}
    title={unavailableID === active?.id ? "Connection" : "Servers"}
    allowDuringRecovery
    onClose={onClose}
    onDismiss={onDismiss}
  >
    {open && active && children}
  </Sheet>
);

interface ProjectsSheetProps {
  active: Connection | null;
  busy: boolean;
  client: ServerClient | null;
  connectionRevision: number;
  directory: string;
  error: string | null;
  onChangeValue: (value: string) => void;
  onClose: () => void;
  onOpenDirectory: (value: string) => void;
  open: boolean;
  projects: Project[];
  value: string;
}

const ProjectsSheet = ({
  active,
  busy,
  client,
  connectionRevision,
  directory,
  error,
  onChangeValue,
  onClose,
  onOpenDirectory,
  open,
  projects,
  value,
}: ProjectsSheetProps) => (
  <Sheet visible={open} title="Open a project" scroll={false} onClose={onClose}>
    {open && client && active && (
      <ProjectDirectoryBrowser
        key={`${active.id}:${connectionRevision}:${directory}`}
        client={client}
        directory={directory}
        value={value}
        projects={projects}
        busy={busy}
        error={error}
        onChangeValue={onChangeValue}
        onOpenDirectory={onOpenDirectory}
      />
    )}
  </Sheet>
);

const findCurrentOpenTab = (
  openTabs: OpenSessionTab[],
  sessionID: string | null,
  directory: string
): OpenSessionTab | undefined =>
  sessionID
    ? (openTabs.find((item) => item.id === sessionID) ?? {
        directory,
        id: sessionID,
        title: "Session",
      })
    : undefined;

interface ShellView {
  currentOpenTab: OpenSessionTab | undefined;
  projectLabel: string;
  returnLabel: string;
  selectedPane: SessionPane;
  showMessageSelection: boolean;
}

interface ShellViewInput {
  betaHome: boolean;
  directory: string;
  messageSelected: boolean;
  openTabs: OpenSessionTab[];
  sessionID: string | null;
  tab: Tab;
  workspaceSection: WorkspaceSection;
}

const deriveShellView = ({
  betaHome,
  directory,
  messageSelected,
  openTabs,
  sessionID,
  tab,
  workspaceSection,
}: ShellViewInput): ShellView => ({
  currentOpenTab:
    !betaHome && tab !== "settings"
      ? findCurrentOpenTab(openTabs, sessionID, directory)
      : undefined,
  projectLabel: lastPathSegment.exec(directory)?.[0] || "Project",
  returnLabel: sessionID ? "Chat" : "Sessions",
  selectedPane: tab === "workspace" ? workspaceSection : "Session",
  showMessageSelection:
    messageSelected && tab === "sessions" && !betaHome && !!sessionID,
});

const MobileApp = () => {
  const { colors } = useTheme();
  const betaLayout = useBetaLayout();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const wide = width >= 920;
  const confirmNavigation = useUnsavedGuard();
  const { suspendSheets, resumeSheets } = useSheetCoordinator();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [active, setActive] = useState<Connection | null>(null);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [booting, setBooting] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [unavailableID, setUnavailableID] = useState<string | null>(null);
  const [foreground, setForeground] = useState(isAppForeground);
  const [error, setError] = useState<string | null>(null);
  const [directory, setDirectory] = useState("");
  const [sessionID, setSessionID] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sessions");
  const [betaHome, setBetaHome] = useState(true);
  const [betaHomeProject, setBetaHomeProject] = useState<{
    directory: string;
    revision: number;
  }>();
  const [openTabs, setOpenTabs] = useState<OpenSessionTab[]>([]);
  const [workspaceSection, setWorkspaceSection] =
    useState<WorkspaceSection>("Changes");
  const [betaMoreOpen, setBetaMoreOpen] = useState(false);
  const [messageSelected, setMessageSelected] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const creatingSessionRef = useRef(false);
  const [sessionPanelRequest, setSessionPanelRequest] = useState<{
    id: number;
    sessionID: string;
    panel: "stats" | "actions";
  }>();
  const panelRequestID = useRef(0);
  const pendingBetaAction = useRef<(() => void) | null>(null);
  const [visited, setVisited] = useState<Partial<Record<Tab, boolean>>>({
    sessions: true,
  });
  const [serversOpen, setServersOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [newDirectory, setNewDirectory] = useState("");
  const [revision, setRevision] = useState(0);
  const [attachmentPath, setAttachmentPath] = useState<string>();
  const [attachmentContext, setAttachmentContext] = useState<string>();
  const [pendingLocation, setPendingLocation] = useState<{
    sessionID: string;
    directory: string;
  } | null>(null);
  const [form, setForm] = useState<ConnectionForm>({
    id: "",
    name: "",
    token: "",
    url: "",
  });
  const [pairingLink, setPairingLink] = useState<string | null>(null);
  const [flowRevision, setFlowRevision] = useState(0);
  const epoch = useRef(0);
  const pendingNavigationSheet = useRef<{
    kind: "servers" | "projects";
    epoch: number;
    serverRequest?: number;
  } | null>(null);
  const navigationPresented = useRef(false);
  const serverSheetRequest = useRef(0);
  const automaticServerRequest = useRef<number | null>(null);
  const showServerSheet = useRef<() => void>(noop);
  const recoveringConnection = useRef<{
    connection: Connection;
    message: string;
  } | null>(null);
  const recoverConnection =
    useRef<(connection: Connection, cause: unknown) => void>(noop);
  const connectingRef = useRef(false);
  const selection = useRef(0);
  const selectedSessionRef = useRef(sessionID);
  const openingSessionRef = useRef<string | null>(null);
  const settingsCanGoBack = useRef(false);
  const setSettingsBackState = useCallback((canGoBack: boolean) => {
    settingsCanGoBack.current = canGoBack;
  }, []);
  const directoryRef = useRef(directory);
  const locationSync = useRef<{
    key: string;
    promise: Promise<string | null>;
  } | null>(null);
  const activeRef = useRef<Connection | null>(null);
  useLayoutEffect(() => {
    selectedSessionRef.current = sessionID;
    directoryRef.current = directory;
    activeRef.current = active;
  });
  const client = useMemo(
    () => (active && active.backend !== "pi" ? createClient(active) : null),
    [active]
  );
  const chatBackend = useMemo(
    () => (client ? makeOpenCodeChatBackend(client) : null),
    [client]
  );
  const onPiConnectionLost = useCallback(
    (cause: unknown) => {
      if (active?.backend === "pi") {
        recoverConnection.current(active, cause);
      }
    },
    [active]
  );
  const recordSessionInfo = useCallback((session: SessionInfo) => {
    if (session.id !== selectedSessionRef.current) {
      return;
    }
    const next = {
      directory: session.location.directory,
      id: session.id,
      title: session.title || "New session",
    };
    setOpenTabs((current) => {
      const previous = current.find((item) => item.id === next.id);
      if (
        previous?.title === next.title &&
        previous.directory === next.directory
      ) {
        return current;
      }
      return previous
        ? current.map((item) => (item.id === next.id ? next : item))
        : [...current, next];
    });
  }, []);

  useEffect(() => {
    if (!betaLayout || !client || !sessionID) {
      return;
    }
    const controller = new AbortController();
    void client.session
      .get({ sessionID }, { signal: controller.signal })
      .then((session) => {
        if (!controller.signal.aborted) {
          recordSessionInfo(session);
        }
        return null;
      })
      .catch(noop);
    return () => controller.abort();
  }, [betaLayout, client, sessionID, recordSessionInfo]);

  const applyConnection = useCallback((applied: AppliedConnection) => {
    const { connected, preserveWorkspace } = applied;
    clearPairingRetry();
    setConnections(applied.connections);
    setActive(connected);
    setUnavailableID(null);
    recoveringConnection.current = null;
    if (!preserveWorkspace || connected.backend === "pi") {
      setConnectionRevision((value) => value + 1);
    }
    setInfo(applied.info);
    if (!preserveWorkspace) {
      setOpenTabs([]);
      setBetaHomeProject(undefined);
      setBetaHome(!applied.sessionID);
      setDirectory(applied.directory);
      directoryRef.current = applied.directory;
      setNewDirectory(applied.directory);
      setSessionID(applied.sessionID ?? null);
      selectedSessionRef.current = applied.sessionID ?? null;
      setPendingLocation(null);
      setAttachmentPath(undefined);
      setAttachmentContext(undefined);
      setTab("sessions");
    }
    setError(null);
    setServersOpen(false);
    setForm({ id: "", name: "", token: "", url: "" });
  }, []);

  const selectServer = useCallback(
    async (
      connection: Connection,
      existing?: Connection[],
      alternatives?: Connection[],
      explicitName = false
    ) => {
      if (connectingRef.current) {
        return;
      }
      connectingRef.current = true;
      epoch.current += 1;
      const request = epoch.current;
      const isCurrent = () => request === epoch.current;
      setConnecting(true);
      setConnectionError(null);
      await attempt(
        async () => {
          const result = await connect(connection, undefined, alternatives);
          const current = existing ?? connections;
          const connected = mergeMatchingConnection(
            result.connection,
            connection,
            current,
            explicitName
          );
          const sameServer = isSameServer(activeRef.current, connected);
          const workspace = sameServer
            ? {
                directory: directoryRef.current,
                sessionID: selectedSessionRef.current ?? undefined,
              }
            : await loadWorkspace(connected.id);
          const location = await locateWorkspace(result, connected, workspace);
          if (!isCurrent()) {
            return;
          }
          const preserveWorkspace =
            sameServer && location.directory === directoryRef.current;
          const restoredSessionID = preserveWorkspace
            ? (selectedSessionRef.current ?? undefined)
            : location.sessionID;
          if (!preserveWorkspace && !(await confirmNavigation())) {
            return;
          }
          if (!isCurrent()) {
            return;
          }
          const next = [
            ...current.filter((item) => item.id !== connected.id),
            connected,
          ];
          await saveConnections(next);
          await saveWorkspace(connected.id, {
            directory: location.directory,
            sessionID: restoredSessionID,
          });
          await saveActiveConnectionId(connected.id);
          if (!isCurrent()) {
            return;
          }
          applyConnection({
            connected,
            connections: next,
            directory: location.directory,
            info: result.backend === "opencode" ? result.info : null,
            preserveWorkspace,
            sessionID: restoredSessionID,
          });
        },
        (error_) => {
          if (!isCurrent()) {
            return;
          }
          setConnectionError(connectionErrorMessage(error_, connection));
          if (!activeRef.current || activeRef.current.id === connection.id) {
            setUnavailableID(connection.id);
          }
        },
        () => {
          connectingRef.current = false;
          if (isCurrent()) {
            setConnecting(false);
          }
        }
      );
    },
    [connections, confirmNavigation, applyConnection]
  );
  const selectServerRef = useRef(selectServer);
  useLayoutEffect(() => {
    selectServerRef.current = selectServer;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active || active.backend === "pi" || !directory) {
      return;
    }
    const timer = setTimeout(() => {
      saveWorkspace(active.id, {
        directory,
        sessionID: sessionID ?? undefined,
      }).catch((error_) => setError(errorMessage(error_)));
    }, 300);
    return () => clearTimeout(timer);
  }, [active, directory, sessionID]);

  useEffect(() => {
    let live = true;
    Promise.all([loadConnections(), loadActiveConnectionId()])
      .then(async ([saved, id]) => {
        if (!live) {
          return null;
        }
        setConnections(saved);
        const last = saved.find((item) => item.id === id);
        if (last) {
          await selectServerRef.current(last, saved);
        }
        return null;
      })
      .catch((error_) => {
        if (live) {
          setError(errorMessage(error_));
        }
      })
      .finally(() => {
        if (live) {
          setBooting(false);
        }
      })
      .catch(noop);
    return () => {
      live = false;
      epoch.current += 1;
    };
  }, []);

  useEffect(() => {
    const acceptLink = (url: string | null | undefined) => {
      if (!url) {
        return;
      }
      try {
        const parsed = new URL(url);
        if (
          parsed.protocol !== "opencoode:" &&
          !/\/auth\/connect\/[^/]+\/?$/u.test(parsed.pathname)
        ) {
          return;
        }
        const server =
          parsed.protocol === "opencoode:"
            ? parsed.searchParams.get("url")
            : url;
        if (!server) {
          return;
        }
        normalizeConnection({ name: "", url: server });
        setConnectionError(null);
        setForm({ id: "", name: "", token: "", url: server });
        setPairingLink(server);
        setFlowRevision((value) => value + 1);
        showServerSheet.current();
      } catch {
        setError("The connection link is invalid");
      }
    };
    Linking.getInitialURL().then(acceptLink).catch(noop);
    const subscription = Linking.addEventListener("url", (event) =>
      acceptLink(event.url)
    );
    return () => subscription.remove();
  }, []);

  const showBetaHome = useCallback(() => {
    selection.current += 1;
    openingSessionRef.current = null;
    setTab("sessions");
    setBetaHome(true);
    setNavigationOpen(false);
  }, []);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (active?.backend === "pi") {
        return false;
      }
      if (tab === "settings" && settingsCanGoBack.current) {
        return false;
      }
      if (betaLayout && messageSelected && !betaHome && tab === "sessions") {
        return false;
      }
      if (sessionID && tab === "sessions") {
        if (betaLayout && !betaHome) {
          showBetaHome();
          return true;
        }
        if (betaLayout) {
          return false;
        }
        const request = epoch.current;
        selection.current += 1;
        const navigation = selection.current;
        void confirmNavigation().then((leave) => {
          if (
            leave &&
            activeRef.current === active &&
            request === epoch.current &&
            navigation === selection.current
          ) {
            selectedSessionRef.current = null;
            setSessionID(null);
            setPendingLocation(null);
          }
          return null;
        });
        return true;
      }
      if (tab !== "sessions") {
        setTab("sessions");
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [
    active,
    sessionID,
    tab,
    confirmNavigation,
    betaLayout,
    betaHome,
    messageSelected,
    showBetaHome,
  ]);

  const changeDirectory = useCallback(
    (nextDirectory: string) => {
      if (activeRef.current !== active) {
        return;
      }
      const request = epoch.current;
      selection.current += 1;
      const navigation = selection.current;
      void confirmNavigation().then((leave) => {
        if (
          !leave ||
          activeRef.current !== active ||
          request !== epoch.current ||
          navigation !== selection.current
        ) {
          return null;
        }
        directoryRef.current = nextDirectory;
        selectedSessionRef.current = null;
        setBetaHome(true);
        if (betaLayout) {
          setTab("sessions");
          setBetaHomeProject({
            directory: nextDirectory,
            revision: navigation,
          });
        }
        setDirectory(nextDirectory);
        setNewDirectory(nextDirectory);
        setSessionID(null);
        setAttachmentPath(undefined);
        setAttachmentContext(undefined);
        setProjectsOpen(false);
        setPendingLocation(null);
        return null;
      });
    },
    [active, confirmNavigation, betaLayout]
  );

  const syncSelectedLocation = useCallback((): Promise<string | null> => {
    if (!client || activeRef.current !== active) {
      return Promise.resolve(null);
    }
    const id = selectedSessionRef.current;
    if (!id) {
      return Promise.resolve(directoryRef.current);
    }
    const request = epoch.current;
    const navigation = selection.current;
    const key = `${request}:${navigation}:${id}`;
    if (locationSync.current?.key === key) {
      return locationSync.current.promise;
    }
    const current = () =>
      activeRef.current === active &&
      request === epoch.current &&
      navigation === selection.current &&
      selectedSessionRef.current === id;
    const promise = (async () => {
      try {
        const selected = await client.session.get(
          { sessionID: id },
          { signal: AbortSignal.timeout(15_000) }
        );
        if (!current()) {
          return null;
        }
        const next = selected.location.directory;
        if (next === directoryRef.current) {
          setPendingLocation(null);
          return next;
        }
        const leave = await confirmNavigation();
        if (!current()) {
          return null;
        }
        if (!leave) {
          setPendingLocation({ directory: next, sessionID: id });
          return null;
        }
        directoryRef.current = next;
        setDirectory(next);
        setNewDirectory(next);
        setAttachmentPath(undefined);
        setAttachmentContext(undefined);
        setPendingLocation(null);
        return next;
      } catch (error_) {
        if (current()) {
          setError(errorMessage(error_));
        }
        return null;
      }
    })();
    locationSync.current = { key, promise };
    void promise.finally(() => {
      if (locationSync.current?.promise === promise) {
        locationSync.current = null;
      }
    });
    return promise;
  }, [active, client, confirmNavigation]);

  const openSession = useCallback(
    (id: string, keepNavigation = false): Promise<boolean> => {
      if (!client || activeRef.current !== active) {
        return Promise.resolve(false);
      }
      const request = epoch.current;
      selection.current += 1;
      const navigation = selection.current;
      openingSessionRef.current = id;
      const current = () =>
        activeRef.current === active &&
        request === epoch.current &&
        navigation === selection.current;
      const closeNavigation = () => {
        if (!keepNavigation) {
          setNavigationOpen(false);
        }
      };
      return attempt(
        async () => {
          if (id === selectedSessionRef.current) {
            const next = await syncSelectedLocation();
            if (!next || !current() || selectedSessionRef.current !== id) {
              return false;
            }
            setTab("sessions");
            setBetaHome(false);
            closeNavigation();
            return true;
          }
          const selected = id
            ? await client.session.get(
                { sessionID: id },
                { signal: AbortSignal.timeout(15_000) }
              )
            : null;
          if (!current() || !(await confirmNavigation()) || !current()) {
            return false;
          }
          if (selected) {
            directoryRef.current = selected.location.directory;
            setDirectory(selected.location.directory);
            setNewDirectory(selected.location.directory);
          }
          selectedSessionRef.current = id || null;
          setSessionID(id || null);
          setTab("sessions");
          setBetaHome(!id);
          setAttachmentPath(undefined);
          setAttachmentContext(undefined);
          setPendingLocation(null);
          if (selected) {
            recordSessionInfo(selected);
          }
          closeNavigation();
          return true;
        },
        (error_) => {
          if (current()) {
            setError(errorMessage(error_));
          }
          return false;
        },
        () => {
          if (current()) {
            openingSessionRef.current = null;
          }
        }
      );
    },
    [active, client, confirmNavigation, syncSelectedLocation, recordSessionInfo]
  );

  const createBetaSession = async (requestedTarget?: string) => {
    if (!client || creatingSessionRef.current) {
      return;
    }
    const target = requestedTarget ?? directoryRef.current;
    const owner = activeRef.current;
    const request = epoch.current;
    selection.current += 1;
    const navigation = selection.current;
    openingSessionRef.current = null;
    const current = () =>
      owner === activeRef.current &&
      request === epoch.current &&
      navigation === selection.current;
    creatingSessionRef.current = true;
    setCreatingSession(true);
    await attempt(
      async () => {
        if (!(await confirmNavigation()) || !current()) {
          return;
        }
        const created = await client.session.create({
          location: { directory: target },
        });
        if (!current()) {
          return;
        }
        selectedSessionRef.current = created.id;
        directoryRef.current = created.location.directory;
        setSessionID(created.id);
        setDirectory(created.location.directory);
        setNewDirectory(created.location.directory);
        setAttachmentPath(undefined);
        setAttachmentContext(undefined);
        setPendingLocation(null);
        recordSessionInfo(created);
        setTab("sessions");
        setBetaHome(false);
        setRevision((value) => value + 1);
      },
      (error_) => {
        if (current()) {
          setError(errorMessage(error_));
        }
      },
      () => {
        creatingSessionRef.current = false;
        setCreatingSession(false);
      }
    );
  };

  const closeBetaTab = async (id: string) => {
    if (openingSessionRef.current === id) {
      selection.current += 1;
      openingSessionRef.current = null;
    }
    if (id === selectedSessionRef.current) {
      const next = openTabs.find((item) => item.id !== id);
      if (next) {
        const wasHome = betaHome;
        if (!(await openSession(next.id, true))) {
          return;
        }
        setBetaHome(wasHome);
      } else {
        const owner = activeRef.current;
        const request = epoch.current;
        selection.current += 1;
        const navigation = selection.current;
        if (!(await confirmNavigation())) {
          return;
        }
        if (
          owner !== activeRef.current ||
          request !== epoch.current ||
          navigation !== selection.current
        ) {
          return;
        }
        selectedSessionRef.current = null;
        setSessionID(null);
        setPendingLocation(null);
        setBetaHome(true);
        setTab("sessions");
      }
    }
    setOpenTabs((current) => current.filter((item) => item.id !== id));
  };

  const afterBetaNavigation = (action: () => void) => {
    const owner = activeRef.current;
    const request = epoch.current;
    pendingBetaAction.current = () => {
      if (owner === activeRef.current && request === epoch.current) {
        action();
      }
    };
    setNavigationOpen(false);
  };

  const changeTab = async (next: Tab) => {
    if (betaLayout) {
      selection.current += 1;
      openingSessionRef.current = null;
    }
    if (next === "sessions" || next === tab) {
      setTab(next);
      setNavigationOpen(false);
      if (next === "sessions" && selectedSessionRef.current) {
        void syncSelectedLocation();
      }
      return;
    }
    const owner = active;
    const request = epoch.current;
    const navigation = selection.current;
    if (selectedSessionRef.current && !(await syncSelectedLocation())) {
      return;
    }
    if (
      activeRef.current !== owner ||
      request !== epoch.current ||
      navigation !== selection.current
    ) {
      return;
    }
    setVisited((current) => ({ ...current, [next]: true }));
    setTab(next);
    setNavigationOpen(false);
  };

  const openBetaPane = (pane: SessionPane) => {
    if (pane === "Session") {
      void changeTab("sessions");
      return;
    }
    setWorkspaceSection(pane);
    void changeTab("workspace");
  };

  const showNavigationSheet = async (
    kind: "servers" | "projects",
    automatic = false
  ) => {
    let serverRequest: number | undefined;
    if (kind === "servers") {
      if (!automatic) {
        automaticServerRequest.current = null;
      }
      if (!activeRef.current) {
        serverSheetRequest.current += 1;
        resumeSheets();
        return;
      }
      serverSheetRequest.current += 1;
      const request = serverSheetRequest.current;
      serverRequest = request;
      if (automatic) {
        automaticServerRequest.current = request;
      }
      const owner = activeRef.current;
      const connectionEpoch = epoch.current;
      await suspendSheets();
      if (request !== serverSheetRequest.current) {
        return;
      }
      if (owner !== activeRef.current || connectionEpoch !== epoch.current) {
        automaticServerRequest.current = null;
        resumeSheets();
        return;
      }
    }
    if ((navigationOpen || navigationPresented.current) && !wide) {
      pendingNavigationSheet.current = {
        epoch: epoch.current,
        kind,
        serverRequest,
      };
      setNavigationOpen(false);
      return;
    }
    pendingNavigationSheet.current = null;
    if (kind === "servers") {
      automaticServerRequest.current = null;
      setServersOpen(true);
    } else {
      setProjectsOpen(true);
    }
  };

  const openProjects = async () => {
    if (!client) {
      return;
    }
    showNavigationSheet("projects");
    setProjectBusy(true);
    setProjectError(null);
    const owner = activeRef.current;
    const isOwner = () => activeRef.current === owner;
    await attempt(
      async () => {
        const result = await client.project.list();
        if (isOwner()) {
          setProjects(result);
        }
      },
      (error_) => {
        if (isOwner()) {
          setProjectError(errorMessage(error_));
        }
      },
      () => {
        if (isOwner()) {
          setProjectBusy(false);
        }
      }
    );
  };

  const openNavigation = () => {
    Keyboard.dismiss();
    if (pendingNavigationSheet.current?.kind === "servers") {
      serverSheetRequest.current += 1;
      automaticServerRequest.current = null;
      resumeSheets();
    }
    pendingNavigationSheet.current = null;
    navigationPresented.current = !wide;
    setNavigationOpen(true);
  };

  const onNavigationDismissed = () => {
    navigationPresented.current = false;
    const pending = pendingNavigationSheet.current;
    pendingNavigationSheet.current = null;
    const betaAction = pendingBetaAction.current;
    pendingBetaAction.current = null;
    if (!pending && betaAction) {
      betaAction();
      return;
    }
    if (
      !pending ||
      pending.epoch !== epoch.current ||
      !activeRef.current ||
      (pending.kind === "servers" &&
        pending.serverRequest !== serverSheetRequest.current)
    ) {
      if (pending?.kind === "servers") {
        resumeSheets();
      }
      return;
    }
    if (pending.kind === "servers") {
      automaticServerRequest.current = null;
      setServersOpen(true);
    } else {
      setProjectsOpen(true);
    }
  };

  const recoverActiveConnection = (connection: Connection, cause: unknown) => {
    if (
      activeRef.current !== connection ||
      connectingRef.current ||
      recoveringConnection.current?.connection === connection
    ) {
      return;
    }
    const message = isConnectionUnauthorized(cause)
      ? `${connection.name} rejected the saved password. Pair again or update its saved connection.`
      : `${connection.name} is not responding. Retry it or connect to another server.`;
    recoveringConnection.current = { connection, message };
    setUnavailableID(connection.id);
    setConnectionError(message);
    if (!serversOpen) {
      setForm({ id: "", name: "", token: "", url: "" });
      setPairingLink(null);
      setFlowRevision((value) => value + 1);
      void showNavigationSheet("servers", true);
    }
  };

  useLayoutEffect(() => {
    showServerSheet.current = () => {
      void showNavigationSheet("servers");
    };
    recoverConnection.current = recoverActiveConnection;
  });

  const onProbeHealthy = useCallback(
    (owner: Connection) => {
      const recovery = recoveringConnection.current;
      if (recovery?.connection !== owner) {
        return;
      }
      recoveringConnection.current = null;
      const automaticRequest = automaticServerRequest.current;
      if (
        automaticRequest !== null &&
        automaticRequest === serverSheetRequest.current
      ) {
        automaticServerRequest.current = null;
        serverSheetRequest.current += 1;
        if (
          pendingNavigationSheet.current?.kind === "servers" &&
          pendingNavigationSheet.current.serverRequest === automaticRequest
        ) {
          pendingNavigationSheet.current = null;
        }
        resumeSheets();
      }
      setUnavailableID((value) => (value === owner.id ? null : value));
      setConnectionError((value) =>
        value === recovery.message ? null : value
      );
    },
    [resumeSheets]
  );
  const onProbeFailure = useCallback((owner: Connection, cause: unknown) => {
    recoverConnection.current(owner, cause);
  }, []);

  const openDirectory = async (nextDirectory = newDirectory) => {
    if (!client) {
      return;
    }
    const target = nextDirectory.trim();
    if (
      !target.startsWith("/") &&
      !/^[A-Za-z]:[\\/]/u.test(target) &&
      !target.startsWith("\\\\")
    ) {
      setProjectError("Enter an absolute directory on the server");
      return;
    }
    const owner = active;
    const request = epoch.current;
    const isCurrent = () =>
      activeRef.current === owner && request === epoch.current;
    setProjectBusy(true);
    setProjectError(null);
    await attempt(
      async () => {
        const location = await client.location.get(
          { location: { directory: target } },
          { signal: AbortSignal.timeout(15_000) }
        );
        if (!isCurrent()) {
          return;
        }
        changeDirectory(location.directory);
      },
      (error_) => {
        if (isCurrent()) {
          setProjectError(errorMessage(error_));
        }
      },
      () => {
        if (isCurrent()) {
          setProjectBusy(false);
        }
      }
    );
  };

  const removeConnection = async (connection: Connection) => {
    if (
      activeRef.current?.id === connection.id &&
      !(await confirmNavigation())
    ) {
      return;
    }
    if (
      !(await confirmAction(
        "Remove server?",
        `Remove the saved connection to ${connection.name}?`
      ))
    ) {
      return;
    }
    try {
      const next = connections.filter((item) => item.id !== connection.id);
      await saveConnections(next);
      if (activeRef.current?.id === connection.id) {
        epoch.current += 1;
        await saveActiveConnectionId(null);
        selectedSessionRef.current = null;
        directoryRef.current = "";
        setActive(null);
        setInfo(null);
        setSessionID(null);
        setDirectory("");
        setAttachmentPath(undefined);
        setAttachmentContext(undefined);
        setPendingLocation(null);
      }
      setConnections(next);
    } catch (error_) {
      setConnectionError(errorMessage(error_));
    }
  };

  const attachFile = async (
    path: string,
    contextText?: string
  ): Promise<boolean> => {
    if (!client) {
      return false;
    }
    const owner = activeRef.current;
    const request = epoch.current;
    const navigation = selection.current;
    try {
      if (selectedSessionRef.current) {
        const nextDirectory = await syncSelectedLocation();
        if (!nextDirectory) {
          return false;
        }
        if (nextDirectory !== directory) {
          if (
            activeRef.current === owner &&
            epoch.current === request &&
            selection.current === navigation
          ) {
            setError(
              "The session moved to another directory. Choose the file again in its current workspace."
            );
          }
          return false;
        }
      }
      let selected = sessionID;
      if (!selected) {
        const created = await client.session.create({
          location: { directory },
        });
        selected = created.id;
      }
      if (
        activeRef.current !== owner ||
        epoch.current !== request ||
        selection.current !== navigation
      ) {
        return false;
      }
      selectedSessionRef.current = selected;
      setSessionID(selected);
      setBetaHome(false);
      setAttachmentContext(contextText);
      setAttachmentPath(path);
      setRevision((value) => value + 1);
      setTab("sessions");
      return true;
    } catch (error_) {
      if (
        activeRef.current === owner &&
        epoch.current === request &&
        selection.current === navigation
      ) {
        setError(errorMessage(error_));
      }
      return false;
    }
  };

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
    const request = epoch.current;
    pendingBetaAction.current = () => {
      if (owner === activeRef.current && request === epoch.current) {
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
      panelRequestID.current += 1;
      setSessionPanelRequest({
        id: panelRequestID.current,
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
    showServerSheet.current();
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
          epoch={epoch}
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
          const action = pendingBetaAction.current;
          pendingBetaAction.current = null;
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
          serverSheetRequest.current += 1;
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

const App = () => {
  const { width } = useWindowDimensions();
  const betaLayout = Platform.OS === "android" && width < 920;
  const [fontsReady, fontError] = useFonts(fonts);
  if (!fontsReady && !fontError) {
    return <View style={{ backgroundColor: "#080808", flex: 1 }} />;
  }
  return (
    <SafeAreaProvider>
      <KeyboardProvider
        statusBarTranslucent
        navigationBarTranslucent
        preserveEdgeToEdge
      >
        <BetaLayoutContext.Provider value={betaLayout}>
          <ThemeProvider>
            <SheetCoordinatorProvider>
              <UnsavedProvider>
                <ThemedStatusBar />
                <MobileApp />
              </UnsavedProvider>
            </SheetCoordinatorProvider>
          </ThemeProvider>
        </BetaLayoutContext.Provider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
};

export default App;
