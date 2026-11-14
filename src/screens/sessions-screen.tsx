import type { Project, SessionInfo } from "@opencode/client";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { FlatList, Keyboard, Platform, View } from "react-native";

import { useMenuAnchor } from "../components/anchored-menu";
import type { Rect } from "../components/anchored-menu";
import { confirmAction, promptText } from "../components/dialog";
import { useUndoableRemoval } from "../components/snackbar";
import { settle, withCleanup } from "../lib/async";
import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
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
import type { Scope } from "./sessions/scope";
import { SessionMenu } from "./sessions/session-menu";
import type { SessionActions } from "./sessions/session-menu";
import { SessionRow } from "./sessions/session-row";
import { SessionsHeader } from "./sessions/sessions-header";
import { createStyles } from "./sessions/styles";
import { useMounted } from "./sessions/use-mounted";
import { useProjects } from "./sessions/use-projects";
import type { ProjectScope } from "./sessions/use-projects";
import { useSessionList } from "./sessions/use-session-list";

interface Props {
  client: Client;
  directory: string;
  onOpenSession: (id: string) => void;
  revision?: number;
  projectScope?: ProjectScope;
  onChooseDirectory?: () => void;
  onNewSession: (directory: string) => void;
}

export const SessionsScreen = ({
  client,
  directory,
  onOpenSession,
  revision,
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState<{
    anchor: Rect;
    session: SessionInfo;
  } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [renamingID, setRenamingID] = useState<string>();
  const [renameSaving, setRenameSaving] = useState(false);
  const afterMenuClosed = useRef<(() => void) | null>(null);
  const { hidden, remove } = useUndoableRemoval<string>("sessions");
  const mounted = useMounted();
  const scope = useRef<Scope>({
    client,
    directory: creationDirectory,
    listDirectory,
  });
  const operationPending = useRef(false);
  const compactHeader = width < 340;
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
    setMenu(null);
    setMenuVisible(false);
    setRenamingID(undefined);
  }

  useEffect(() => {
    scope.current = { client, directory: creationDirectory, listDirectory };
  }, [client, creationDirectory, listDirectory]);

  const openConversation = (id: string) => {
    Keyboard.dismiss();
    onOpenSession(id);
  };

  const run = async (operation: () => Promise<void>) => {
    if (operationPending.current) {
      return;
    }
    operationPending.current = true;
    const owner = scope.current;
    setBusy(true);
    setError(undefined);
    await settle(operation, (failure) => {
      if (!mounted.current || owner !== scope.current) {
        return;
      }
      setError(errorMessage(failure));
    });
    operationPending.current = false;
    if (mounted.current) {
      setBusy(false);
    }
  };

  const createSession = (title: string, targetDirectory: string) =>
    run(async () => {
      const owner = scope.current;
      setCreating(true);
      await withCleanup(
        async () => {
          const created = await client.session.create({
            location: { directory: targetDirectory },
            title,
          });
          if (
            scope.current.client !== owner.client ||
            scope.current.directory !== owner.directory ||
            !mounted.current
          ) {
            return;
          }
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
    });

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

  const exportSession = (session: SessionInfo) =>
    run(async () => {
      const owner = scope.current;
      const transcript = await client.experimental.session.export({
        sanitize: true,
        sessionID: session.id,
      });
      if (scope.current !== owner || !mounted.current) {
        return;
      }
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
    });

  const importSession = (targetDirectory: string) =>
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
          `Import this transcript into ${targetDirectory}? The server validates its contents.`,
          { confirmLabel: "Import", destructive: false }
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
        location: { directory: targetDirectory },
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

  const renameSession = async (session: SessionInfo, value: string) => {
    const nextTitle = value.trim();
    if (!nextTitle || nextTitle === sessionLabel(session)) {
      setRenamingID(undefined);
      return;
    }
    setRenameSaving(true);
    setError(undefined);
    await settle(
      async () => {
        await client.session.update({
          sessionID: session.id,
          title: nextTitle,
        });
        await refresh(undefined, true);
      },
      (failure) => {
        if (mounted.current) {
          setError(errorMessage(failure));
        }
      },
      () => {
        if (mounted.current) {
          setRenameSaving(false);
          setRenamingID(undefined);
        }
      }
    );
  };

  const sessionActions: SessionActions = {
    archive: (session) => {
      void run(async () => {
        await client.session.update({
          archived: !session.time.archived,
          sessionID: session.id,
        });
        await refresh();
      });
    },
    exportSession: (session) => {
      void exportSession(session);
    },
    markRead: (session) => {
      void run(async () => {
        if (!session.time.idle) {
          return;
        }
        await client.session.view({
          idle: session.time.idle,
          sessionID: session.id,
        });
        await refresh(undefined, true);
      });
    },
    remove: (session) =>
      remove(session.id, {
        commit: async () => {
          await client.session.remove({ sessionID: session.id });
          await refresh(undefined, true);
        },
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

  const clearNotifications = (project: Project) => {
    void run(async () => {
      await Promise.allSettled(
        sessions
          .filter((item) => item.projectID === project.id && isUnread(item))
          .map((item) =>
            client.session.view({
              idle: item.time.idle ?? 0,
              sessionID: item.id,
            })
          )
      );
      await refresh(undefined, true);
    });
  };

  const projectActions: ProjectActions = {
    clearNotifications,
    importSession: (target) => {
      void importSession(target);
    },
    newNamedSession: (target) => {
      void (async () => {
        const created = await promptText("New session", {
          confirmLabel: "Create",
          field: { label: "Title", returnKeyType: "done" },
        });
        if (created) {
          await createSession(created, target);
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
  const showFooter = sessions.length > 0 && loading && !!nextCursor;

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
            onRename={(session, value) => {
              void renameSession(session, value);
            }}
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
