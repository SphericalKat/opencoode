import type { Project, SessionInfo } from "@opencode/client";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { FlatList, Keyboard, Platform, View } from "react-native";

import { useMenuAnchor } from "../components/anchored-menu";
import type { Rect } from "../components/anchored-menu";
import { confirmAction, promptText } from "../components/dialog";
import { useUndoableRemoval } from "../components/snackbar";
import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { removeDeletedSessionQueries } from "../lib/queries/sessions";
import { queryKeys } from "../lib/query-keys";
import { useServerScope } from "../lib/server-scope";
import { sessionLabel } from "../lib/session-title";
import { useNativePresentation } from "../lib/sheets";
import { useThemedStyles } from "../lib/theme";
import {
  betaGroupLabel,
  isTranscript,
  isUnread,
  projectName,
  projectSelectorLabel,
} from "./sessions/format";
import {
  BetaGroupHeader,
  SessionsEmpty,
  SessionsFooter,
} from "./sessions/list-parts";
import { ProjectsDropdown } from "./sessions/projects-dropdown";
import type { ProjectActions } from "./sessions/projects-dropdown";
import { scopeKeyChanged } from "./sessions/scope";
import { SessionMenu } from "./sessions/session-menu";
import type { SessionActions } from "./sessions/session-menu";
import { SessionRow } from "./sessions/session-row";
import { SessionsHeader } from "./sessions/sessions-header";
import { createStyles } from "./sessions/styles";
import { useMounted } from "./sessions/use-mounted";
import { useProjects } from "./sessions/use-projects";
import type { ProjectScope } from "./sessions/use-projects";
import { useSessionList } from "./sessions/use-session-list";

const SESSIONS_MUTATION_KEY = ["sessions-screen"] as const;

interface Props {
  client: Client;
  directory: string;
  onOpenSession: (id: string) => void;
  projectScope?: ProjectScope;
  onChooseDirectory?: () => void;
  onNewSession: (directory: string) => void;
}

export const SessionsScreen = ({
  client,
  directory,
  onOpenSession,
  projectScope,
  onChooseDirectory,
  onNewSession,
}: Props) => {
  const withNativePresentation = useNativePresentation();
  const styles = useThemedStyles(createStyles);
  const {
    loadProjects,
    projectDirectory,
    projects,
    projectsError,
    projectsLoading,
    projectsOpen,
    setProjectDirectory,
    setProjectsOpen,
  } = useProjects({ client, projectScope });
  const projectAnchor = useMenuAnchor();
  const [projectsAnchor, setProjectsAnchor] = useState<Rect | null>(null);
  const listDirectory = projectDirectory;
  const creationDirectory = projectDirectory ?? directory;
  const [width, setWidth] = useState(360);
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState<string>();
  const [menu, setMenu] = useState<{
    anchor: Rect;
    session: SessionInfo;
  } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [renamingID, setRenamingID] = useState<string>();
  const afterMenuClosed = useRef<(() => void) | null>(null);
  const { hidden, remove } = useUndoableRemoval<string>("sessions");
  const mounted = useMounted();
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const compactHeader = width < 340;
  const {
    active,
    hasMore,
    listError,
    listUnavailable,
    loadMore,
    loading,
    refresh,
    sessions,
    statusError,
    streamError,
  } = useSessionList({ archived, client, listDirectory, search });

  const [scopeKey, setScopeKey] = useState({
    client,
    creationDirectory,
    listDirectory,
  });
  if (scopeKeyChanged(scopeKey, { client, creationDirectory, listDirectory })) {
    setScopeKey({ client, creationDirectory, listDirectory });
    setMenu(null);
    setMenuVisible(false);
    setRenamingID(undefined);
  }

  const openConversation = (id: string) => {
    Keyboard.dismiss();
    onOpenSession(id);
  };

  const invalidateSessions = (sessionID?: string) =>
    Promise.all([
      sessionID
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.session.detail(scope, sessionID),
          })
        : undefined,
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.all(scope),
      }),
    ]);
  const showFailure = (failure: unknown) => setError(errorMessage(failure));
  const mutationOptions = {
    mutationKey: SESSIONS_MUTATION_KEY,
    scope: { id: `sessions:${scope}` },
  };

  const createMutation = useMutation({
    ...mutationOptions,
    mutationFn: (input: { directory: string; title: string }) =>
      client.session.create({
        location: { directory: input.directory },
        title: input.title,
      }),
    onSuccess: async () => {
      await invalidateSessions();
    },
  });
  const exportMutation = useMutation({
    ...mutationOptions,
    mutationFn: async (session: SessionInfo) => {
      const transcript = await client.experimental.session.export({
        sanitize: true,
        sessionID: session.id,
      });
      const text = JSON.stringify(transcript, null, 2);
      const filename = `opencode-${session.id.replaceAll(/[^a-zA-Z0-9_-]/gu, "")}.json`;
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([text], { type: "application/json" })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
      }
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
    },
  });
  const importMutation = useMutation({
    ...mutationOptions,
    mutationFn: async (targetDirectory: string) => {
      const picked = await withNativePresentation(() =>
        DocumentPicker.getDocumentAsync({
          copyToCacheDirectory: true,
          type: ["application/json", "text/plain"],
        })
      );
      if (picked.canceled) {
        return null;
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
      const transcript = JSON.parse(text);
      if (!isTranscript(transcript)) {
        throw new Error("Choose a JSON transcript exported by OpenCode");
      }
      if (
        !(await confirmAction(
          "Import session?",
          `Import this transcript into ${targetDirectory}? The server validates its contents.`,
          { confirmLabel: "Import", destructive: false }
        ))
      ) {
        return null;
      }
      return client.experimental.session.import({
        info: transcript.info,
        location: { directory: targetDirectory },
        messages: transcript.messages,
      });
    },
    onSuccess: async (imported) => {
      if (!imported) {
        return;
      }
      await invalidateSessions();
    },
  });
  const updateMutation = useMutation({
    ...mutationOptions,
    mutationFn: (input: {
      archived?: boolean;
      sessionID: string;
      title?: string;
    }) => client.session.update(input),
    onSuccess: (_result, input) => invalidateSessions(input.sessionID),
  });
  const viewMutation = useMutation({
    ...mutationOptions,
    mutationFn: async (input: { idle: number; sessionID: string }[]) => {
      await Promise.allSettled(input.map((item) => client.session.view(item)));
    },
    onSuccess: (_result, input) =>
      Promise.all(input.map((item) => invalidateSessions(item.sessionID))),
  });
  const removeMutation = useMutation({
    ...mutationOptions,
    mutationFn: (sessionID: string) => client.session.remove({ sessionID }),
    onSuccess: (_result, sessionID) => {
      removeDeletedSessionQueries(queryClient, scope, sessionID);
      return invalidateSessions();
    },
  });
  const busy = useIsMutating({ mutationKey: SESSIONS_MUTATION_KEY }) > 0;
  const creating = createMutation.isPending;
  const renameSaving = updateMutation.isPending && !!renamingID;

  const createSession = (title: string, targetDirectory: string) => {
    if (busy) {
      return;
    }
    setError(undefined);
    createMutation.mutate(
      { directory: targetDirectory, title },
      {
        onError: showFailure,
        onSuccess: (created) => {
          if (archived) {
            setArchived(false);
          }
          openConversation(created.id);
        },
      }
    );
  };

  const startSession = () => {
    Keyboard.dismiss();
    onNewSession(creationDirectory);
  };

  const openMenu = (session: SessionInfo, anchor: Rect) => {
    Keyboard.dismiss();
    setMenu({ anchor, session });
    setMenuVisible(true);
  };

  const closeMenu = () => setMenuVisible(false);

  const finishMenuClose = () => {
    setMenu(null);
    const action = afterMenuClosed.current;
    afterMenuClosed.current = null;
    action?.();
  };

  const runMutation = <T,>(
    mutation: {
      mutate: (value: T, options: { onError: (error: Error) => void }) => void;
    },
    value: T
  ) => {
    if (busy) {
      return;
    }
    setError(undefined);
    mutation.mutate(value, { onError: showFailure });
  };

  const renameSession = (session: SessionInfo, value: string) => {
    const nextTitle = value.trim();
    if (!nextTitle || nextTitle === sessionLabel(session)) {
      setRenamingID(undefined);
      return;
    }
    setError(undefined);
    updateMutation.mutate(
      { sessionID: session.id, title: nextTitle },
      { onError: showFailure, onSettled: () => setRenamingID(undefined) }
    );
  };

  const sessionActions: SessionActions = {
    archive: (session) =>
      runMutation(updateMutation, {
        archived: !session.time.archived,
        sessionID: session.id,
      }),
    exportSession: (session) => runMutation(exportMutation, session),
    markRead: (session) => {
      if (session.time.idle) {
        runMutation(viewMutation, [
          { idle: session.time.idle, sessionID: session.id },
        ]);
      }
    },
    remove: (session) =>
      remove(session.id, {
        commit: () => removeMutation.mutateAsync(session.id),
        message: "Session deleted",
      }),
    rename: (session) => setRenamingID(session.id),
  };

  const menuActions: SessionActions = {
    ...sessionActions,
    exportSession: (session) => {
      afterMenuClosed.current = () => sessionActions.exportSession(session);
    },
  };

  const openProjects = async () => {
    Keyboard.dismiss();
    const anchor = await projectAnchor.measure().catch(() => null);
    if (!(anchor && mounted.current)) {
      return;
    }
    setProjectsAnchor(anchor);
    setProjectsOpen(true);
    void loadProjects();
  };

  const closeProjects = () => setProjectsOpen(false);

  const selectProject = (next: string | undefined) => {
    setProjectDirectory(next);
  };

  const clearNotifications = (project: Project) =>
    runMutation(
      viewMutation,
      sessions
        .filter((item) => item.projectID === project.id && isUnread(item))
        .map((item) => ({ idle: item.time.idle ?? 0, sessionID: item.id }))
    );

  const projectActions: ProjectActions = {
    clearNotifications,
    importSession: (target) => {
      setError(undefined);
      if (!busy) {
        importMutation.mutate(target, {
          onError: showFailure,
          onSuccess: (imported) => {
            if (imported) {
              openConversation(imported.id);
            }
          },
        });
      }
    },
    newNamedSession: (target) => {
      void (async () => {
        const created = await promptText("New session", {
          confirmLabel: "Create",
          field: { label: "Title", returnKeyType: "done" },
        });
        if (created) {
          createSession(created, target);
        }
      })();
    },
    newSession: (target) => {
      Keyboard.dismiss();
      onNewSession(target);
    },
  };

  const unreadProjectIDs = new Set(
    sessions.filter(isUnread).map((item) => item.projectID)
  );

  const visibleSessions = sessions.filter((item) => !hidden.has(item.id));
  const showFooter = sessions.length > 0 && loading && hasMore;

  return (
    <View
      style={[styles.screen, styles.betaScreen]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <SessionsHeader
        archived={archived}
        compactHeader={compactHeader}
        error={error}
        listError={listError}
        onChangeSearch={setSearch}
        hasProject={!!projectDirectory}
        onOpenProjects={() => {
          void openProjects();
        }}
        onRefresh={() => {
          void refresh();
        }}
        projectLabel={projectSelectorLabel(projects, projectDirectory)}
        projectTriggerRef={projectAnchor.ref}
        projectsOpen={projectsOpen}
        search={search}
        statusError={statusError}
        streamError={streamError}
      />
      <FlatList
        data={visibleSessions}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, styles.betaList]}
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
          <BetaGroupHeader
            busy={busy}
            creating={creating}
            label={betaGroupLabel(archived, search, visibleSessions)}
            onStartSession={startSession}
          />
        }
        ListEmptyComponent={
          <SessionsEmpty
            archived={archived}
            listUnavailable={listUnavailable}
            loading={loading}
            search={search}
          />
        }
        ListFooterComponent={showFooter ? <SessionsFooter /> : undefined}
        renderItem={({ item, index }) => (
          <SessionRow
            active={active.has(item.id)}
            index={index}
            item={item}
            actions={sessionActions}
            name={projectName(projects, item)}
            onCancelRename={() => setRenamingID(undefined)}
            onMenu={openMenu}
            onOpen={openConversation}
            onRename={renameSession}
            renameSaving={renameSaving && renamingID === item.id}
            renaming={renamingID === item.id}
            search={search}
            sessions={visibleSessions}
            showProjectName={!projectDirectory}
          />
        )}
      />
      <ProjectsDropdown
        actions={projectActions}
        anchor={projectsAnchor}
        archived={archived}
        onChooseDirectory={onChooseDirectory}
        onClose={closeProjects}
        onRetry={() => {
          void loadProjects();
        }}
        onSelect={selectProject}
        onToggleArchived={() => setArchived((value) => !value)}
        projectDirectory={projectDirectory}
        projects={projects}
        projectsError={projectsError}
        projectsLoading={projectsLoading}
        unreadProjectIDs={unreadProjectIDs}
        visible={projectsOpen}
      />
      <SessionMenu
        actions={menuActions}
        anchor={menu?.anchor ?? null}
        busy={busy}
        onClose={closeMenu}
        onClosed={finishMenuClose}
        session={menu?.session}
        visible={menuVisible}
      />
    </View>
  );
};
