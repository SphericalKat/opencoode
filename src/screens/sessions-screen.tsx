import type { Project, SessionInfo } from "@opencode/client";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { ShellIcon } from "../components/shell-icon";
import {
  Button,
  Busy,
  Card,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  Row,
  Sheet,
  confirmAction,
} from "../components/ui";
import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { pageInset } from "../lib/layout";
import { useNativePresentation } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";

interface Props {
  client: Client;
  directory: string;
  onOpenSession: (id: string) => void;
  revision?: number;
  selectedSessionID?: string;
  compact?: boolean;
  onOpenNavigation?: () => void;
  betaLayout?: boolean;
  projectScope?: { directory: string; revision: number };
  onChooseDirectory?: () => void;
  onNewSession?: (directory: string) => void;
}

const directoryName = (directory: string): string => {
  let name = "";
  for (const part of directory.split(/[\\/]/u)) {
    if (part) {
      name = part;
    }
  }
  return name || directory;
};

const sessionDateGroup = (time: number): string => {
  const date = new Date(time);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  today.setDate(today.getDate() - 1);
  return date.toDateString() === today.toDateString() ? "Yesterday" : "Older";
};

const updatedLabel = (time: number): string => {
  const date = new Date(time);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year:
          date.getFullYear() === today.getFullYear() ? undefined : "numeric",
      });
};

const sessionStatus = (session: SessionInfo, working: boolean): string => {
  if (working) {
    return "Working";
  }
  if (session.outcome === "succeeded") {
    return "Completed";
  }
  if (session.outcome === "failed") {
    return "Needs attention";
  }
  if (session.outcome === "interrupted") {
    return "Stopped";
  }
  return "Ready";
};

const isUnread = (session: SessionInfo) =>
  session.time.idle &&
  (!session.time.viewed || session.time.viewed < session.time.idle);

const visibleSessionStatus = (status: string): string | undefined =>
  status === "Working" || status === "Needs attention" || status === "Stopped"
    ? status
    : undefined;

const childLabel = (session: SessionInfo): string | undefined =>
  session.parentID ? "Child session" : undefined;

const startsDateGroup = ({
  betaHome,
  group,
  index,
  search,
  sessions,
}: {
  betaHome: boolean;
  group: string;
  index: number;
  search: string;
  sessions: SessionInfo[];
}): boolean =>
  Platform.OS === "android" &&
  !search.trim() &&
  (!betaHome || index > 0) &&
  (index === 0 || sessionDateGroup(sessions[index - 1].time.updated) !== group);

const isTranscript = (
  transcript: { info?: unknown; messages?: unknown } | null | undefined
): boolean => {
  if (!transcript || typeof transcript !== "object") {
    return false;
  }
  if (!transcript.info || typeof transcript.info !== "object") {
    return false;
  }
  return Array.isArray(transcript.messages);
};

const headerTitle = (archived: boolean, compact: boolean): string => {
  if (Platform.OS === "android" && archived) {
    return "Archived sessions";
  }
  return compact ? "Your sessions" : "Sessions";
};

const betaGroupLabel = (
  archived: boolean,
  search: string,
  sessions: SessionInfo[]
): string => {
  if (archived) {
    return "Archived sessions";
  }
  if (search.trim()) {
    return "Search results";
  }
  return sessions.length ? sessionDateGroup(sessions[0].time.updated) : "Today";
};

const emptyTitle = (
  listUnavailable: boolean,
  search: string,
  archived: boolean
): string => {
  if (listUnavailable) {
    return "Could not load sessions";
  }
  if (search.trim()) {
    return "No matching sessions";
  }
  return archived ? "No archived sessions" : "Start your first session";
};

const emptyDetail = (
  listUnavailable: boolean,
  search: string,
  archived: boolean
): string => {
  if (listUnavailable) {
    return "Use Retry to load your history.";
  }
  if (search.trim()) {
    return "Try another title or clear the search.";
  }
  return archived
    ? "Sessions appear here after you archive them."
    : "Create a session to work with OpenCode in this directory.";
};

const actionsTitle = (actions: "menu" | "filter" | "create"): string => {
  if (actions === "create") {
    return "Name a new session";
  }
  return actions === "filter" ? "Session history" : "Session list actions";
};

const sessionListEvents = new Set([
  "session.created",
  "session.renamed",
  "session.archived",
  "session.unarchived",
  "session.deleted",
  "session.forked",
  "session.moved",
  "session.viewed",
  "session.agent.selected",
  "session.model.selected",
  "session.execution.started",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.inbox.enqueued",
  "session.inbox.delivered",
  "session.shell.started",
  "session.shell.ended",
]);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    actionButton: {
      alignItems: "center",
      justifyContent: "center",
      marginEnd: -16,
      marginStart: Platform.OS === "android" ? 0 : 16,
      minHeight: Platform.OS === "android" ? 48 : 44,
      minWidth: Platform.OS === "android" ? 48 : 44,
    },
    androidSearch: {
      alignItems: "center",
      backgroundColor: colors.panel,
      borderRadius: 8,
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
    },
    androidSearchInput: {
      backgroundColor: "transparent",
      borderWidth: 0,
      boxShadow: [],
      fontSize: 15,
      includeFontPadding: false,
      lineHeight: 21,
      minHeight: 40,
      paddingHorizontal: 0,
      paddingVertical: 9,
      textAlignVertical: "center",
    },
    betaDateGroup: { paddingBottom: 12, paddingTop: 20 },
    betaGroupHeader: {
      alignItems: "center",
      flexDirection: "row",
      minHeight: 48,
      paddingLeft: 12,
    },
    betaGroupLabel: { flex: 1, fontSize: 13, lineHeight: 19 },
    betaHeader: {
      gap: 8,
      paddingBottom: 0,
      paddingHorizontal: 12,
      paddingTop: 8,
    },
    betaList: { gap: 0, paddingBottom: 12, paddingHorizontal: 6 },
    betaMetadata: { fontSize: 13, lineHeight: 17 },
    betaMetadataRow: { alignItems: "center", flexDirection: "row" },
    betaNewLabel: { color: colors.muted, fontSize: 14, lineHeight: 19 },
    betaNewSession: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 12,
    },
    betaProjectName: { flexShrink: 1 },
    betaScreen: { backgroundColor: colors.bg },
    betaSearch: { borderRadius: 6, paddingHorizontal: 14 },
    betaSearchInput: { fontSize: 14, lineHeight: 19, paddingVertical: 10 },
    betaSession: { borderRadius: 6, minHeight: 48 },
    betaSessionMain: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      paddingLeft: 12,
      paddingRight: 12,
      paddingVertical: 7,
    },
    betaSessionText: { flex: 1, gap: 0, minWidth: 0 },
    betaSessionTitle: { fontSize: 14, lineHeight: 19 },
    clearSearch: {
      alignItems: "center",
      justifyContent: "center",
      marginEnd: -12,
      minHeight: 40,
      width: 40,
    },
    compactHeader: { paddingTop: 8 },
    compactTitle: { fontSize: 19, letterSpacing: -0.2, lineHeight: 24 },
    dateGroup: {
      fontSize: 13,
      lineHeight: 19,
      paddingBottom: 6,
      paddingHorizontal: 12,
      paddingTop: 4,
    },
    drawerTitle: { fontSize: 15, fontWeight: "500", lineHeight: 21 },
    filter: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: Platform.OS === "android" ? 48 : 44,
      minWidth: Platform.OS === "android" ? 48 : 44,
    },
    filterText: { fontSize: 14, lineHeight: 21 },
    header: {
      gap: 8,
      paddingBottom: 10,
      paddingHorizontal: pageInset,
      paddingTop: 6,
    },
    headingRow: { flexWrap: "nowrap", gap: Platform.OS === "android" ? 0 : 8 },
    headingText: { flex: 1, gap: 2, minWidth: 0 },
    laterDateGroup: { paddingTop: 16 },
    list: {
      flexGrow: 1,
      gap: 2,
      paddingBottom: 24,
      paddingHorizontal: pageInset,
    },
    menuRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
      justifyContent: "space-between",
      minHeight: Platform.OS === "android" ? 48 : 44,
    },
    metadata: { fontSize: 12, lineHeight: 17 },
    navigationButton: {
      alignItems: "center",
      justifyContent: "center",
      marginEnd: 16,
      marginStart: -16,
      minHeight: Platform.OS === "android" ? 48 : 44,
      minWidth: Platform.OS === "android" ? 48 : 44,
    },
    newButton: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: Platform.OS === "android" ? 48 : 44,
      minWidth: Platform.OS === "android" ? 48 : 44,
    },
    pressed: { opacity: 0.55 },
    projectBadge: {
      alignItems: "center",
      backgroundColor: colors.muted,
      borderRadius: 3,
      justifyContent: "center",
      minHeight: 16,
      minWidth: 16,
    },
    projectBadgeLabel: {
      color: colors.panel,
      fontSize: 11,
      includeFontPadding: false,
      lineHeight: 15,
    },
    projectChevron: { marginHorizontal: 8, transform: [{ rotate: "90deg" }] },
    projectOption: { flex: 1, gap: 2, minWidth: 0 },
    projectSelector: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 6,
    },
    projectSelectorLabel: { flex: 1, fontSize: 14, lineHeight: 19 },
    projectSheetContent: { gap: 0 },
    rowAction: {
      alignItems: "center",
      justifyContent: "center",
      marginRight: 4,
      minHeight: Platform.OS === "android" ? 48 : 44,
      minWidth: Platform.OS === "android" ? 48 : 44,
    },
    screen: { backgroundColor: colors.bg, flex: 1 },
    search: {
      backgroundColor: colors.panel,
      borderRadius: 8,
      fontSize: 15,
      includeFontPadding: false,
      lineHeight: 21,
      minHeight: 40,
      paddingHorizontal: 15,
      paddingVertical: 9,
      textAlignVertical: "center",
    },
    searchField: { flex: 1, minWidth: 0 },
    searchRow: { flexWrap: "nowrap", gap: 8 },
    selected: { backgroundColor: colors.selected },
    session: {
      alignItems: "center",
      borderRadius: 10,
      flexDirection: "row",
      minHeight: Platform.OS === "android" ? 56 : 64,
    },
    sessionMain: {
      flex: 1,
      gap: 3,
      minWidth: 0,
      paddingLeft: Platform.OS === "android" ? 12 : 16,
      paddingVertical: Platform.OS === "android" ? 8 : 10,
    },
    sessionPressed: { opacity: 0.65 },
    sessionText: { gap: 3 },
    sessionTitle: {
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 21,
      minWidth: 0,
    },
    title: {
      fontSize: 18,
      fontWeight: "600",
      letterSpacing: -0.2,
      lineHeight: 23,
    },
  });

type ActionsMode = "menu" | "filter" | "create";

interface Scope {
  client: Client;
  directory: string;
  listDirectory: string | undefined;
}

const SESSION_PAGE_SIZE = 40;
const REQUEST_TIMEOUT_MS = 15_000;
const LIVE_RETRY_BASE_MS = 1000;
const LIVE_RETRY_MAX_MS = 15_000;
const LIVE_RETRY_MAX_EXPONENT = 4;
const REFRESH_DEBOUNCE_MS = 300;
const LIST_RESET_DELAY_MS = 250;

const isForegroundState = (state: string | null | undefined): boolean =>
  state !== "background" && state !== "inactive";

const rejectOnAbort = (signal: AbortSignal, createError: () => Error) => {
  const { promise, reject } = Promise.withResolvers<never>();
  const onAbort = () => reject(createError());
  signal.addEventListener("abort", onAbort, { once: true });
  return {
    dispose: () => signal.removeEventListener("abort", onAbort),
    promise,
  };
};

const startRefreshRequest = (external?: AbortSignal) => {
  const controller = new AbortController();
  const state = { timedOut: false };
  const cancelled = rejectOnAbort(
    controller.signal,
    () =>
      new Error(
        state.timedOut
          ? "The server did not respond within 15 seconds. Check your connection, then retry."
          : "Session refresh cancelled"
      )
  );
  const cancel = () => controller.abort();
  if (external?.aborted) {
    cancel();
  } else {
    external?.addEventListener("abort", cancel, { once: true });
  }
  const timeout = setTimeout(() => {
    state.timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);
  return {
    cancelled: cancelled.promise,
    controller,
    finish: () => {
      clearTimeout(timeout);
      external?.removeEventListener("abort", cancel);
      cancelled.dispose();
    },
    state,
  };
};

type RefreshRequest = ReturnType<typeof startRefreshRequest>;

interface PageQuery {
  archived: boolean;
  cursor: string | undefined;
  directory: string | undefined;
  limit: number;
  search: string;
}

const fetchSessionPage = async (
  client: Client,
  query: PageQuery,
  request: RefreshRequest
) => {
  const { signal } = request.controller;
  try {
    const [page, running] = await Promise.race([
      Promise.allSettled([
        client.session.list(
          {
            archived: query.archived,
            cursor: query.cursor,
            directory: query.directory,
            limit: query.limit,
            order: "desc",
            search: query.search.trim() || undefined,
          },
          { signal }
        ),
        client.session.active({ signal }),
      ]),
      request.cancelled,
    ]);
    return { ok: true as const, page, running };
  } catch (error_) {
    return { error: error_, ok: false as const };
  }
};

type PageFetch = Awaited<ReturnType<typeof fetchSessionPage>>;

interface RefreshSink {
  loadedCount: { current: number };
  setActive: Dispatch<SetStateAction<Set<string>>>;
  setListError: Dispatch<SetStateAction<string | undefined>>;
  setListUnavailable: Dispatch<SetStateAction<boolean>>;
  setNextCursor: Dispatch<SetStateAction<string | undefined>>;
  setSessions: Dispatch<SetStateAction<SessionInfo[]>>;
  setStatusError: Dispatch<SetStateAction<string | undefined>>;
}

interface RefreshOutcome {
  aborted: boolean;
  cursor: string | undefined;
  timedOut: boolean;
}

const mergeSessions = (
  previous: SessionInfo[],
  incoming: SessionInfo[]
): SessionInfo[] => [
  ...new Map(
    [...previous, ...incoming].map((item) => [item.id, item])
  ).values(),
];

const reportListFailure = (error_: unknown, sink: RefreshSink) => {
  sink.setListUnavailable(true);
  sink.setListError(errorMessage(error_));
};

const applyRefreshResult = (
  result: PageFetch,
  outcome: RefreshOutcome,
  sink: RefreshSink
) => {
  if (!result.ok) {
    if (outcome.timedOut || !outcome.aborted) {
      reportListFailure(result.error, sink);
    }
    return;
  }
  if (outcome.aborted) {
    return;
  }
  const { page, running } = result;
  if (page.status === "rejected") {
    reportListFailure(page.reason, sink);
    return;
  }
  sink.setListUnavailable(false);
  sink.setListError(undefined);
  sink.setSessions((previous) => {
    const next = outcome.cursor
      ? mergeSessions(previous, page.value.data)
      : page.value.data;
    sink.loadedCount.current = Math.max(SESSION_PAGE_SIZE, next.length);
    return next;
  });
  sink.setNextCursor(page.value.cursor.next ?? undefined);
  if (running.status === "fulfilled") {
    sink.setActive(new Set(Object.keys(running.value)));
    sink.setStatusError(undefined);
  } else {
    sink.setActive(new Set());
    sink.setStatusError(
      `Active status unavailable: ${errorMessage(running.reason)}`
    );
  }
};

interface LiveEvent {
  type: string;
}

const raceIterator = <T,>(
  iterator: AsyncIterator<T>,
  cancelled: Promise<never>
): AsyncIterable<T> => ({
  [Symbol.asyncIterator]: () => ({
    next: () => Promise.race([iterator.next(), cancelled]),
  }),
});

const createRefreshScheduler = (
  signal: AbortSignal,
  refresh: (signal: AbortSignal) => Promise<void>
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    cancel: () => clearTimeout(timer),
    schedule: () => {
      if (timer) {
        return;
      }
      timer = setTimeout(() => {
        timer = undefined;
        if (!signal.aborted) {
          void refresh(signal);
        }
      }, REFRESH_DEBOUNCE_MS);
    },
  };
};

const createRetryWait = () => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let release: (() => void) | undefined;
  return {
    cancel: () => {
      clearTimeout(timer);
      release?.();
    },
    wait: (delay: number) => {
      const { promise, resolve } = Promise.withResolvers<undefined>();
      const finish = () => resolve(undefined);
      release = finish;
      timer = setTimeout(finish, delay);
      return promise;
    },
  };
};

interface LiveSession {
  attempts: { count: number };
  client: Client;
  refresh: (signal: AbortSignal) => Promise<void>;
  retry: ReturnType<typeof createRetryWait>;
  scheduler: ReturnType<typeof createRefreshScheduler>;
  setStreamError: (message: string | undefined) => void;
  signal: AbortSignal;
}

const handleLiveEvent = (live: LiveSession, event: LiveEvent) => {
  live.setStreamError(undefined);
  live.attempts.count = 0;
  if (
    event.type === "server.connected" ||
    event.type === "location.shutdown" ||
    sessionListEvents.has(event.type)
  ) {
    live.scheduler.schedule();
  }
};

const consumeLiveEvents = async (live: LiveSession) => {
  const { signal } = live;
  const attempt = new AbortController();
  const cancelAttempt = () => attempt.abort();
  signal.addEventListener("abort", cancelAttempt, { once: true });
  const state = { timedOut: false };
  const cancelled = rejectOnAbort(
    attempt.signal,
    () =>
      new Error(
        state.timedOut
          ? "The live connection did not respond within 15 seconds. Check your server connection."
          : "Live connection cancelled"
      )
  );
  if (signal.aborted) {
    cancelAttempt();
  }
  const initialTimeout = setTimeout(() => {
    state.timedOut = true;
    attempt.abort();
  }, REQUEST_TIMEOUT_MS);
  const eventStream = live.client.event.subscribe({ signal: attempt.signal });
  const iterator = eventStream[Symbol.asyncIterator]();
  try {
    for await (const event of raceIterator(iterator, cancelled.promise)) {
      if (signal.aborted) {
        break;
      }
      clearTimeout(initialTimeout);
      handleLiveEvent(live, event);
    }
  } finally {
    clearTimeout(initialTimeout);
    signal.removeEventListener("abort", cancelAttempt);
    attempt.abort();
    cancelled.dispose();
    void iterator.return?.().catch(() => {
      // Closing the iterator is best effort.
    });
  }
  if (!signal.aborted) {
    throw new Error("The live connection closed");
  }
};

const keepLive = async (live: LiveSession): Promise<void> => {
  const { signal } = live;
  if (signal.aborted) {
    return;
  }
  try {
    await consumeLiveEvents(live);
  } catch (error_) {
    if (signal.aborted) {
      return;
    }
    live.setStreamError(`Live updates unavailable: ${errorMessage(error_)}`);
    const retryDelay = Math.min(
      LIVE_RETRY_BASE_MS *
        2 ** Math.min(live.attempts.count, LIVE_RETRY_MAX_EXPONENT),
      LIVE_RETRY_MAX_MS
    );
    live.attempts.count += 1;
    await live.retry.wait(retryDelay);
    if (!signal.aborted) {
      await live.refresh(signal);
    }
  }
  await keepLive(live);
};

interface LiveUpdatesOptions {
  client: Client;
  refresh: (signal: AbortSignal) => Promise<void>;
  setStreamError: (message: string | undefined) => void;
}

const startLiveUpdates = ({
  client,
  refresh,
  setStreamError,
}: LiveUpdatesOptions): (() => void) => {
  const controller = new AbortController();
  const live: LiveSession = {
    attempts: { count: 0 },
    client,
    refresh,
    retry: createRetryWait(),
    scheduler: createRefreshScheduler(controller.signal, refresh),
    setStreamError,
    signal: controller.signal,
  };
  void refresh(controller.signal);
  keepLive(live).catch((error_) => {
    if (!controller.signal.aborted) {
      setStreamError(errorMessage(error_));
    }
  });
  return () => {
    controller.abort();
    live.scheduler.cancel();
    live.retry.cancel();
  };
};

const settle = async (
  operation: () => Promise<void>
): Promise<{ error: unknown } | undefined> => {
  try {
    await operation();
    return undefined;
  } catch (error_) {
    return { error: error_ };
  }
};

const withCleanup = async (
  task: () => Promise<void>,
  cleanup: () => void
): Promise<void> => {
  try {
    await task();
  } finally {
    cleanup();
  }
};

const settleProjects = async (
  client: Client,
  signal: AbortSignal | undefined
): Promise<{ items: Project[] } | { error: unknown }> => {
  try {
    return { items: await client.project.list(undefined, { signal }) };
  } catch (error_) {
    return { error: error_ };
  }
};

const projectName = (projects: Project[], item: SessionInfo): string =>
  projects.find((project) => project.id === item.projectID)?.name ||
  directoryName(
    projects.find((project) => project.id === item.projectID)?.canonical ??
      item.location.directory
  );

const projectSelectorLabel = (
  projects: Project[],
  projectDirectory: string | undefined
): string => {
  if (!projectDirectory) {
    return "All projects";
  }
  return (
    projects.find((project) => project.canonical === projectDirectory)?.name ||
    directoryName(projectDirectory)
  );
};

const metadataLine = (
  item: SessionInfo,
  visibleStatus: string | undefined,
  unread: boolean
): string =>
  [
    visibleStatus,
    unread ? "Unread" : undefined,
    updatedLabel(item.time.updated),
    childLabel(item),
  ]
    .filter(Boolean)
    .join(" · ");

const promptHistoryChoice = (
  scheme: string,
  onChoose: (archived: boolean) => void
): Promise<void> => {
  const { promise, resolve: finish } = Promise.withResolvers<undefined>();
  const resolve = () => finish(undefined);
  const choose = (value: boolean) => {
    onChoose(value);
    resolve();
  };
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        cancelButtonIndex: 2,
        options: ["Recent sessions", "Archived sessions", "Cancel"],
        title: "Session history",
        userInterfaceStyle: scheme === "dark" ? "dark" : "light",
      },
      (index) => {
        if (index < 2) {
          choose(index === 1);
        } else {
          resolve();
        }
      }
    );
  } else {
    Alert.alert(
      "Session history",
      undefined,
      [
        { onPress: () => choose(false), text: "Recent sessions" },
        { onPress: () => choose(true), text: "Archived sessions" },
        { onPress: () => resolve(), style: "cancel", text: "Cancel" },
      ],
      { cancelable: true, onDismiss: () => resolve() }
    );
  }
  return promise;
};

const useMounted = () => {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
};

const useForeground = (): boolean => {
  const [foreground, setForeground] = useState(
    isForegroundState(AppState.currentState)
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => subscription.remove();
  }, []);
  return foreground;
};

interface SessionListOptions {
  archived: boolean;
  client: Client;
  listDirectory: string | undefined;
  revision: number | undefined;
  search: string;
}

const useSessionList = ({
  archived,
  client,
  listDirectory,
  revision,
  search,
}: SessionListOptions) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [listUnavailable, setListUnavailable] = useState(false);
  const [listError, setListError] = useState<string>();
  const [statusError, setStatusError] = useState<string>();
  const [streamError, setStreamError] = useState<string>();
  const mounted = useMounted();
  const foreground = useForeground();
  const generation = useRef(0);
  const refreshRequest = useRef<AbortController | null>(null);
  const quietRefreshPending = useRef(false);
  const paging = useRef(false);
  const loadedCount = useRef(SESSION_PAGE_SIZE);
  const refreshRef = useRef<
    (quiet?: boolean, signal?: AbortSignal) => Promise<void>
  >(async () => {
    // Replaced once the list refresh is wired up.
  });

  const [query, setQuery] = useState({
    archived,
    client,
    listDirectory,
    revision,
    search,
  });
  if (
    query.archived !== archived ||
    query.client !== client ||
    query.listDirectory !== listDirectory ||
    query.revision !== revision ||
    query.search !== search
  ) {
    setQuery({ archived, client, listDirectory, revision, search });
    setSessions([]);
    setNextCursor(undefined);
    setLoading(true);
  }

  const refresh = useCallback(
    async (cursor?: string, quiet = false, signal?: AbortSignal) => {
      if (quiet && refreshRequest.current) {
        quietRefreshPending.current = true;
        return;
      }
      quietRefreshPending.current = false;
      generation.current += 1;
      const request = generation.current;
      refreshRequest.current?.abort();
      const pending = startRefreshRequest(signal);
      const { controller } = pending;
      refreshRequest.current = controller;
      if (!quiet) {
        setLoading(true);
        setListError(undefined);
      }
      const result = await fetchSessionPage(
        query.client,
        {
          archived: query.archived,
          cursor,
          directory: query.listDirectory,
          limit: cursor ? SESSION_PAGE_SIZE : loadedCount.current,
          search: query.search,
        },
        pending
      );
      if (mounted.current && request === generation.current) {
        applyRefreshResult(
          result,
          {
            aborted: controller.signal.aborted,
            cursor,
            timedOut: pending.state.timedOut,
          },
          {
            loadedCount,
            setActive,
            setListError,
            setListUnavailable,
            setNextCursor,
            setSessions,
            setStatusError,
          }
        );
      }
      pending.finish();
      if (refreshRequest.current === controller) {
        refreshRequest.current = null;
      }
      if (request !== generation.current) {
        return;
      }
      if (mounted.current) {
        setLoading(false);
      }
      paging.current = false;
      if (
        mounted.current &&
        quietRefreshPending.current &&
        !controller.signal.aborted
      ) {
        quietRefreshPending.current = false;
        void refreshRef.current(true, signal);
      }
    },
    [query, mounted]
  );

  useEffect(() => {
    refreshRef.current = (quiet, signal) => refresh(undefined, quiet, signal);
  }, [refresh]);

  useEffect(() => {
    generation.current += 1;
    loadedCount.current = SESSION_PAGE_SIZE;
    const timer = setTimeout(() => {
      if (isForegroundState(AppState.currentState)) {
        void refresh();
      }
    }, LIST_RESET_DELAY_MS);
    return () => {
      clearTimeout(timer);
      generation.current += 1;
      refreshRequest.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (!foreground) {
      refreshRequest.current?.abort();
      quietRefreshPending.current = false;
      return;
    }
    return startLiveUpdates({
      client,
      refresh: (signal) => refreshRef.current(true, signal),
      setStreamError,
    });
  }, [client, foreground]);

  const loadMore = () => {
    if (loading || paging.current || !nextCursor) {
      return;
    }
    paging.current = true;
    void refresh(nextCursor);
  };

  return {
    active,
    listError,
    listUnavailable,
    loadMore,
    loading,
    nextCursor,
    refresh,
    sessions,
    statusError,
    streamError,
  };
};

interface ProjectsOptions {
  betaHome: boolean;
  client: Client;
  projectScope: Props["projectScope"];
}

const useProjects = ({ betaHome, client, projectScope }: ProjectsOptions) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDirectory, setProjectDirectory] = useState<string | undefined>(
    betaHome && projectScope ? projectScope.directory : undefined
  );
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(betaHome);
  const [projectsError, setProjectsError] = useState<string>();
  const mounted = useMounted();
  const latestClient = useRef(client);

  const [synced, setSynced] = useState({ betaHome, client, projectScope });
  const clientChanged = synced.client !== client;
  const modeChanged = synced.betaHome !== betaHome;
  const scopeChanged = modeChanged || synced.projectScope !== projectScope;
  if (clientChanged || scopeChanged) {
    setSynced({ betaHome, client, projectScope });
    if (clientChanged || modeChanged) {
      setProjectDirectory(undefined);
      setProjects([]);
      setProjectsOpen(false);
      setProjectsLoading(betaHome);
      setProjectsError(undefined);
    }
    if (scopeChanged && betaHome && projectScope) {
      setProjectDirectory(projectScope.directory);
    }
  }

  useEffect(() => {
    latestClient.current = client;
  }, [client]);

  const applyProjects = useCallback(
    (
      result: Awaited<ReturnType<typeof settleProjects>>,
      signal: AbortSignal | undefined
    ) => {
      if (
        signal?.aborted ||
        !mounted.current ||
        latestClient.current !== client
      ) {
        return;
      }
      if ("items" in result) {
        setProjects(result.items);
      } else {
        setProjectsError(errorMessage(result.error));
      }
      setProjectsLoading(false);
    },
    [client, mounted]
  );

  const loadProjects = async (signal?: AbortSignal) => {
    setProjectsLoading(true);
    setProjectsError(undefined);
    applyProjects(await settleProjects(client, signal), signal);
  };

  useEffect(() => {
    if (!betaHome) {
      return;
    }
    const controller = new AbortController();
    void settleProjects(client, controller.signal).then((result) =>
      applyProjects(result, controller.signal)
    );
    return () => controller.abort();
  }, [betaHome, client, applyProjects]);

  return {
    loadProjects,
    projectDirectory,
    projects,
    projectsError,
    projectsLoading,
    projectsOpen,
    setProjectDirectory,
    setProjectsOpen,
  };
};

interface ScopeKey {
  client: Client;
  creationDirectory: string;
  listDirectory: string | undefined;
}

const scopeKeyChanged = (previous: ScopeKey, next: ScopeKey): boolean =>
  previous.client !== next.client ||
  previous.creationDirectory !== next.creationDirectory ||
  previous.listDirectory !== next.listDirectory;

interface ProjectSelectorProps {
  expanded: boolean;
  label: string;
  onPress: () => void;
}

const ProjectSelector = ({
  expanded,
  label,
  onPress,
}: ProjectSelectorProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Select project"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.projectSelector,
        pressed && styles.pressed,
      ]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
        <Path
          d="M3 5h6l2 3h10v12H3V5Z"
          stroke={colors.muted}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </Svg>
      <BodyText numberOfLines={1} style={styles.projectSelectorLabel}>
        {label}
      </BodyText>
      <View style={styles.projectChevron}>
        <ShellIcon name="chevron" color={colors.faint} size={10} />
      </View>
    </Pressable>
  );
};

interface NewSessionButtonProps {
  busy: boolean;
  creating: boolean;
  onPress: () => void;
}

const NewSessionIconButton = ({
  busy,
  creating,
  onPress,
}: NewSessionButtonProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New session"
      accessibilityState={{ busy: creating, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.newButton,
        (pressed || busy) && styles.pressed,
      ]}
    >
      {creating ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <ShellIcon name="compose" color={colors.text} size={20} />
      )}
    </Pressable>
  );
};

const NewSessionPill = ({ busy, creating, onPress }: NewSessionButtonProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New session"
      accessibilityState={{ busy: creating, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.betaNewSession,
        (pressed || busy) && styles.pressed,
      ]}
    >
      {creating ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <ShellIcon name="compose" color={colors.muted} size={14} />
      )}
      <BodyText style={styles.betaNewLabel}>New session</BodyText>
    </Pressable>
  );
};

interface HeadingRowProps extends NewSessionButtonProps {
  archived: boolean;
  compact: boolean;
  compactHeader: boolean;
  onOpenActions: () => void;
  onOpenNavigation: (() => void) | undefined;
}

const HeadingRow = ({
  archived,
  busy,
  compact,
  compactHeader,
  creating,
  onOpenActions,
  onOpenNavigation,
  onPress,
}: HeadingRowProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Row style={styles.headingRow}>
      {!compact && onOpenNavigation && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation"
          onPress={onOpenNavigation}
          style={({ pressed }) => [
            styles.navigationButton,
            pressed && styles.pressed,
          ]}
        >
          <ShellIcon name="menu" color={colors.text} />
        </Pressable>
      )}
      <View style={styles.headingText}>
        <BodyText
          accessibilityRole="header"
          numberOfLines={1}
          style={[
            styles.title,
            compactHeader && styles.compactTitle,
            compact && Platform.OS === "android" && styles.drawerTitle,
          ]}
        >
          {headerTitle(archived, compact)}
        </BodyText>
      </View>
      <NewSessionIconButton busy={busy} creating={creating} onPress={onPress} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Session list actions"
        onPress={onOpenActions}
        style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.pressed,
        ]}
      >
        <ShellIcon name="more" color={colors.muted} size={18} />
      </Pressable>
    </Row>
  );
};

interface SearchProps {
  archived: boolean;
  betaHome: boolean;
  onChangeSearch: (value: string) => void;
  search: string;
}

const searchPlaceholder = (archived: boolean): string =>
  archived ? "Search archived sessions" : "Search sessions";

const AndroidSearch = ({
  archived,
  betaHome,
  onChangeSearch,
  search,
}: SearchProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.androidSearch,
        betaHome && styles.betaSearch,
        betaHome && {
          backgroundColor: scheme === "dark" ? colors.panel : colors.raised,
        },
      ]}
    >
      <ShellIcon name="search" color={colors.faint} size={16} />
      <Field
        accessibilityLabel="Search sessions"
        placeholder={searchPlaceholder(archived)}
        value={search}
        onChangeText={onChangeSearch}
        containerStyle={styles.searchField}
        style={[styles.androidSearchInput, betaHome && styles.betaSearchInput]}
      />
      {!!search && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear session search"
          hitSlop={4}
          onPress={() => onChangeSearch("")}
          style={({ pressed }) => [
            styles.clearSearch,
            pressed && styles.pressed,
          ]}
        >
          <ShellIcon name="close" color={colors.muted} size={16} />
        </Pressable>
      )}
    </View>
  );
};

const NativeSearchRow = ({
  archived,
  onChangeSearch,
  onChooseHistory,
  search,
}: Omit<SearchProps, "betaHome"> & { onChooseHistory: () => void }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Row style={styles.searchRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Field
          accessibilityLabel="Search sessions"
          placeholder={searchPlaceholder(archived)}
          value={search}
          onChangeText={onChangeSearch}
          clearButtonMode="while-editing"
          style={styles.search}
        />
      </View>
      {search ? (
        <Button
          title="Clear"
          accessibilityLabel="Clear session search"
          compact
          variant="ghost"
          onPress={() => onChangeSearch("")}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Session history: ${archived ? "Archived" : "Recent"}`}
          onPress={onChooseHistory}
          style={styles.filter}
        >
          <BodyText muted style={styles.filterText}>
            {archived ? "Archived" : "Recent"} ⌄
          </BodyText>
        </Pressable>
      )}
    </Row>
  );
};

interface SessionsHeaderProps {
  archived: boolean;
  betaHome: boolean;
  busy: boolean;
  compact: boolean;
  compactHeader: boolean;
  creating: boolean;
  error: string | undefined;
  listError: string | undefined;
  onChangeSearch: (value: string) => void;
  onChooseHistory: () => void;
  onOpenActions: () => void;
  onOpenNavigation: (() => void) | undefined;
  onOpenProjects: () => void;
  onRefresh: () => void;
  onStartSession: () => void;
  projectLabel: string;
  projectsOpen: boolean;
  search: string;
  statusError: string | undefined;
  streamError: string | undefined;
}

const SessionsHeader = ({
  archived,
  betaHome,
  busy,
  compact,
  compactHeader,
  creating,
  error,
  listError,
  onChangeSearch,
  onChooseHistory,
  onOpenActions,
  onOpenNavigation,
  onOpenProjects,
  onRefresh,
  onStartSession,
  projectLabel,
  projectsOpen,
  search,
  statusError,
  streamError,
}: SessionsHeaderProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View
      style={[
        styles.header,
        compactHeader && styles.compactHeader,
        betaHome && styles.betaHeader,
      ]}
    >
      {betaHome ? (
        <ProjectSelector
          expanded={projectsOpen}
          label={projectLabel}
          onPress={onOpenProjects}
        />
      ) : (
        <HeadingRow
          archived={archived}
          busy={busy}
          compact={compact}
          compactHeader={compactHeader}
          creating={creating}
          onOpenActions={onOpenActions}
          onOpenNavigation={onOpenNavigation}
          onPress={onStartSession}
        />
      )}
      {Platform.OS === "android" ? (
        <AndroidSearch
          archived={archived}
          betaHome={betaHome}
          onChangeSearch={onChangeSearch}
          search={search}
        />
      ) : (
        <NativeSearchRow
          archived={archived}
          onChangeSearch={onChangeSearch}
          onChooseHistory={onChooseHistory}
          search={search}
        />
      )}
      <ErrorNotice error={listError} onRetry={onRefresh} />
      <ErrorNotice error={error} />
      {statusError && <BodyText muted>{statusError}</BodyText>}
      {streamError && <BodyText muted>{streamError}</BodyText>}
    </View>
  );
};

interface SessionMainProps {
  active: boolean;
  betaHome: boolean;
  item: SessionInfo;
  name: string;
  onManage: (item: SessionInfo) => void;
  onOpen: (id: string) => void;
}

const BetaMetadata = ({
  name,
  unread,
  visibleStatus,
}: {
  name: string;
  unread: boolean;
  visibleStatus: string | undefined;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.betaMetadataRow}>
      <BodyText
        muted
        numberOfLines={1}
        style={[styles.betaMetadata, styles.betaProjectName]}
      >
        {name}
      </BodyText>
      {visibleStatus || unread ? (
        <BodyText muted numberOfLines={1} style={styles.betaMetadata}>
          {" "}
          ·{" "}
          {[visibleStatus, unread ? "Unread" : undefined]
            .filter(Boolean)
            .join(" · ")}
        </BodyText>
      ) : null}
    </View>
  );
};

const SessionMain = ({
  active,
  betaHome,
  item,
  name,
  onManage,
  onOpen,
}: SessionMainProps) => {
  const styles = useThemedStyles(createStyles);
  const status = sessionStatus(item, active);
  const unread = !!isUnread(item);
  const visibleStatus = visibleSessionStatus(status);
  const manage = () => onManage(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title || "Untitled session"}`}
      accessibilityHint={`${status}. Updated ${new Date(item.time.updated).toLocaleString()}`}
      onPress={() => onOpen(item.id)}
      onLongPress={betaHome ? manage : undefined}
      accessibilityActions={
        betaHome ? [{ label: "Manage session", name: "manage" }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "manage") {
          manage();
        }
      }}
      style={({ pressed }) => [
        styles.sessionMain,
        betaHome && styles.betaSessionMain,
        pressed && styles.sessionPressed,
      ]}
    >
      {betaHome && (
        <View style={styles.projectBadge}>
          <BodyText style={styles.projectBadgeLabel}>
            {name.charAt(0).toUpperCase()}
          </BodyText>
        </View>
      )}
      <View style={[styles.sessionText, betaHome && styles.betaSessionText]}>
        <BodyText
          numberOfLines={1}
          style={[styles.sessionTitle, betaHome && styles.betaSessionTitle]}
        >
          {item.title || "Untitled session"}
        </BodyText>
        {betaHome ? (
          <BetaMetadata
            name={name}
            unread={unread}
            visibleStatus={visibleStatus}
          />
        ) : (
          <BodyText muted numberOfLines={1} style={styles.metadata}>
            {metadataLine(item, visibleStatus, unread)}
          </BodyText>
        )}
      </View>
    </Pressable>
  );
};

interface SessionRowProps extends SessionMainProps {
  index: number;
  search: string;
  selected: boolean;
  sessions: SessionInfo[];
}

const SessionRow = ({
  index,
  search,
  selected,
  sessions,
  ...mainProps
}: SessionRowProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { betaHome, item, onManage } = mainProps;
  const group = sessionDateGroup(item.time.updated);
  const startsGroup = startsDateGroup({
    betaHome,
    group,
    index,
    search,
    sessions,
  });
  return (
    <View>
      {startsGroup && (
        <BodyText
          accessibilityRole="header"
          muted
          style={[
            styles.dateGroup,
            index > 0 && styles.laterDateGroup,
            betaHome && styles.betaDateGroup,
          ]}
        >
          {group}
        </BodyText>
      )}
      <View
        style={[
          styles.session,
          betaHome && styles.betaSession,
          selected && styles.selected,
        ]}
      >
        <SessionMain {...mainProps} />
        {!betaHome && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Manage ${item.title || "session"}`}
            onPress={() => onManage(item)}
            style={({ pressed }) => [
              styles.rowAction,
              pressed && styles.pressed,
            ]}
          >
            <ShellIcon name="more" color={colors.faint} size={18} />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const BetaGroupHeader = ({
  busy,
  creating,
  label,
  onStartSession,
}: {
  busy: boolean;
  creating: boolean;
  label: string;
  onStartSession: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.betaGroupHeader}>
      <BodyText accessibilityRole="header" muted style={styles.betaGroupLabel}>
        {label}
      </BodyText>
      <NewSessionPill
        busy={busy}
        creating={creating}
        onPress={onStartSession}
      />
    </View>
  );
};

const SessionsEmpty = ({
  archived,
  listUnavailable,
  loading,
  search,
}: {
  archived: boolean;
  listUnavailable: boolean;
  loading: boolean;
  search: string;
}) => {
  if (loading) {
    return <Busy />;
  }
  return (
    <Empty
      title={emptyTitle(listUnavailable, search, archived)}
      detail={emptyDetail(listUnavailable, search, archived)}
    />
  );
};

interface SessionsFooterProps {
  loadMore: () => void;
  loading: boolean;
}

const SessionsFooter = ({ loadMore, loading }: SessionsFooterProps) => {
  if (loading) {
    return <Busy />;
  }
  return <Button title="Load more" variant="ghost" onPress={loadMore} />;
};

interface ProjectRowProps {
  onSelect: (directory: string | undefined) => void;
  project: Project;
  selectedDirectory: string | undefined;
}

const ProjectRow = ({
  onSelect,
  project,
  selectedDirectory,
}: ProjectRowProps) => {
  const styles = useThemedStyles(createStyles);
  const checked = selectedDirectory === project.canonical;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={() => onSelect(project.canonical)}
      style={styles.menuRow}
    >
      <View style={styles.projectOption}>
        <BodyText numberOfLines={1}>
          {project.name || directoryName(project.canonical)}
        </BodyText>
        <BodyText muted numberOfLines={1} style={styles.metadata}>
          {project.canonical}
        </BodyText>
      </View>
      <BodyText muted>{checked ? "✓" : ""}</BodyText>
    </Pressable>
  );
};

interface ProjectsSheetProps {
  betaHome: boolean;
  onChooseFolder: (() => void) | undefined;
  onClose: () => void;
  onDismiss: () => void;
  onListActions: () => void;
  onRetry: () => void;
  onSelect: (directory: string | undefined) => void;
  projectDirectory: string | undefined;
  projects: Project[];
  projectsError: string | undefined;
  projectsLoading: boolean;
  visible: boolean;
}

const ProjectsSheet = ({
  betaHome,
  onChooseFolder,
  onClose,
  onDismiss,
  onListActions,
  onRetry,
  onSelect,
  projectDirectory,
  projects,
  projectsError,
  projectsLoading,
  visible,
}: ProjectsSheetProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Sheet
      visible={visible}
      fitContent={betaHome}
      contentStyle={betaHome ? styles.projectSheetContent : undefined}
      title="Projects"
      onClose={onClose}
      onDismiss={onDismiss}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: !projectDirectory }}
        onPress={() => onSelect(undefined)}
        style={styles.menuRow}
      >
        <BodyText>All projects</BodyText>
        <BodyText muted>{projectDirectory ? "" : "✓"}</BodyText>
      </Pressable>
      {projectsLoading && <Busy />}
      <ErrorNotice error={projectsError} onRetry={onRetry} />
      {projects.map((project) => (
        <ProjectRow
          key={project.id}
          onSelect={onSelect}
          project={project}
          selectedDirectory={projectDirectory}
        />
      ))}
      <Button
        title="Session list actions"
        variant="ghost"
        onPress={onListActions}
      />
      {onChooseFolder && (
        <Button
          title="Choose a folder"
          variant="ghost"
          onPress={onChooseFolder}
        />
      )}
    </Sheet>
  );
};

const historyOptions = [
  { title: "Recent sessions", value: false },
  { title: "Archived sessions", value: true },
];

const HistoryOptions = ({
  archived,
  onSelect,
}: {
  archived: boolean;
  onSelect: (archived: boolean) => void;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View accessibilityRole="radiogroup">
      {historyOptions.map((item) => (
        <Pressable
          key={item.title}
          accessibilityRole="radio"
          accessibilityState={{ checked: archived === item.value }}
          aria-checked={archived === item.value}
          onPress={() => onSelect(item.value)}
          style={styles.menuRow}
        >
          <BodyText>{item.title}</BodyText>
          <BodyText muted>{archived === item.value ? "✓" : ""}</BodyText>
        </Pressable>
      ))}
    </View>
  );
};

interface MenuActionProps {
  disabled: boolean;
  onPress: () => void;
  title: string;
}

const MenuAction = ({ disabled, onPress, title }: MenuActionProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <BodyText>{title}</BodyText>
    </Pressable>
  );
};

interface ActionsSheetProps {
  archived: boolean;
  busy: boolean;
  creating: boolean;
  creationDirectory: string;
  displayed: ActionsMode;
  loading: boolean;
  onClose: () => void;
  onCreate: () => void;
  onDismiss: () => void;
  onImport: () => void;
  onOpenCreate: () => void;
  onRefresh: () => void;
  onSelectHistory: (archived: boolean) => void;
  onTitleChange: (title: string) => void;
  sheetError: string | undefined;
  title: string;
  visible: boolean;
}

const CreateSessionForm = ({
  creating,
  creationDirectory,
  onCreate,
  onTitleChange,
  sheetError,
  title,
}: Pick<
  ActionsSheetProps,
  | "creating"
  | "creationDirectory"
  | "onCreate"
  | "onTitleChange"
  | "sheetError"
  | "title"
>) => (
  <>
    <Field
      label="Session title"
      placeholder="What do you want to work on?"
      value={title}
      onChangeText={onTitleChange}
      editable={!creating}
    />
    <BodyText muted>
      You can choose a model and agent in the conversation.
    </BodyText>
    <Card>
      <BodyText muted>Remote directory</BodyText>
      <BodyText selectable>{creationDirectory}</BodyText>
    </Card>
    <ErrorNotice error={sheetError} />
    <Button
      title="Create session"
      variant="primary"
      busy={creating}
      onPress={onCreate}
    />
  </>
);

const ActionsMenu = ({
  busy,
  loading,
  onImport,
  onOpenCreate,
  onRefresh,
}: Pick<
  ActionsSheetProps,
  "busy" | "loading" | "onImport" | "onOpenCreate" | "onRefresh"
>) => (
  <>
    <MenuAction
      disabled={loading}
      onPress={onRefresh}
      title="Refresh sessions"
    />
    <MenuAction
      disabled={busy}
      onPress={onOpenCreate}
      title="Create a named session"
    />
    <MenuAction
      disabled={busy}
      onPress={onImport}
      title="Import session JSON"
    />
  </>
);

const ActionsSheet = ({
  archived,
  busy,
  creating,
  creationDirectory,
  displayed,
  loading,
  onClose,
  onCreate,
  onDismiss,
  onImport,
  onOpenCreate,
  onRefresh,
  onSelectHistory,
  onTitleChange,
  sheetError,
  title,
  visible,
}: ActionsSheetProps) => (
  <Sheet
    visible={visible}
    fitContent={Platform.OS === "android"}
    title={actionsTitle(displayed)}
    onClose={onClose}
    onDismiss={onDismiss}
  >
    {displayed === "create" ? (
      <CreateSessionForm
        creating={creating}
        creationDirectory={creationDirectory}
        onCreate={onCreate}
        onTitleChange={onTitleChange}
        sheetError={sheetError}
        title={title}
      />
    ) : (
      <View>
        <HistoryOptions archived={archived} onSelect={onSelectHistory} />
        {displayed === "menu" && (
          <ActionsMenu
            busy={busy}
            loading={loading}
            onImport={onImport}
            onOpenCreate={onOpenCreate}
            onRefresh={onRefresh}
          />
        )}
      </View>
    )}
  </Sheet>
);

interface ManageSheetProps {
  busy: boolean;
  editTitle: string;
  moveDirectory: string;
  onArchive: () => void;
  onClose: () => void;
  onDelete: () => void;
  onEditTitle: (title: string) => void;
  onExport: () => void;
  onFork: () => void;
  onMove: () => void;
  onMoveDirectory: (directory: string) => void;
  onSaveTitle: () => void;
  selected: SessionInfo | undefined;
  sheetError: string | undefined;
}

const ManageSheet = ({
  busy,
  editTitle,
  moveDirectory,
  onArchive,
  onClose,
  onDelete,
  onEditTitle,
  onExport,
  onFork,
  onMove,
  onMoveDirectory,
  onSaveTitle,
  selected,
  sheetError,
}: ManageSheetProps) => (
  <Sheet visible={!!selected} title="Manage session" onClose={onClose}>
    <BodyText selectable style={{ fontSize: 17, fontWeight: "500" }}>
      {selected?.title || "Untitled session"}
    </BodyText>
    {selected && (
      <BodyText muted>
        Updated {new Date(selected.time.updated).toLocaleString()}
      </BodyText>
    )}
    <Field label="Session title" value={editTitle} onChangeText={onEditTitle} />
    <Button
      title="Save title"
      busy={busy}
      disabled={!editTitle.trim()}
      onPress={onSaveTitle}
    />
    <Row>
      <Button
        title={selected?.time.archived ? "Restore session" : "Archive session"}
        disabled={busy}
        onPress={onArchive}
      />
      <Button title="Fork session" disabled={busy} onPress={onFork} />
    </Row>
    <Field
      label="Move to remote directory"
      value={moveDirectory}
      onChangeText={onMoveDirectory}
    />
    <Button
      title="Move session"
      disabled={
        busy ||
        !moveDirectory.trim() ||
        moveDirectory.trim() === selected?.location.directory
      }
      onPress={onMove}
    />
    <BodyText muted>
      A move during active work takes effect at a safe server boundary.
    </BodyText>
    <Button title="Export JSON" disabled={busy} onPress={onExport} />
    <BodyText muted>
      Export and import require a server with the experimental transcript API.
    </BodyText>
    <Button
      title="Delete session"
      variant="danger"
      disabled={busy}
      onPress={onDelete}
    />
    <ErrorNotice error={sheetError} />
  </Sheet>
);

export const SessionsScreen = ({
  client,
  directory,
  onOpenSession,
  revision,
  selectedSessionID,
  compact = false,
  onOpenNavigation,
  betaLayout = false,
  projectScope,
  onChooseDirectory,
  onNewSession,
}: Props) => {
  const withNativePresentation = useNativePresentation();
  const { scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const betaHome = betaLayout && Platform.OS === "android";
  const {
    loadProjects,
    projectDirectory,
    projects,
    projectsError,
    projectsLoading,
    projectsOpen,
    setProjectDirectory,
    setProjectsOpen,
  } = useProjects({ betaHome, client, projectScope });
  const pendingDirectoryPicker = useRef(false);
  const pendingListActions = useRef(false);
  const listDirectory = betaHome ? projectDirectory : directory;
  const creationDirectory = betaHome
    ? (projectDirectory ?? directory)
    : directory;
  const [width, setWidth] = useState(360);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [actions, setActions] = useState<ActionsMode | null>(null);
  const [lastActions, setLastActions] = useState<ActionsMode>("menu");
  if (actions && actions !== lastActions) {
    setLastActions(actions);
  }
  const displayedActions = actions ?? lastActions;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<SessionInfo>();
  const [editTitle, setEditTitle] = useState("");
  const [moveDirectory, setMoveDirectory] = useState("");
  const [sheetError, setSheetError] = useState<string>();
  const mounted = useMounted();
  const scope = useRef<Scope>({
    client,
    directory: creationDirectory,
    listDirectory,
  });
  const operationPending = useRef(false);
  const pendingImport = useRef<(() => void) | null>(null);
  const compactHeader = compact || width < 340;
  const {
    active,
    listError,
    listUnavailable,
    loadMore,
    loading,
    nextCursor,
    refresh,
    sessions,
    statusError,
    streamError,
  } = useSessionList({ archived, client, listDirectory, revision, search });

  const [scopeKey, setScopeKey] = useState({
    client,
    creationDirectory,
    listDirectory,
  });
  if (scopeKeyChanged(scopeKey, { client, creationDirectory, listDirectory })) {
    setScopeKey({ client, creationDirectory, listDirectory });
    setSelected(undefined);
    setActions(null);
    setSheetError(undefined);
  }

  useEffect(() => {
    scope.current = { client, directory: creationDirectory, listDirectory };
    pendingImport.current = null;
  }, [client, creationDirectory, listDirectory]);

  useEffect(
    () => () => {
      pendingImport.current = null;
    },
    []
  );

  const openConversation = (id: string) => {
    Keyboard.dismiss();
    onOpenSession(id);
  };

  const run = async (operation: () => Promise<void>, inSheet = false) => {
    if (operationPending.current) {
      return;
    }
    operationPending.current = true;
    const owner = scope.current;
    setBusy(true);
    setError(undefined);
    setSheetError(undefined);
    const failure = await settle(operation);
    if (failure && mounted.current && owner === scope.current) {
      const message = errorMessage(failure.error);
      if (inSheet) {
        setSheetError(message);
      } else {
        setError(message);
      }
    }
    operationPending.current = false;
    if (mounted.current) {
      setBusy(false);
    }
  };

  const createSession = (named = false) =>
    run(async () => {
      const owner = scope.current;
      setCreating(true);
      await withCleanup(
        async () => {
          const created = await client.session.create({
            location: { directory: creationDirectory },
            title: named ? title.trim() || undefined : undefined,
          });
          if (
            scope.current.client !== owner.client ||
            scope.current.directory !== owner.directory ||
            !mounted.current
          ) {
            return;
          }
          setActions(null);
          setTitle("");
          if (archived) {
            setArchived(false);
          }
          openConversation(created.id);
          if (!archived) {
            await refresh();
          }
        },
        () => {
          if (mounted.current) {
            setCreating(false);
          }
        }
      );
    }, named);

  const startSession = () => {
    Keyboard.dismiss();
    if (onNewSession) {
      onNewSession(creationDirectory);
    } else {
      void createSession();
    }
  };

  const manageSession = (item: SessionInfo) => {
    Keyboard.dismiss();
    setSelected(item);
    setEditTitle(item.title || "");
    setMoveDirectory(item.location.directory);
    setSheetError(undefined);
  };

  const changeSession = (operation: (item: SessionInfo) => Promise<void>) =>
    run(async () => {
      if (!selected) {
        return;
      }
      const owner = scope.current;
      await operation(selected);
      if (
        scope.current.client !== owner.client ||
        scope.current.directory !== owner.directory ||
        !mounted.current
      ) {
        return;
      }
      setSelected(undefined);
      await refresh();
    }, true);

  const exportSession = () =>
    run(async () => {
      if (!selected) {
        return;
      }
      const owner = scope.current;
      const transcript = await client.experimental.session.export({
        sanitize: true,
        sessionID: selected.id,
      });
      if (scope.current !== owner || !mounted.current) {
        return;
      }
      const text = JSON.stringify(transcript, null, 2);
      const filename = `opencode-${selected.id.replaceAll(/[^a-zA-Z0-9_-]/gu, "")}.json`;
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([text], { type: "application/json" })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        if (!(await Sharing.isAvailableAsync())) {
          throw new Error("File sharing is unavailable on this device");
        }
        const file = new File(Paths.cache, filename);
        await file.write(text);
        await withNativePresentation(() =>
          Sharing.shareAsync(file.uri, {
            UTI: "public.json",
            mimeType: "application/json",
          })
        );
      }
    }, true);

  const importSession = () =>
    run(async () => {
      const owner = scope.current;
      const picked = await withNativePresentation(() =>
        DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          type: ["application/json", "text/plain"],
        })
      );
      if (picked.canceled || !mounted.current || scope.current !== owner) {
        return;
      }
      const [asset] = picked.assets;
      if (asset.size && asset.size > 20 * 1024 * 1024) {
        throw new Error("Choose a transcript smaller than 20 MB");
      }
      const text =
        Platform.OS === "web"
          ? await (asset.file
              ? asset.file.text()
              : fetch(asset.uri).then((response) => response.text()))
          : await new File(asset.uri).text();
      if (!mounted.current || scope.current !== owner) {
        return;
      }
      const transcript = JSON.parse(text);
      if (!isTranscript(transcript)) {
        throw new Error("Choose a JSON transcript exported by OpenCode");
      }
      if (
        !(await confirmAction(
          "Import session?",
          `Import this transcript into ${creationDirectory}? The server validates its contents.`
        ))
      ) {
        return;
      }
      if (
        scope.current.client !== owner.client ||
        scope.current.directory !== owner.directory ||
        !mounted.current
      ) {
        return;
      }
      const imported = await client.experimental.session.import({
        info: transcript.info,
        location: { directory: creationDirectory },
        messages: transcript.messages,
      });
      if (
        scope.current.client !== owner.client ||
        scope.current.directory !== owner.directory ||
        !mounted.current
      ) {
        return;
      }
      await refresh();
      openConversation(imported.id);
    });

  const queueImport = () => {
    if (operationPending.current || pendingImport.current) {
      return;
    }
    const owner = scope.current;
    pendingImport.current = () => {
      if (mounted.current && scope.current === owner) {
        void importSession();
      }
    };
    Keyboard.dismiss();
    setActions(null);
  };

  const finishActionsDismissal = () => {
    const action = pendingImport.current;
    pendingImport.current = null;
    action?.();
  };

  const chooseHistory = () => {
    if (Platform.OS === "web") {
      setActions("filter");
      return;
    }
    const owner = scope.current;
    void withNativePresentation(() =>
      promptHistoryChoice(scheme, (value) => {
        if (mounted.current && scope.current === owner) {
          setArchived(value);
        }
      })
    ).catch((error_) => {
      if (mounted.current && scope.current === owner) {
        setError(errorMessage(error_));
      }
    });
  };

  const openProjects = () => {
    Keyboard.dismiss();
    setProjectsOpen(true);
    void loadProjects();
  };

  const closeProjects = () => {
    pendingDirectoryPicker.current = false;
    pendingListActions.current = false;
    setProjectsOpen(false);
  };

  const dismissProjects = () => {
    if (pendingDirectoryPicker.current) {
      pendingDirectoryPicker.current = false;
      onChooseDirectory?.();
    } else if (pendingListActions.current) {
      pendingListActions.current = false;
      setSheetError(undefined);
      setActions("menu");
    }
  };

  const selectProject = (next: string | undefined) => {
    setProjectDirectory(next);
    setProjectsOpen(false);
  };

  const showListActionsAfterProjects = () => {
    pendingListActions.current = true;
    setProjectsOpen(false);
  };

  const chooseFolderAfterProjects = () => {
    pendingDirectoryPicker.current = true;
    setProjectsOpen(false);
  };

  const openActionsMenu = () => {
    setSheetError(undefined);
    setActions("menu");
  };

  const openCreateForm = () => {
    setTitle("");
    setSheetError(undefined);
    setActions("create");
  };

  const refreshFromMenu = () => {
    setActions(null);
    void refresh();
  };

  const selectHistory = (value: boolean) => {
    setArchived(value);
    setActions(null);
  };

  const closeActions = () => {
    if (!creating) {
      setActions(null);
    }
  };

  const showFooter = sessions.length > 0 && (loading || !!nextCursor);

  return (
    <View
      style={[styles.screen, betaHome && styles.betaScreen]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <SessionsHeader
        archived={archived}
        betaHome={betaHome}
        busy={busy}
        compact={compact}
        compactHeader={compactHeader}
        creating={creating}
        error={error}
        listError={listError}
        onChangeSearch={setSearch}
        onChooseHistory={chooseHistory}
        onOpenActions={openActionsMenu}
        onOpenNavigation={onOpenNavigation}
        onOpenProjects={openProjects}
        onRefresh={() => {
          void refresh();
        }}
        onStartSession={startSession}
        projectLabel={projectSelectorLabel(projects, projectDirectory)}
        projectsOpen={projectsOpen}
        search={search}
        statusError={statusError}
        streamError={streamError}
      />
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, betaHome && styles.betaList]}
        keyboardShouldPersistTaps="handled"
        refreshing={loading && sessions.length > 0}
        onRefresh={() => {
          void refresh();
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        ListHeaderComponent={
          betaHome ? (
            <BetaGroupHeader
              busy={busy}
              creating={creating}
              label={betaGroupLabel(archived, search, sessions)}
              onStartSession={startSession}
            />
          ) : undefined
        }
        ListEmptyComponent={
          <SessionsEmpty
            archived={archived}
            listUnavailable={listUnavailable}
            loading={loading}
            search={search}
          />
        }
        ListFooterComponent={
          showFooter ? (
            <SessionsFooter loadMore={loadMore} loading={loading} />
          ) : undefined
        }
        renderItem={({ item, index }) => (
          <SessionRow
            active={active.has(item.id)}
            betaHome={betaHome}
            index={index}
            item={item}
            name={projectName(projects, item)}
            onManage={manageSession}
            onOpen={openConversation}
            search={search}
            selected={selectedSessionID === item.id}
            sessions={sessions}
          />
        )}
      />
      <ProjectsSheet
        betaHome={betaHome}
        onChooseFolder={
          onChooseDirectory ? chooseFolderAfterProjects : undefined
        }
        onClose={closeProjects}
        onDismiss={dismissProjects}
        onListActions={showListActionsAfterProjects}
        onRetry={() => {
          void loadProjects();
        }}
        onSelect={selectProject}
        projectDirectory={projectDirectory}
        projects={projects}
        projectsError={projectsError}
        projectsLoading={projectsLoading}
        visible={projectsOpen}
      />
      <ActionsSheet
        archived={archived}
        busy={busy}
        creating={creating}
        creationDirectory={creationDirectory}
        displayed={displayedActions}
        loading={loading}
        onClose={closeActions}
        onCreate={() => {
          void createSession(true);
        }}
        onDismiss={finishActionsDismissal}
        onImport={queueImport}
        onOpenCreate={openCreateForm}
        onRefresh={refreshFromMenu}
        onSelectHistory={selectHistory}
        onTitleChange={setTitle}
        sheetError={sheetError}
        title={title}
        visible={actions !== null}
      />
      <ManageSheet
        busy={busy}
        editTitle={editTitle}
        moveDirectory={moveDirectory}
        onArchive={() =>
          changeSession((item) =>
            client.session.update({
              archived: !item.time.archived,
              sessionID: item.id,
            })
          )
        }
        onClose={() => setSelected(undefined)}
        onDelete={() =>
          changeSession(async (item) => {
            if (
              await confirmAction(
                "Delete session?",
                `Delete ${item.title || item.id} and all child sessions from the server?`
              )
            ) {
              await client.session.remove({ sessionID: item.id });
            }
          })
        }
        onEditTitle={setEditTitle}
        onExport={exportSession}
        onFork={() =>
          changeSession(async (item) => {
            const fork = await client.session.fork({ sessionID: item.id });
            if (scope.current.client === client && mounted.current) {
              openConversation(fork.id);
            }
          })
        }
        onMove={() =>
          changeSession((item) =>
            client.session.move({
              delivery: "queue",
              directory: moveDirectory.trim(),
              sessionID: item.id,
            })
          )
        }
        onMoveDirectory={setMoveDirectory}
        onSaveTitle={() =>
          changeSession((item) =>
            client.session.update({
              sessionID: item.id,
              title: editTitle.trim(),
            })
          )
        }
        selected={selected}
        sheetError={sheetError}
      />
    </View>
  );
};
