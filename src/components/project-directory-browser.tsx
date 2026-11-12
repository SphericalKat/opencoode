import type { FileSystemEntry, Project } from "@opencode/client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Keyboard, Pressable, StyleSheet, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { fileName } from "../lib/workspace";
import { NavIcon } from "./icons";
import {
  Button,
  Busy,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  mono,
  Row,
  confirmAction,
  touchTarget,
} from "./ui";

interface Props {
  client: Client;
  directory: string;
  value: string;
  projects: Project[];
  busy: boolean;
  error: string | null;
  onChangeValue: (value: string) => void;
  onOpenDirectory: (directory: string) => void;
}

const absolutePath = (value: string) =>
  value.startsWith("/") ||
  /^[A-Za-z]:[\\/]/u.test(value) ||
  value.startsWith("\\\\");

const rootOf = (path: string, unc: string[] | null) => {
  if (unc) {
    return `//${unc.join("/")}`;
  }
  return /^[A-Za-z]:\//u.test(path) ? path.slice(0, 3) : "/";
};

const normalizePath = (value: string) => {
  const path = value.replaceAll("\\", "/");
  const network =
    path.startsWith("//") && !path.startsWith("///")
      ? path.split("/").filter(Boolean).slice(0, 2)
      : [];
  const unc =
    network.length === 2 &&
    network.every((part) => part !== "." && part !== "..")
      ? network
      : null;
  const root = rootOf(path, unc);
  const parts: string[] = [];
  for (const part of path.slice(root.length).split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return (
    root +
    (parts.length ? `${root.endsWith("/") ? "" : "/"}${parts.join("/")}` : "")
  );
};

const entryPath = (base: string, entry: FileSystemEntry) =>
  normalizePath(
    absolutePath(entry.path) ? entry.path : `${base}/${entry.path}`
  );

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, minHeight: 0 },
    detail: { fontFamily: mono, fontSize: 12 },
    folder: {
      alignItems: "center",
      borderBottomWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      gap: 12,
      minHeight: touchTarget + 8,
      paddingVertical: 12,
    },
    footer: {
      alignItems: "center",
      borderColor: colors.border,
      borderTopWidth: 1,
      flexDirection: "row",
      flexShrink: 0,
      gap: 8,
      padding: 16,
    },
    header: { gap: 10, padding: 16, paddingBottom: 8 },
    list: { flexGrow: 1, paddingBottom: 16, paddingHorizontal: 16 },
    path: { color: colors.muted, fontFamily: mono, fontSize: 13 },
  });

const RecentList = ({
  busy,
  pending,
  projects,
  onChangeValue,
  onOpenDirectory,
}: {
  busy: boolean;
  pending: boolean;
  projects: Project[];
  onChangeValue: (value: string) => void;
  onOpenDirectory: (directory: string) => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <FlatList
      style={{ flex: 1, minHeight: 0 }}
      data={projects}
      keyExtractor={(project) => project.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        busy ? (
          <Busy />
        ) : (
          <Empty
            title="No recent projects"
            detail="Browse to a folder on the server."
          />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open project ${item.name || fileName(item.canonical)}`}
          disabled={pending}
          onPress={() => {
            Keyboard.dismiss();
            onChangeValue(item.canonical);
            onOpenDirectory(item.canonical);
          }}
          style={({ pressed }) => [
            styles.folder,
            pressed && { backgroundColor: colors.raised },
          ]}
        >
          <NavIcon name="workspace" color={colors.muted} size={18} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <BodyText numberOfLines={2}>
              {item.name || fileName(item.canonical)}
            </BodyText>
            <BodyText
              muted
              numberOfLines={1}
              ellipsizeMode="middle"
              style={styles.detail}
            >
              {item.canonical}
            </BodyText>
          </View>
          <BodyText muted>›</BodyText>
        </Pressable>
      )}
    />
  );
};

const FolderList = ({
  base,
  browseError,
  folders,
  pending,
  onBrowse,
}: {
  base: string;
  browseError: string | null;
  folders: FileSystemEntry[];
  pending: boolean;
  onBrowse: (path: string) => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <FlatList
      style={{ flex: 1, minHeight: 0 }}
      data={folders}
      keyExtractor={(folder) => folder.path}
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <Empty
          title={browseError ? "Folder unavailable" : "No folders inside"}
          detail={
            browseError
              ? "Enter another path or return to the parent folder."
              : "You can open the current folder."
          }
        />
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Browse folder ${fileName(item.path)}`}
          accessibilityHint={entryPath(base, item)}
          disabled={pending}
          onPress={() => onBrowse(entryPath(base, item))}
          style={({ pressed }) => [
            styles.folder,
            pressed && { backgroundColor: colors.raised },
          ]}
        >
          <NavIcon name="workspace" color={colors.muted} size={18} />
          <BodyText numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>
            {fileName(item.path)}
          </BodyText>
          <BodyText muted>›</BodyText>
        </Pressable>
      )}
    />
  );
};

const ListArea = ({
  base,
  browseError,
  busy,
  folders,
  loading,
  pending,
  projects,
  recent,
  onBrowse,
  onChangeValue,
  onOpenDirectory,
}: {
  base: string;
  browseError: string | null;
  busy: boolean;
  folders: FileSystemEntry[];
  loading: boolean;
  pending: boolean;
  projects: Project[];
  recent: boolean;
  onBrowse: (path: string) => void;
  onChangeValue: (value: string) => void;
  onOpenDirectory: (directory: string) => void;
}) => {
  if (recent) {
    return (
      <RecentList
        busy={busy}
        pending={pending}
        projects={projects}
        onChangeValue={onChangeValue}
        onOpenDirectory={onOpenDirectory}
      />
    );
  }
  if (loading) {
    return (
      <View style={{ flex: 1 }}>
        <Busy />
      </View>
    );
  }
  return (
    <FolderList
      base={base}
      browseError={browseError}
      folders={folders}
      pending={pending}
      onBrowse={onBrowse}
    />
  );
};

const fetchFolders = async (
  client: Client,
  directory: string,
  path: string,
  signal: AbortSignal
): Promise<
  { base: string; folders: FileSystemEntry[] } | { error: string }
> => {
  try {
    const result = await client.file.list(
      { location: { directory }, path },
      { signal }
    );
    const folders = result.data.filter((entry) => entry.type === "directory");
    folders.sort((a, b) => fileName(a.path).localeCompare(fileName(b.path)));
    return { base: result.location.directory, folders };
  } catch (error_) {
    return { error: errorMessage(error_) };
  }
};

const ProjectDirectoryBrowser = ({
  client,
  directory,
  value,
  projects,
  busy,
  error,
  onChangeValue,
  onOpenDirectory,
}: Props) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [path, setPath] = useState(() => normalizePath(directory));
  const [base, setBase] = useState(directory);
  const [folders, setFolders] = useState<FileSystemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [recent, setRecent] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const mounted = useRef(true);
  const action = useRef<AbortController | null>(null);
  const listRequest = useRef<AbortController | null>(null);
  const parent = normalizePath(`${path}/..`);
  const pending = busy || initializing;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      action.current?.abort();
    };
  }, []);

  const [seenLocation, setSeenLocation] = useState({
    client,
    directory,
    path,
  });
  if (
    seenLocation.client !== client ||
    seenLocation.directory !== directory ||
    seenLocation.path !== path
  ) {
    setSeenLocation({ client, directory, path });
    setLoading(true);
    setBrowseError(null);
    setActionError(null);
    setNotice(null);
  }

  const loadFolders = useCallback(async () => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    const apply = (outcome: Awaited<ReturnType<typeof fetchFolders>>) => {
      if (controller.signal.aborted) {
        return;
      }
      if ("error" in outcome) {
        setFolders([]);
        setBrowseError(outcome.error);
      } else {
        setBase(outcome.base);
        setFolders(outcome.folders);
      }
      setLoading(false);
    };
    apply(await fetchFolders(client, directory, path, controller.signal));
  }, [client, directory, path]);

  useEffect(() => {
    void loadFolders();
    return () => listRequest.current?.abort();
  }, [loadFolders]);

  const reload = () => {
    setLoading(true);
    setBrowseError(null);
    setActionError(null);
    setNotice(null);
    void loadFolders();
  };

  const browse = (next: string) => {
    Keyboard.dismiss();
    if (!absolutePath(next.trim())) {
      setBrowseError("Enter an absolute folder path on the server");
      return;
    }
    const normalized = normalizePath(next.trim());
    onChangeValue(normalized);
    setRecent(false);
    setManual(false);
    if (normalized === path) {
      reload();
    } else {
      setPath(normalized);
    }
  };

  const runInitializeGit = async (controller: AbortController) => {
    const location = await client.location.get(
      { location: { directory: path } },
      { signal: controller.signal }
    );
    const vcs = await client.vcs.get(
      { location: { directory: location.directory } },
      { signal: controller.signal }
    );
    if (controller.signal.aborted) {
      return;
    }
    if (vcs.data.provider) {
      setNotice(
        `This folder already belongs to a ${vcs.data.provider} repository.`
      );
      return;
    }
    const confirmed = await confirmAction(
      "Initialize Git?",
      `Create a Git repository in ${location.project.directory}?`,
      { confirmLabel: "Initialize Git", destructive: false }
    );
    if (!confirmed || controller.signal.aborted) {
      return;
    }
    await client.vcs.init(
      { location: { directory: location.directory }, provider: "git" },
      { signal: controller.signal }
    );
    if (!controller.signal.aborted) {
      setNotice(`Git initialized in ${location.project.directory}`);
    }
  };

  const initializeGit = async () => {
    if (pending || action.current) {
      return;
    }
    const controller = new AbortController();
    action.current = controller;
    setInitializing(true);
    setActionError(null);
    setNotice(null);
    try {
      await runInitializeGit(controller);
    } catch (error_) {
      if (!controller.signal.aborted) {
        setActionError(errorMessage(error_));
      }
    }
    if (mounted.current) {
      setInitializing(false);
    }
    if (action.current === controller) {
      action.current = null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BodyText
          selectable
          numberOfLines={1}
          ellipsizeMode="middle"
          accessibilityLabel={`Current folder: ${path}`}
          style={styles.path}
        >
          {path}
        </BodyText>
        <Row style={{ flexWrap: "nowrap" }}>
          {recent ? (
            <Button
              title="‹ Folders"
              compact
              variant="ghost"
              disabled={pending}
              onPress={() => setRecent(false)}
            />
          ) : (
            <Button
              title="↑ Parent"
              compact
              variant="ghost"
              disabled={parent === path || pending}
              onPress={() => browse(parent)}
            />
          )}
          <Button
            title={manual ? "Hide path" : "Enter a path"}
            compact
            variant="ghost"
            disabled={pending}
            onPress={() => setManual((open) => !open)}
          />
          {!recent && (
            <Button
              title="Recent"
              compact
              variant="ghost"
              disabled={pending}
              onPress={() => setRecent(true)}
            />
          )}
        </Row>
        {manual && (
          <View style={{ gap: 8 }}>
            <Field
              label="Directory on the server"
              value={value}
              editable={!pending}
              onChangeText={onChangeValue}
              returnKeyType="go"
              onSubmitEditing={() => browse(value)}
            />
            <Button
              title="Browse this path"
              compact
              onPress={() => browse(value)}
              disabled={!value.trim() || pending}
            />
          </View>
        )}
        <ErrorNotice
          error={error || browseError || actionError}
          onRetry={pending ? undefined : reload}
        />
        {notice && (
          <BodyText
            accessibilityLiveRegion="polite"
            style={{ color: colors.success }}
          >
            {notice}
          </BodyText>
        )}
        {recent && <BodyText muted>Recent projects</BodyText>}
      </View>
      <ListArea
        base={base}
        browseError={browseError}
        busy={busy}
        folders={folders}
        loading={loading}
        pending={pending}
        projects={projects}
        recent={recent}
        onBrowse={browse}
        onChangeValue={onChangeValue}
        onOpenDirectory={onOpenDirectory}
      />
      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Button
            title="Open folder"
            accessibilityLabel={`Open folder ${path}`}
            variant="primary"
            busy={busy}
            disabled={initializing || loading || !!browseError}
            onPress={() => {
              Keyboard.dismiss();
              onOpenDirectory(path);
            }}
          />
        </View>
        <Button
          title="Initialize Git"
          variant="ghost"
          busy={initializing}
          disabled={busy || loading || !!browseError}
          onPress={() => {
            void initializeGit();
          }}
        />
      </View>
    </View>
  );
};

export { ProjectDirectoryBrowser };
