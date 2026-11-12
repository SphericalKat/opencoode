import type { Project, SessionInfo } from "@opencode/client";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

import { ShellIcon } from "../components/ShellIcon";
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

export function SessionsScreen({
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
}: Props) {
  const withNativePresentation = useNativePresentation();
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const betaHome = betaLayout && Platform.OS === "android";
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectDirectory, setProjectDirectory] = useState<string>();
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string>();
  const pendingDirectoryPicker = useRef(false);
  const pendingListActions = useRef(false);
  const listDirectory = betaHome ? projectDirectory : directory;
  const creationDirectory = betaHome
    ? (projectDirectory ?? directory)
    : directory;
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [width, setWidth] = useState(360);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [listUnavailable, setListUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [listError, setListError] = useState<string>();
  const [statusError, setStatusError] = useState<string>();
  const [streamError, setStreamError] = useState<string>();
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
  );
  const [actions, setActions] = useState<"menu" | "filter" | "create" | null>(
    null
  );
  const lastActions = useRef<"menu" | "filter" | "create">("menu");
  if (actions) {
    lastActions.current = actions;
  }
  const displayedActions = actions ?? lastActions.current;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [selected, setSelected] = useState<SessionInfo>();
  const [editTitle, setEditTitle] = useState("");
  const [moveDirectory, setMoveDirectory] = useState("");
  const [sheetError, setSheetError] = useState<string>();
  const generation = useRef(0);
  const refreshRequest = useRef<AbortController | null>(null);
  const quietRefreshPending = useRef(false);
  const mounted = useRef(true);
  const scope = useRef({ client, directory: creationDirectory, listDirectory });
  if (
    scope.current.client !== client ||
    scope.current.directory !== creationDirectory ||
    scope.current.listDirectory !== listDirectory
  ) {
    scope.current = { client, directory: creationDirectory, listDirectory };
  }
  const paging = useRef(false);
  const operationPending = useRef(false);
  const pendingImport = useRef<(() => void) | null>(null);
  const loadedCount = useRef(40);
  const refreshRef = useRef<
    (quiet?: boolean, signal?: AbortSignal) => Promise<void>
  >(async () => {});
  const compactHeader = compact || width < 340;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      refreshRequest.current?.abort();
      pendingImport.current = null;
    };
  }, []);

  const refresh = useCallback(
    async (cursor?: string, quiet = false, signal?: AbortSignal) => {
      if (quiet && refreshRequest.current) {
        quietRefreshPending.current = true;
        return;
      }
      quietRefreshPending.current = false;
      const request = ++generation.current;
      refreshRequest.current?.abort();
      const controller = new AbortController();
      refreshRequest.current = controller;
      let timedOut = false;
      const cancel = () => controller.abort();
      let rejectCancelled: (() => void) | undefined;
      const cancelled = new Promise<never>((_, reject) => {
        rejectCancelled = () =>
          reject(
            new Error(
              timedOut
                ? "The server did not respond within 15 seconds. Check your connection, then retry."
                : "Session refresh cancelled"
            )
          );
        controller.signal.addEventListener("abort", rejectCancelled, {
          once: true,
        });
      });
      if (signal?.aborted) {
        cancel();
      } else {
        signal?.addEventListener("abort", cancel, { once: true });
      }
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 15_000);
      if (!quiet) {
        setLoading(true);
        setListError(undefined);
      }
      try {
        const [page, running] = await Promise.race([
          Promise.allSettled([
            client.session.list(
              {
                archived,
                cursor,
                directory: listDirectory,
                limit: cursor ? 40 : loadedCount.current,
                order: "desc",
                search: search.trim() || undefined,
              },
              { signal: controller.signal }
            ),
            client.session.active({ signal: controller.signal }),
          ]),
          cancelled,
        ]);
        if (
          !mounted.current ||
          request !== generation.current ||
          controller.signal.aborted
        ) {
          return;
        }
        if (page.status === "rejected") {
          throw page.reason;
        }
        setListUnavailable(false);
        setListError(undefined);
        setSessions((previous) => {
          const next = cursor
            ? [
                ...new Map(
                  [...previous, ...page.value.data].map((item) => [
                    item.id,
                    item,
                  ])
                ).values(),
              ]
            : page.value.data;
          loadedCount.current = Math.max(40, next.length);
          return next;
        });
        setNextCursor(page.value.cursor.next ?? undefined);
        if (running.status === "fulfilled") {
          setActive(new Set(Object.keys(running.value)));
          setStatusError(undefined);
        } else {
          setActive(new Set());
          setStatusError(
            `Active status unavailable: ${errorMessage(running.reason)}`
          );
        }
      } catch (error_) {
        if (
          mounted.current &&
          request === generation.current &&
          (timedOut || !controller.signal.aborted)
        ) {
          setListUnavailable(true);
          setListError(errorMessage(error_));
        }
      } finally {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", cancel);
        if (rejectCancelled) {
          controller.signal.removeEventListener("abort", rejectCancelled);
        }
        if (refreshRequest.current === controller) {
          refreshRequest.current = null;
        }
        if (request === generation.current) {
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
        }
      }
    },
    [client, listDirectory, search, archived]
  );
  refreshRef.current = (quiet, signal) => refresh(undefined, quiet, signal);

  useEffect(() => {
    generation.current += 1;
    loadedCount.current = 40;
    setSessions([]);
    setNextCursor(undefined);
    setLoading(true);
    const timer = setTimeout(() => {
      if (
        AppState.currentState !== "background" &&
        AppState.currentState !== "inactive"
      ) {
        void refresh();
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      generation.current += 1;
      refreshRequest.current?.abort();
    };
  }, [refresh, revision]);

  const loadProjects = useCallback(
    async (signal?: AbortSignal) => {
      setProjectsLoading(true);
      setProjectsError(undefined);
      try {
        const items = await client.project.list(undefined, { signal });
        if (
          !signal?.aborted &&
          mounted.current &&
          scope.current.client === client
        ) {
          setProjects(items);
        }
      } catch (error_) {
        if (
          !signal?.aborted &&
          mounted.current &&
          scope.current.client === client
        ) {
          setProjectsError(errorMessage(error_));
        }
      } finally {
        if (
          !signal?.aborted &&
          mounted.current &&
          scope.current.client === client
        ) {
          setProjectsLoading(false);
        }
      }
    },
    [client]
  );

  useEffect(() => {
    setProjectDirectory(undefined);
    setProjects([]);
    setProjectsOpen(false);
    if (!betaHome) {
      return;
    }
    const controller = new AbortController();
    void loadProjects(controller.signal);
    return () => controller.abort();
  }, [client, betaHome, loadProjects]);

  useEffect(() => {
    if (betaHome && projectScope) {
      setProjectDirectory(projectScope.directory);
    }
  }, [betaHome, projectScope]);

  useEffect(() => {
    setSelected(undefined);
    setActions(null);
    setSheetError(undefined);
    pendingImport.current = null;
  }, [client, creationDirectory, listDirectory]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!foreground) {
      refreshRequest.current?.abort();
      quietRefreshPending.current = false;
      return;
    }
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let releaseRetry: (() => void) | undefined;
    let attempts = 0;
    const scheduleRefresh = () => {
      if (refreshTimer) {
        return;
      }
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        if (!controller.signal.aborted) {
          void refreshRef.current(true, controller.signal);
        }
      }, 300);
    };
    void (async () => {
      void refreshRef.current(true, controller.signal);
      while (!controller.signal.aborted) {
        try {
          const attempt = new AbortController();
          const cancelAttempt = () => attempt.abort();
          controller.signal.addEventListener("abort", cancelAttempt, {
            once: true,
          });
          let timedOut = false;
          let rejectCancelled: (() => void) | undefined;
          const cancelled = new Promise<never>((_, reject) => {
            rejectCancelled = () =>
              reject(
                new Error(
                  timedOut
                    ? "The live connection did not respond within 15 seconds. Check your server connection."
                    : "Live connection cancelled"
                )
              );
            attempt.signal.addEventListener("abort", rejectCancelled, {
              once: true,
            });
          });
          if (controller.signal.aborted) {
            cancelAttempt();
          }
          const initialTimeout = setTimeout(() => {
            timedOut = true;
            attempt.abort();
          }, 15_000);
          const iterator = client.event
            .subscribe({ signal: attempt.signal })
            [Symbol.asyncIterator]();
          try {
            while (!controller.signal.aborted) {
              const result = await Promise.race([iterator.next(), cancelled]);
              if (result.done || controller.signal.aborted) {
                break;
              }
              clearTimeout(initialTimeout);
              const event = result.value;
              setStreamError(undefined);
              attempts = 0;
              if (
                event.type === "server.connected" ||
                event.type === "location.shutdown" ||
                sessionListEvents.has(event.type)
              ) {
                scheduleRefresh();
              }
            }
          } finally {
            clearTimeout(initialTimeout);
            controller.signal.removeEventListener("abort", cancelAttempt);
            attempt.abort();
            if (rejectCancelled) {
              attempt.signal.removeEventListener("abort", rejectCancelled);
            }
            void iterator.return?.().catch(() => {});
          }
          if (!controller.signal.aborted) {
            throw new Error("The live connection closed");
          }
        } catch (error_) {
          if (controller.signal.aborted) {
            break;
          }
          setStreamError(`Live updates unavailable: ${errorMessage(error_)}`);
          await new Promise<void>((resolve) => {
            releaseRetry = resolve;
            retryTimer = setTimeout(
              resolve,
              Math.min(1000 * 2 ** Math.min(attempts++, 4), 15_000)
            );
          });
          if (!controller.signal.aborted) {
            await refreshRef.current(true, controller.signal);
          }
        }
      }
    })().catch((error_) => {
      if (!controller.signal.aborted) {
        setStreamError(errorMessage(error_));
      }
    });
    return () => {
      controller.abort();
      clearTimeout(refreshTimer);
      clearTimeout(retryTimer);
      releaseRetry?.();
    };
  }, [client, foreground]);

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
    try {
      await operation();
    } catch (error_) {
      if (mounted.current && owner === scope.current) {
        if (inSheet) {
          setSheetError(errorMessage(error_));
        } else {
          setError(errorMessage(error_));
        }
      }
    } finally {
      operationPending.current = false;
      if (mounted.current) {
        setBusy(false);
      }
    }
  };

  const createSession = (named = false) =>
    run(async () => {
      const owner = scope.current;
      setCreating(true);
      try {
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
      } finally {
        if (mounted.current) {
          setCreating(false);
        }
      }
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

  const projectName = (item: SessionInfo) =>
    projects.find((project) => project.id === item.projectID)?.name ||
    directoryName(
      projects.find((project) => project.id === item.projectID)?.canonical ??
        item.location.directory
    );

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
      const filename = `opencode-${selected.id.replaceAll(/[^a-zA-Z0-9_-]/g, "")}.json`;
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
      const asset = picked.assets[0];
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
      if (
        !transcript ||
        typeof transcript !== "object" ||
        !transcript.info ||
        typeof transcript.info !== "object" ||
        !Array.isArray(transcript.messages)
      ) {
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

  const loadMore = () => {
    if (loading || paging.current || !nextCursor) {
      return;
    }
    paging.current = true;
    void refresh(nextCursor);
  };

  const chooseHistory = () => {
    if (Platform.OS === "web") {
      setActions("filter");
      return;
    }
    const owner = scope.current;
    void withNativePresentation(
      () =>
        new Promise<void>((resolve) => {
          const choose = (value: boolean) => {
            if (mounted.current && scope.current === owner) {
              setArchived(value);
            }
            resolve();
          };
          if (Platform.OS === "ios") {
            ActionSheetIOS.showActionSheetWithOptions(
              {
                cancelButtonIndex: 2,
                options: ["Recent sessions", "Archived sessions", "Cancel"],
                title: "Session history",
                userInterfaceStyle: scheme,
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
        })
    ).catch((error_) => {
      if (mounted.current && scope.current === owner) {
        setError(errorMessage(error_));
      }
    });
  };

  const newSessionAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New session"
      accessibilityState={{ busy: creating, disabled: busy }}
      disabled={busy}
      onPress={startSession}
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

  return (
    <View
      style={[styles.screen, betaHome && styles.betaScreen]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View
        style={[
          styles.header,
          compactHeader && styles.compactHeader,
          betaHome && styles.betaHeader,
        ]}
      >
        {betaHome ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select project"
            accessibilityState={{ expanded: projectsOpen }}
            onPress={() => {
              Keyboard.dismiss();
              setProjectsOpen(true);
              void loadProjects();
            }}
            style={({ pressed }) => [
              styles.projectSelector,
              pressed && styles.pressed,
            ]}
          >
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
            >
              <Path
                d="M3 5h6l2 3h10v12H3V5Z"
                stroke={colors.muted}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </Svg>
            <BodyText numberOfLines={1} style={styles.projectSelectorLabel}>
              {projectDirectory
                ? projects.find(
                    (project) => project.canonical === projectDirectory
                  )?.name || directoryName(projectDirectory)
                : "All projects"}
            </BodyText>
            <View style={styles.projectChevron}>
              <ShellIcon name="chevron" color={colors.faint} size={10} />
            </View>
          </Pressable>
        ) : (
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
                {Platform.OS === "android" && archived
                  ? "Archived sessions"
                  : compact
                    ? "Your sessions"
                    : "Sessions"}
              </BodyText>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New session"
              accessibilityState={{ busy: creating, disabled: busy }}
              disabled={busy}
              onPress={startSession}
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Session list actions"
              onPress={() => {
                setSheetError(undefined);
                setActions("menu");
              }}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressed,
              ]}
            >
              <ShellIcon name="more" color={colors.muted} size={18} />
            </Pressable>
          </Row>
        )}
        {Platform.OS === "android" ? (
          <View
            style={[
              styles.androidSearch,
              betaHome && styles.betaSearch,
              betaHome && {
                backgroundColor:
                  scheme === "dark" ? colors.panel : colors.raised,
              },
            ]}
          >
            <ShellIcon name="search" color={colors.faint} size={16} />
            <Field
              accessibilityLabel="Search sessions"
              placeholder={
                archived ? "Search archived sessions" : "Search sessions"
              }
              value={search}
              onChangeText={setSearch}
              containerStyle={styles.searchField}
              style={[
                styles.androidSearchInput,
                betaHome && styles.betaSearchInput,
              ]}
            />
            {!!search && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear session search"
                hitSlop={4}
                onPress={() => setSearch("")}
                style={({ pressed }) => [
                  styles.clearSearch,
                  pressed && styles.pressed,
                ]}
              >
                <ShellIcon name="close" color={colors.muted} size={16} />
              </Pressable>
            )}
          </View>
        ) : (
          <Row style={styles.searchRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Field
                accessibilityLabel="Search sessions"
                placeholder={
                  archived ? "Search archived sessions" : "Search sessions"
                }
                value={search}
                onChangeText={setSearch}
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
                onPress={() => setSearch("")}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Session history: ${archived ? "Archived" : "Recent"}`}
                onPress={chooseHistory}
                style={styles.filter}
              >
                <BodyText muted style={styles.filterText}>
                  {archived ? "Archived" : "Recent"} ⌄
                </BodyText>
              </Pressable>
            )}
          </Row>
        )}
        <ErrorNotice
          error={listError}
          onRetry={() => {
            void refresh();
          }}
        />
        <ErrorNotice error={error} />
        {statusError && <BodyText muted>{statusError}</BodyText>}
        {streamError && <BodyText muted>{streamError}</BodyText>}
      </View>
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
            <View style={styles.betaGroupHeader}>
              <BodyText
                accessibilityRole="header"
                muted
                style={styles.betaGroupLabel}
              >
                {archived
                  ? "Archived sessions"
                  : search.trim()
                    ? "Search results"
                    : sessions.length
                      ? sessionDateGroup(sessions[0].time.updated)
                      : "Today"}
              </BodyText>
              {newSessionAction}
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          loading ? (
            <Busy />
          ) : (
            <Empty
              title={
                listUnavailable
                  ? "Could not load sessions"
                  : search.trim()
                    ? "No matching sessions"
                    : archived
                      ? "No archived sessions"
                      : "Start your first session"
              }
              detail={
                listUnavailable
                  ? "Use Retry to load your history."
                  : search.trim()
                    ? "Try another title or clear the search."
                    : archived
                      ? "Sessions appear here after you archive them."
                      : "Create a session to work with OpenCode in this directory."
              }
            />
          )
        }
        ListFooterComponent={
          sessions.length ? (
            loading ? (
              <Busy />
            ) : nextCursor ? (
              <Button title="Load more" variant="ghost" onPress={loadMore} />
            ) : undefined
          ) : undefined
        }
        renderItem={({ item, index }) => {
          const status = sessionStatus(item, active.has(item.id));
          const unread =
            item.time.idle &&
            (!item.time.viewed || item.time.viewed < item.time.idle);
          const visibleStatus =
            status === "Working" ||
            status === "Needs attention" ||
            status === "Stopped"
              ? status
              : undefined;
          const group = sessionDateGroup(item.time.updated);
          const startsGroup =
            Platform.OS === "android" &&
            !search.trim() &&
            (!betaHome || index > 0) &&
            (index === 0 ||
              sessionDateGroup(sessions[index - 1].time.updated) !== group);
          const name = projectName(item);
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
                  selectedSessionID === item.id && styles.selected,
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.title || "Untitled session"}`}
                  accessibilityHint={`${status}. Updated ${new Date(item.time.updated).toLocaleString()}`}
                  onPress={() => openConversation(item.id)}
                  onLongPress={betaHome ? () => manageSession(item) : undefined}
                  accessibilityActions={
                    betaHome
                      ? [{ label: "Manage session", name: "manage" }]
                      : undefined
                  }
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === "manage") {
                      manageSession(item);
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
                  <View
                    style={[
                      styles.sessionText,
                      betaHome && styles.betaSessionText,
                    ]}
                  >
                    <BodyText
                      numberOfLines={1}
                      style={[
                        styles.sessionTitle,
                        betaHome && styles.betaSessionTitle,
                      ]}
                    >
                      {item.title || "Untitled session"}
                    </BodyText>
                    {betaHome ? (
                      <View style={styles.betaMetadataRow}>
                        <BodyText
                          muted
                          numberOfLines={1}
                          style={[styles.betaMetadata, styles.betaProjectName]}
                        >
                          {name}
                        </BodyText>
                        {visibleStatus || unread ? (
                          <BodyText
                            muted
                            numberOfLines={1}
                            style={styles.betaMetadata}
                          >
                            {" "}
                            ·{" "}
                            {[visibleStatus, unread ? "Unread" : undefined]
                              .filter(Boolean)
                              .join(" · ")}
                          </BodyText>
                        ) : null}
                      </View>
                    ) : (
                      <BodyText muted numberOfLines={1} style={styles.metadata}>
                        {[
                          visibleStatus,
                          unread ? "Unread" : undefined,
                          updatedLabel(item.time.updated),
                          item.parentID ? "Child session" : undefined,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </BodyText>
                    )}
                  </View>
                </Pressable>
                {!betaHome && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Manage ${item.title || "session"}`}
                    onPress={() => manageSession(item)}
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
        }}
      />
      <Sheet
        visible={projectsOpen}
        fitContent={betaHome}
        contentStyle={betaHome ? styles.projectSheetContent : undefined}
        title="Projects"
        onClose={() => {
          pendingDirectoryPicker.current = false;
          pendingListActions.current = false;
          setProjectsOpen(false);
        }}
        onDismiss={() => {
          if (pendingDirectoryPicker.current) {
            pendingDirectoryPicker.current = false;
            onChooseDirectory?.();
          } else if (pendingListActions.current) {
            pendingListActions.current = false;
            setSheetError(undefined);
            setActions("menu");
          }
        }}
      >
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: !projectDirectory }}
          onPress={() => {
            setProjectDirectory(undefined);
            setProjectsOpen(false);
          }}
          style={styles.menuRow}
        >
          <BodyText>All projects</BodyText>
          <BodyText muted>{projectDirectory ? "" : "✓"}</BodyText>
        </Pressable>
        {projectsLoading && <Busy />}
        <ErrorNotice
          error={projectsError}
          onRetry={() => {
            void loadProjects();
          }}
        />
        {projects.map((project) => (
          <Pressable
            key={project.id}
            accessibilityRole="radio"
            accessibilityState={{
              checked: projectDirectory === project.canonical,
            }}
            onPress={() => {
              setProjectDirectory(project.canonical);
              setProjectsOpen(false);
            }}
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
            <BodyText muted>
              {projectDirectory === project.canonical ? "✓" : ""}
            </BodyText>
          </Pressable>
        ))}
        <Button
          title="Session list actions"
          variant="ghost"
          onPress={() => {
            pendingListActions.current = true;
            setProjectsOpen(false);
          }}
        />
        {onChooseDirectory && (
          <Button
            title="Choose a folder"
            variant="ghost"
            onPress={() => {
              pendingDirectoryPicker.current = true;
              setProjectsOpen(false);
            }}
          />
        )}
      </Sheet>
      <Sheet
        visible={actions !== null}
        fitContent={Platform.OS === "android"}
        title={
          displayedActions === "create"
            ? "Name a new session"
            : displayedActions === "filter"
              ? "Session history"
              : "Session list actions"
        }
        onClose={() => {
          if (!creating) {
            setActions(null);
          }
        }}
        onDismiss={finishActionsDismissal}
      >
        {displayedActions === "create" ? (
          <>
            <Field
              label="Session title"
              placeholder="What do you want to work on?"
              value={title}
              onChangeText={setTitle}
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
              onPress={() => {
                void createSession(true);
              }}
            />
          </>
        ) : (
          <View>
            <View accessibilityRole="radiogroup">
              {[
                { title: "Recent sessions", value: false },
                { title: "Archived sessions", value: true },
              ].map((item) => (
                <Pressable
                  key={item.title}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: archived === item.value }}
                  aria-checked={archived === item.value}
                  onPress={() => {
                    setArchived(item.value);
                    setActions(null);
                  }}
                  style={styles.menuRow}
                >
                  <BodyText>{item.title}</BodyText>
                  <BodyText muted>
                    {archived === item.value ? "✓" : ""}
                  </BodyText>
                </Pressable>
              ))}
            </View>
            {displayedActions === "menu" && (
              <>
                {[
                  {
                    disabled: loading,
                    onPress: () => {
                      setActions(null);
                      void refresh();
                    },
                    title: "Refresh sessions",
                  },
                  {
                    disabled: busy,
                    onPress: () => {
                      setTitle("");
                      setSheetError(undefined);
                      setActions("create");
                    },
                    title: "Create a named session",
                  },
                  {
                    disabled: busy,
                    onPress: queueImport,
                    title: "Import session JSON",
                  },
                ].map((action) => (
                  <Pressable
                    key={action.title}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: action.disabled }}
                    disabled={action.disabled}
                    onPress={action.onPress}
                    style={({ pressed }) => [
                      styles.menuRow,
                      (pressed || action.disabled) && styles.pressed,
                    ]}
                  >
                    <BodyText>{action.title}</BodyText>
                  </Pressable>
                ))}
              </>
            )}
          </View>
        )}
      </Sheet>
      <Sheet
        visible={!!selected}
        title="Manage session"
        onClose={() => setSelected(undefined)}
      >
        <BodyText selectable style={{ fontSize: 17, fontWeight: "500" }}>
          {selected?.title || "Untitled session"}
        </BodyText>
        {selected && (
          <BodyText muted>
            Updated {new Date(selected.time.updated).toLocaleString()}
          </BodyText>
        )}
        <Field
          label="Session title"
          value={editTitle}
          onChangeText={setEditTitle}
        />
        <Button
          title="Save title"
          busy={busy}
          disabled={!editTitle.trim()}
          onPress={() =>
            changeSession((item) =>
              client.session.update({
                sessionID: item.id,
                title: editTitle.trim(),
              })
            )
          }
        />
        <Row>
          <Button
            title={
              selected?.time.archived ? "Restore session" : "Archive session"
            }
            disabled={busy}
            onPress={() =>
              changeSession((item) =>
                client.session.update({
                  archived: !item.time.archived,
                  sessionID: item.id,
                })
              )
            }
          />
          <Button
            title="Fork session"
            disabled={busy}
            onPress={() =>
              changeSession(async (item) => {
                const fork = await client.session.fork({ sessionID: item.id });
                if (scope.current.client === client && mounted.current) {
                  openConversation(fork.id);
                }
              })
            }
          />
        </Row>
        <Field
          label="Move to remote directory"
          value={moveDirectory}
          onChangeText={setMoveDirectory}
        />
        <Button
          title="Move session"
          disabled={
            busy ||
            !moveDirectory.trim() ||
            moveDirectory.trim() === selected?.location.directory
          }
          onPress={() =>
            changeSession((item) =>
              client.session.move({
                delivery: "queue",
                directory: moveDirectory.trim(),
                sessionID: item.id,
              })
            )
          }
        />
        <BodyText muted>
          A move during active work takes effect at a safe server boundary.
        </BodyText>
        <Button title="Export JSON" disabled={busy} onPress={exportSession} />
        <BodyText muted>
          Export and import require a server with the experimental transcript
          API.
        </BodyText>
        <Button
          title="Delete session"
          variant="danger"
          disabled={busy}
          onPress={() =>
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
        />
        <ErrorNotice error={sheetError} />
      </Sheet>
    </View>
  );
}

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

function directoryName(directory: string): string {
  return directory.split(/[\\/]/).filter(Boolean).pop() || directory;
}

function sessionDateGroup(time: number): string {
  const date = new Date(time);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }
  today.setDate(today.getDate() - 1);
  return date.toDateString() === today.toDateString() ? "Yesterday" : "Older";
}

function updatedLabel(time: number): string {
  const date = new Date(time);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year:
          date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
}

function sessionStatus(session: SessionInfo, working: boolean): string {
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
}
