import type { SessionInfo } from "@opencode/client";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect, useRef, useState } from "react";
import { FlatList, Keyboard, Platform, View } from "react-native";

import { confirmAction } from "../components/ui";
import { settle, withCleanup } from "../lib/async";
import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { useNativePresentation } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import { ActionsSheet } from "./sessions/actions-sheet";
import type { ActionsMode } from "./sessions/actions-sheet";
import {
  betaGroupLabel,
  isTranscript,
  projectName,
  projectSelectorLabel,
} from "./sessions/format";
import { promptHistoryChoice } from "./sessions/history-choice";
import {
  BetaGroupHeader,
  SessionsEmpty,
  SessionsFooter,
} from "./sessions/list-parts";
import { ManageSheet } from "./sessions/manage-sheet";
import { ProjectsSheet } from "./sessions/projects-sheet";
import { scopeKeyChanged } from "./sessions/scope";
import type { Scope } from "./sessions/scope";
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
  selectedSessionID?: string;
  projectScope?: ProjectScope;
  onChooseDirectory?: () => void;
  onNewSession: (directory: string) => void;
}

export const SessionsScreen = ({
  client,
  directory,
  onOpenSession,
  revision,
  selectedSessionID,
  projectScope,
  onChooseDirectory,
  onNewSession,
}: Props) => {
  const withNativePresentation = useNativePresentation();
  const { scheme } = useTheme();
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
  const pendingDirectoryPicker = useRef(false);
  const pendingListActions = useRef(false);
  const listDirectory = projectDirectory;
  const creationDirectory = projectDirectory ?? directory;
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
    await settle(operation, (failure) => {
      if (!mounted.current || owner !== scope.current) {
        return;
      }
      const message = errorMessage(failure);
      if (inSheet) {
        setSheetError(message);
      } else {
        setError(message);
      }
    });
    operationPending.current = false;
    if (mounted.current) {
      setBusy(false);
    }
  };

  const createSession = () =>
    run(async () => {
      const owner = scope.current;
      setCreating(true);
      await withCleanup(
        async () => {
          const created = await client.session.create({
            location: { directory: creationDirectory },
            title: title.trim() || undefined,
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
    }, true);

  const startSession = () => {
    Keyboard.dismiss();
    onNewSession(creationDirectory);
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
      style={[styles.screen, styles.betaScreen]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <SessionsHeader
        archived={archived}
        compactHeader={compactHeader}
        error={error}
        listError={listError}
        onChangeSearch={setSearch}
        onChooseHistory={chooseHistory}
        onOpenProjects={openProjects}
        onRefresh={() => {
          void refresh();
        }}
        projectLabel={projectSelectorLabel(projects, projectDirectory)}
        projectsOpen={projectsOpen}
        search={search}
        statusError={statusError}
        streamError={streamError}
      />
      <FlatList
        data={sessions}
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
            label={betaGroupLabel(archived, search, sessions)}
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
        ListFooterComponent={
          showFooter ? (
            <SessionsFooter loadMore={loadMore} loading={loading} />
          ) : undefined
        }
        renderItem={({ item, index }) => (
          <SessionRow
            active={active.has(item.id)}
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
          void createSession();
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
