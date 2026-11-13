import type {
  FileDiffInfo,
  FileSystemEntry,
  LocationPublicInfo,
  VcsFileStatus,
  VcsInfo,
  WorktreeDirectory,
} from "@opencode/client";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Patch } from "../components/patch";
import { TerminalPanel } from "../components/terminal-panel";
import {
  Busy,
  Button,
  Card,
  confirmAction,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  mono,
  Row,
  Sheet,
} from "../components/ui";
import { errorMessage } from "../lib/client";
import type { Client, Connection } from "../lib/client";
import { copyText } from "../lib/clipboard";
import { pageInset } from "../lib/layout";
import { useNativePresentation } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { useUnsavedChanges } from "../lib/unsaved";
import {
  decodeEditableFile,
  fileName,
  parentPath,
  saveEditableFile,
  serverFilePath,
} from "../lib/workspace";

export type WorkspaceSection = "Files" | "Changes" | "Worktrees" | "Terminal";

interface Props {
  client: Client;
  connection: Connection;
  directory: string;
  onDirectoryChange: (directory: string) => void;
  onAttachFile?: (
    path: string,
    contextText?: string
  ) => Promise<boolean | undefined> | undefined;
  visible?: boolean;
  sessionID?: string;
  section: WorkspaceSection;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      gap: 16,
      padding: 16,
      paddingBottom: 32,
      paddingHorizontal: pageInset,
    },
    controls: { gap: 8, paddingBottom: 10, paddingHorizontal: pageInset },
    editor: { flex: 1, gap: 12, minHeight: 0, padding: 16 },
    fileIcon: { color: colors.muted, fontFamily: mono, fontSize: 23 },
    fileRow: {
      alignItems: "center",
      borderBottomWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      gap: 12,
      minHeight: 58,
      paddingVertical: 12,
    },
    list: { flexGrow: 1, paddingBottom: 24, paddingHorizontal: pageInset },
    mediaPreview: {
      alignItems: "center",
      flex: 1,
      gap: 12,
      justifyContent: "center",
      minHeight: 0,
    },
    screen: { backgroundColor: colors.bg, flex: 1, minHeight: 0 },
  });

interface OpenFile {
  path: string;
  bytes: Uint8Array | null;
  original: Uint8Array | null;
  text: string;
  initialText: string;
  mime?: string;
  preview?: string;
  notice?: string;
  error?: string;
}

const startsWith = (
  bytes: Uint8Array,
  signature: readonly number[],
  offset = 0
): boolean => {
  for (const [index, byte] of signature.entries()) {
    if (bytes[offset + index] !== byte) {
      return false;
    }
  }
  return true;
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38];
const GIF_VERSIONS = new Set([0x37, 0x39]);
const GIF_TRAILER = 0x61;
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d];

const imageMime = (bytes: Uint8Array): string | undefined => {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return "image/png";
  }
  if (startsWith(bytes, JPEG_SIGNATURE)) {
    return "image/jpeg";
  }
  if (
    startsWith(bytes, GIF_SIGNATURE) &&
    GIF_VERSIONS.has(bytes[4]) &&
    bytes[5] === GIF_TRAILER
  ) {
    return "image/gif";
  }
  if (
    startsWith(bytes, RIFF_SIGNATURE) &&
    startsWith(bytes, WEBP_SIGNATURE, 8)
  ) {
    return "image/webp";
  }
};

const fileMime = (path: string, bytes: Uint8Array): string => {
  const image = imageMime(bytes);
  if (image) {
    return image;
  }
  if (startsWith(bytes, PDF_SIGNATURE)) {
    return "application/pdf";
  }
  const extension = path.split(".").pop()?.toLowerCase();
  return (
    (
      {
        csv: "text/csv",
        json: "application/json",
        md: "text/markdown",
        mov: "video/quicktime",
        mp3: "audio/mpeg",
        mp4: "video/mp4",
        txt: "text/plain",
        wav: "audio/wav",
        zip: "application/zip",
      } as Record<string, string>
    )[extension || ""] || "application/octet-stream"
  );
};

const base64 = (bytes: Uint8Array): string => {
  const chunks: string[] = [];
  for (let index = 0; index < bytes.length; index += 0x80_00) {
    chunks.push(
      String.fromCodePoint(...bytes.subarray(index, index + 0x80_00))
    );
  }
  return btoa(chunks.join(""));
};

const quotedText = (text: string, language = ""): string => {
  let longest = 2;
  for (const match of text.matchAll(/`+/gu)) {
    longest = Math.max(longest, match[0].length);
  }
  const fence = "`".repeat(longest + 1);
  return `${fence}${language}\n${text}\n${fence}`;
};

const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;

const loadedFile = (path: string, bytes: Uint8Array): OpenFile => {
  const mime = fileMime(path, bytes);
  if (imageMime(bytes)) {
    const preview =
      bytes.length <= MAX_PREVIEW_BYTES
        ? `data:${mime};base64,${base64(bytes)}`
        : undefined;
    return {
      bytes,
      initialText: "",
      mime,
      original: null,
      path,
      preview,
      text: "",
    };
  }
  try {
    const text = decodeEditableFile(bytes);
    return {
      bytes,
      initialText: text,
      mime,
      original: bytes,
      path,
      text,
    };
  } catch (error_) {
    return {
      bytes,
      initialText: "",
      mime,
      notice: errorMessage(error_),
      original: null,
      path,
      text: "",
    };
  }
};

const compareEntries = (a: FileSystemEntry, b: FileSystemEntry): number => {
  if (a.type === b.type) {
    return a.path.localeCompare(b.path);
  }
  return a.type === "directory" ? -1 : 1;
};

const emptyFilesText = (
  error: string | null,
  searching: boolean
): { detail: string; title: string } => {
  if (error) {
    return {
      detail: "Retry the request or check your server connection.",
      title: "Files unavailable",
    };
  }
  if (searching) {
    return { detail: "Try a different file name.", title: "No matches" };
  }
  return { detail: "This folder is empty.", title: "No files" };
};

const selectionContext = (
  file: OpenFile,
  selection: { end: number; start: number },
  directory: string
): string | undefined => {
  if (selection.end <= selection.start) {
    return;
  }
  const start = Math.max(0, Math.min(selection.start, file.text.length));
  const end = Math.max(start, Math.min(selection.end, file.text.length));
  if (end <= start) {
    return;
  }
  const firstLine = file.text.slice(0, start).split("\n").length;
  const lastLine = file.text
    .slice(0, file.text[end - 1] === "\n" ? end - 1 : end)
    .split("\n").length;
  const serverPath = serverFilePath(directory, file.path);
  return `Selected text from ${serverPath}, lines ${firstLine}–${lastLine}${file.text === file.initialText ? "" : " (unsaved editor text)"}:\n\n${quotedText(file.text.slice(start, end))}`;
};

const downloadInBrowser = (bytes: Uint8Array, name: string, mime: string) => {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(bytes)], { type: mime })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const shareNatively = async (
  bytes: Uint8Array,
  name: string,
  mime: string,
  presentNative: ReturnType<typeof useNativePresentation>
) => {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("File sharing is unavailable on this device");
  }
  const exported = new File(Paths.cache, `opencoode-${Date.now()}-${name}`);
  try {
    await exported.write(bytes);
    await presentNative(() =>
      Sharing.shareAsync(exported.uri, {
        dialogTitle: "Save or share file",
        mimeType: mime,
      })
    );
  } finally {
    if (exported.exists) {
      await exported.delete();
    }
  }
};

const loadEntries = async (
  client: Props["client"],
  {
    directory,
    path,
    query,
  }: { directory: string; path: string; query: string },
  signal: AbortSignal
): Promise<FileSystemEntry[]> => {
  const findFiles = client.file.find.bind(client.file);
  const result = query.trim()
    ? await findFiles(
        { limit: 200, location: { directory }, query: query.trim() },
        { signal }
      )
    : await client.file.list({ location: { directory }, path }, { signal });
  const entries = [...result.data];
  entries.sort(compareEntries);
  return entries;
};

const loadEntriesInto = async (
  request: {
    client: Props["client"];
    directory: string;
    path: string;
    query: string;
  },
  signal: AbortSignal,
  setters: {
    setEntries: (entries: FileSystemEntry[]) => void;
    setError: (error: string | null) => void;
    setLoading: (loading: boolean) => void;
  }
) => {
  const { client, directory, path, query } = request;
  try {
    const sorted = await loadEntries(
      client,
      { directory, path, query },
      signal
    );
    if (!signal.aborted) {
      setters.setEntries(sorted);
    }
  } catch (error_) {
    if (!signal.aborted) {
      setters.setEntries([]);
      setters.setError(errorMessage(error_));
    }
  }
  if (!signal.aborted) {
    setters.setLoading(false);
  }
};

const runWithFlag = async (
  setFlag: (value: boolean) => void,
  task: () => Promise<void>
) => {
  setFlag(true);
  try {
    await task();
  } finally {
    setFlag(false);
  }
};

const shareTitle = () =>
  Platform.OS === "web" ? "Download file" : "Save or share";

const FileHeaderRow = ({
  file,
  fileActionsOpen,
  fileBusy,
  saved,
  sharing,
  showAttach,
  onAttach,
  onSave,
  onToggleActions,
}: {
  file: OpenFile;
  fileActionsOpen: boolean;
  fileBusy: boolean;
  saved: boolean;
  sharing: boolean;
  showAttach: boolean;
  onAttach: () => void;
  onSave: () => void;
  onToggleActions: () => void;
}) => (
  <Row style={{ flexWrap: "nowrap", justifyContent: "space-between" }}>
    {file.original && (
      <Button
        title={saved && file.text === file.initialText ? "Saved" : "Save file"}
        compact
        variant="primary"
        disabled={file.text === file.initialText || sharing}
        busy={fileBusy}
        onPress={onSave}
      />
    )}
    {file.bytes && !file.original && showAttach && (
      <Button
        title="Attach to prompt"
        compact
        variant="primary"
        disabled={fileBusy || sharing}
        onPress={onAttach}
      />
    )}
    <Button
      title={fileActionsOpen ? "Hide actions" : "More actions"}
      compact
      variant="ghost"
      disabled={fileBusy || sharing}
      onPress={onToggleActions}
    />
  </Row>
);

const FileActionRows = ({
  copied,
  file,
  fileBusy,
  selection,
  sharing,
  showAttach,
  onAttach,
  onAttachSelection,
  onCopied,
  onCopyError,
  onOpen,
  onShare,
}: {
  copied: boolean;
  file: OpenFile;
  fileBusy: boolean;
  selection: { end: number; start: number };
  sharing: boolean;
  showAttach: boolean;
  onAttach: () => void;
  onAttachSelection: () => void;
  onCopied: () => void;
  onCopyError: (error: unknown) => void;
  onOpen: (path: string) => Promise<void>;
  onShare: () => void;
}) => (
  <>
    <Row>
      {showAttach && (
        <Button
          title="Attach to prompt"
          compact
          disabled={fileBusy || sharing}
          onPress={onAttach}
        />
      )}
      {showAttach && file.original && (
        <Button
          title="Attach selection"
          compact
          disabled={fileBusy || sharing || selection.end <= selection.start}
          onPress={onAttachSelection}
        />
      )}
      <Button
        title="Reload"
        compact
        disabled={fileBusy || sharing}
        onPress={() => {
          if (file.text === file.initialText) {
            void onOpen(file.path);
          } else {
            void confirmAction(
              "Reload the file?",
              "Your unsaved edits will be lost."
            ).then((yes) => {
              if (yes) {
                void onOpen(file.path);
              }
              return yes;
            });
          }
        }}
      />
      {file.original && (
        <Button
          title={copied ? "Copied" : "Copy text"}
          compact
          onPress={() => {
            void copyText(file.text).then(onCopied).catch(onCopyError);
          }}
        />
      )}
      {file.bytes && (
        <Button
          title={shareTitle()}
          compact
          busy={sharing}
          disabled={fileBusy}
          onPress={onShare}
        />
      )}
    </Row>
    {file.original && selection.end > selection.start && (
      <BodyText muted style={{ fontSize: 12 }}>
        Selected text: {selection.end - selection.start} characters
      </BodyText>
    )}
  </>
);

const FileBody = ({
  file,
  fileBusy,
  setCopied,
  setFile,
  setSaved,
  setSelection,
  sharing,
  onShare,
}: {
  file: OpenFile;
  fileBusy: boolean;
  setCopied: (value: boolean) => void;
  setFile: (update: (current: OpenFile | null) => OpenFile | null) => void;
  setSaved: (value: boolean) => void;
  setSelection: (value: { end: number; start: number }) => void;
  sharing: boolean;
  onShare: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  if (fileBusy && !file.bytes) {
    return <Busy />;
  }
  if (file.preview) {
    return (
      <View style={styles.mediaPreview}>
        <Image
          accessibilityLabel={fileName(file.path)}
          source={{ uri: file.preview }}
          resizeMode="contain"
          style={{ height: "100%", width: "100%" }}
          onError={() =>
            setFile((current) =>
              current?.path === file.path
                ? {
                    ...current,
                    notice:
                      "This device cannot display this image. Save or share the file to open it in another app.",
                    preview: undefined,
                  }
                : current
            )
          }
        />
      </View>
    );
  }
  if (file.original) {
    return (
      <Field
        accessibilityLabel={`Edit ${file.path}`}
        multiline
        scrollEnabled
        value={file.text}
        onSelectionChange={(event) => setSelection(event.nativeEvent.selection)}
        onChangeText={(text) => {
          setFile((current) => current && { ...current, text });
          setSaved(false);
          setCopied(false);
          setSelection({ end: 0, start: 0 });
        }}
        editable={!fileBusy && !sharing}
        containerStyle={{ flex: 1, minHeight: 0 }}
        style={{
          flex: 1,
          fontFamily: mono,
          fontSize: 14,
          lineHeight: 21,
          minHeight: 0,
        }}
      />
    );
  }
  if (!file.bytes) {
    return null;
  }
  const fallbackNotice = imageMime(file.bytes)
    ? "This image exceeds the 8 MiB preview limit."
    : "Save or share this file to open it in a compatible app.";
  return (
    <View style={styles.mediaPreview}>
      <BodyText>
        {file.mime} · {(file.bytes.length / 1024).toFixed(1)} KiB
      </BodyText>
      <BodyText muted>{file.notice || fallbackNotice}</BodyText>
      <Button title={shareTitle()} busy={sharing} onPress={onShare} />
    </View>
  );
};

const Files = ({
  client,
  directory,
  onAttachFile,
}: Pick<Props, "client" | "directory" | "onAttachFile">) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const presentNative = useNativePresentation();
  const [path, setPath] = useState("");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [file, setFile] = useState<OpenFile | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fileActionsOpen, setFileActionsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selection, setSelection] = useState({ end: 0, start: 0 });
  const [sharing, setSharing] = useState(false);
  const location = { directory };
  const searching = query.trim().length > 0;
  useUnsavedChanges(
    `workspace-editor:${directory}`,
    "File editor",
    !!file && (file.text !== file.initialText || (fileBusy && !!file.original))
  );

  const [request, setRequest] = useState({
    client,
    directory,
    path,
    query,
    revision,
  });
  if (
    request.client !== client ||
    request.directory !== directory ||
    request.path !== path ||
    request.query !== query ||
    request.revision !== revision
  ) {
    setRequest({ client, directory, path, query, revision });
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        void loadEntriesInto(request, controller.signal, {
          setEntries,
          setError,
          setLoading,
        });
      },
      request.query.trim() ? 250 : 0
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [request]);

  const openFile = async (nextPath: string) => {
    setFile({
      bytes: null,
      initialText: "",
      original: null,
      path: nextPath,
      text: "",
    });
    setSaveError(null);
    setSaved(false);
    setFileActionsOpen(false);
    setCopied(false);
    setSelection({ end: 0, start: 0 });
    await runWithFlag(setFileBusy, async () => {
      try {
        const bytes = await client.file.read({ location, path: nextPath });
        const loaded = loadedFile(nextPath, bytes);
        setFile((current) => (current?.path === nextPath ? loaded : current));
      } catch (error_) {
        setFile((current) =>
          current?.path === nextPath
            ? { ...current, error: errorMessage(error_) }
            : current
        );
      }
    });
  };

  const closeFile = async () => {
    if (fileBusy || sharing) {
      return false;
    }
    if (
      file &&
      file.text !== file.initialText &&
      !(await confirmAction(
        "Discard your edits?",
        "Your unsaved edits will be lost."
      ))
    ) {
      return false;
    }
    setFile(null);
    return true;
  };

  const save = async () => {
    const original = file?.original;
    if (!file || !original) {
      return;
    }
    const editing = file;
    setSaveError(null);
    await runWithFlag(setFileBusy, async () => {
      try {
        const bytes = await saveEditableFile(
          {
            read: () => client.file.read({ location, path: editing.path }),
            write: (payload) =>
              client.experimental.file.write({
                location,
                path: editing.path,
                payload,
              }),
          },
          original,
          editing.text
        );
        setFile((current) =>
          current?.path === editing.path
            ? { ...current, bytes, initialText: editing.text, original: bytes }
            : current
        );
        setSaved(true);
        setRevision((value) => value + 1);
      } catch (error_) {
        setSaveError(errorMessage(error_));
      }
    });
  };

  const attach = async (contextText?: string) => {
    if (!file || !onAttachFile) {
      return;
    }
    const editing = file;
    if (!(await closeFile())) {
      return;
    }
    try {
      if (
        (await onAttachFile(
          serverFilePath(directory, editing.path),
          contextText
        )) === false
      ) {
        setFile(editing);
        setSaveError(
          "The attachment was not added. Check the connection and retry."
        );
      }
    } catch (error_) {
      setFile(editing);
      setSaveError(errorMessage(error_));
    }
  };

  const attachSelection = async () => {
    if (!file) {
      return;
    }
    const context = selectionContext(file, selection, directory);
    if (context === undefined) {
      return;
    }
    await attach(context);
  };

  const shareFile = async () => {
    if (!file?.bytes) {
      return;
    }
    setSaveError(null);
    const current = file;
    const { bytes: fileBytes } = file;
    await runWithFlag(setSharing, async () => {
      try {
        const bytes = current.original
          ? new TextEncoder().encode(current.text)
          : fileBytes;
        const name =
          fileName(current.path).replaceAll(/[^\p{L}\p{N}._-]/gu, "_") ||
          "download";
        const mime = current.mime || "application/octet-stream";
        if (Platform.OS === "web") {
          downloadInBrowser(bytes, name, mime);
        } else {
          await shareNatively(bytes, name, mime, presentNative);
        }
      } catch (error_) {
        setSaveError(errorMessage(error_));
      }
    });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <Field
          accessibilityLabel="Find workspace files"
          placeholder="Find a file or folder…"
          value={query}
          onChangeText={setQuery}
        />
        <Row style={{ flexWrap: "nowrap" }}>
          <Button
            title="↑ Parent"
            compact
            disabled={!path || searching}
            onPress={() => setPath(parentPath(path))}
          />
          <BodyText
            muted
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{ flex: 1, fontFamily: mono, fontSize: 13, minWidth: 0 }}
          >
            {searching ? "Search · up to 200" : path || "/"}
          </BodyText>
          <Button
            title="Refresh"
            compact
            variant="ghost"
            onPress={() => setRevision((value) => value + 1)}
          />
        </Row>
        <ErrorNotice
          error={error}
          onRetry={() => setRevision((value) => value + 1)}
        />
      </View>
      {loading ? (
        <Busy />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(entry) => entry.path}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Empty {...emptyFilesText(error, searching)} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${item.type === "directory" ? "Open folder" : "Open file"} ${item.path}`}
              style={({ pressed }) => [
                styles.fileRow,
                pressed && { backgroundColor: colors.raised },
              ]}
              onPress={() => {
                if (item.type === "directory") {
                  setPath(item.path);
                  setQuery("");
                } else {
                  void openFile(item.path);
                }
              }}
            >
              <Text style={styles.fileIcon}>
                {item.type === "directory" ? "▱" : "≡"}
              </Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <BodyText numberOfLines={2}>{fileName(item.path)}</BodyText>
                {searching && (
                  <BodyText
                    muted
                    numberOfLines={2}
                    ellipsizeMode="middle"
                    style={{ fontSize: 12 }}
                  >
                    {item.path}
                  </BodyText>
                )}
              </View>
              <BodyText muted>{item.type === "directory" ? "›" : ""}</BodyText>
            </Pressable>
          )}
        />
      )}
      <Sheet
        visible={!!file}
        title="File"
        scroll={false}
        onClose={() => {
          void closeFile();
        }}
      >
        {file && (
          <View style={styles.editor}>
            <BodyText
              selectable
              muted
              numberOfLines={2}
              ellipsizeMode="middle"
              style={{ fontFamily: mono, fontSize: 12 }}
            >
              {file.path}
            </BodyText>
            <FileHeaderRow
              file={file}
              fileActionsOpen={fileActionsOpen}
              fileBusy={fileBusy}
              saved={saved}
              sharing={sharing}
              onAttach={() => {
                void attach();
              }}
              onSave={() => {
                void save();
              }}
              onToggleActions={() => setFileActionsOpen((open) => !open)}
              showAttach={!!onAttachFile}
            />
            {fileActionsOpen && (
              <FileActionRows
                copied={copied}
                file={file}
                fileBusy={fileBusy}
                selection={selection}
                sharing={sharing}
                showAttach={!!onAttachFile}
                onAttach={() => {
                  void attach();
                }}
                onAttachSelection={() => {
                  void attachSelection();
                }}
                onCopied={() => setCopied(true)}
                onCopyError={(error_) => setSaveError(errorMessage(error_))}
                onOpen={openFile}
                onShare={() => {
                  void shareFile();
                }}
              />
            )}
            <ErrorNotice error={file.error || saveError} />
            <FileBody
              file={file}
              fileBusy={fileBusy}
              setCopied={setCopied}
              setFile={setFile}
              setSaved={setSaved}
              setSelection={setSelection}
              sharing={sharing}
              onShare={() => {
                void shareFile();
              }}
            />
            {file.original && (
              <BodyText muted style={{ fontSize: 12 }}>
                If the server file changes, copy your edits before you reload
                the file.
              </BodyText>
            )}
          </View>
        )}
      </Sheet>
    </View>
  );
};

const Changes = ({
  client,
  directory,
  onAttachFile,
}: Pick<Props, "client" | "directory" | "onAttachFile">) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [info, setInfo] = useState<VcsInfo | null>(null);
  const [files, setFiles] = useState<VcsFileStatus[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [mode, setMode] = useState<"working" | "branch" | "committed">(
    "working"
  );
  const [base, setBase] = useState("");
  const [diff, setDiff] = useState<FileDiffInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [branchesVisible, setBranchesVisible] = useState(false);
  const [revision, setRevision] = useState(0);
  const [review, setReview] = useState<FileDiffInfo | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [addingReview, setAddingReview] = useState(false);
  useUnsavedChanges(
    `workspace-review:${directory}`,
    "Review comment",
    !!review && !!reviewComment.trim() && !addingReview
  );
  const [vcsRequest, setVcsRequest] = useState({
    client,
    directory,
    revision,
  });
  if (
    vcsRequest.client !== client ||
    vcsRequest.directory !== directory ||
    vcsRequest.revision !== revision
  ) {
    setVcsRequest({ client, directory, revision });
    setLoading(true);
    setError(null);
  }
  useEffect(() => {
    const { client: requestClient, directory: requestDirectory } = vcsRequest;
    const controller = new AbortController();
    void Promise.allSettled([
      requestClient.vcs.get(
        { location: { directory: requestDirectory } },
        { signal: controller.signal }
      ),
      requestClient.vcs.status(
        { location: { directory: requestDirectory } },
        { signal: controller.signal }
      ),
    ])
      .then(([vcs, status]) => {
        if (controller.signal.aborted) {
          return false;
        }
        if (vcs.status === "fulfilled") {
          setInfo(vcs.value.data);
        }
        if (status.status === "fulfilled") {
          setFiles(status.value.data);
        }
        const failures = [vcs, status].filter(
          (result) => result.status === "rejected"
        );
        if (failures.length) {
          setError(
            failures.map((result) => errorMessage(result.reason)).join("\n")
          );
        }
        return true;
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [vcsRequest]);
  const loadDiff = async (file?: string) => {
    setError(null);
    await runWithFlag(setBusy, async () => {
      try {
        const result = await client.vcs.diff({
          base: base.trim() || undefined,
          location: { directory },
          mode,
          untracked: "files",
        });
        setDiff(
          file ? result.data.filter((item) => item.file === file) : result.data
        );
      } catch (error_) {
        setError(errorMessage(error_));
      }
    });
  };
  const loadBranches = async () => {
    setError(null);
    await runWithFlag(setBusy, async () => {
      try {
        const result = await client.vcs.branch.list({
          limit: 200,
          location: { directory },
        });
        setBranches(result.data);
        setBranchesVisible(true);
      } catch (error_) {
        setError(errorMessage(error_));
      }
    });
  };
  const closeDiff = async () => {
    if (addingReview) {
      return;
    }
    if (
      reviewComment.trim() &&
      !(await confirmAction(
        "Discard review comment?",
        "Your comment has not been added to a prompt."
      ))
    ) {
      return;
    }
    setReview(null);
    setReviewVisible(false);
    setReviewComment("");
    setDiff(null);
  };
  const openReview = async (file: FileDiffInfo) => {
    if (review?.file !== file.file) {
      if (
        reviewComment.trim() &&
        !(await confirmAction(
          "Discard review comment?",
          "Your comment has not been added to a prompt."
        ))
      ) {
        return;
      }
      setReviewComment("");
    }
    setReview(file);
    setReviewVisible(true);
    setError(null);
  };
  const addReview = async () => {
    if (!review || !onAttachFile || !reviewComment.trim()) {
      return;
    }
    setError(null);
    const target = review;
    await runWithFlag(setAddingReview, async () => {
      try {
        const context = `Review feedback for ${serverFilePath(directory, target.file)}:\n\n${reviewComment.trim()}\n\n${quotedText(target.patch, "diff")}${target.more ? "\n\nThe server truncated this diff." : ""}`;
        if (
          (await onAttachFile(
            serverFilePath(directory, target.file),
            context
          )) === false
        ) {
          setError("The review was not added. Check the connection and retry.");
        } else {
          setReview(null);
          setReviewVisible(false);
          setReviewComment("");
          setDiff(null);
        }
      } catch (error_) {
        setError(errorMessage(error_));
      }
    });
  };
  return (
    <View style={styles.screen}>
      <View style={styles.controls}>
        <Row style={{ flexWrap: "nowrap" }}>
          <BodyText
            numberOfLines={1}
            ellipsizeMode="middle"
            style={{ flex: 1, fontFamily: mono, minWidth: 0 }}
          >
            ⑂ {info?.branch.current || "No branch"}
          </BodyText>
          <Button
            title="Branches"
            compact
            variant="ghost"
            onPress={() => {
              void loadBranches();
            }}
            busy={busy}
          />
          <Button
            title="Refresh"
            compact
            variant="ghost"
            onPress={() => setRevision((value) => value + 1)}
          />
        </Row>
        <Row>
          {(["working", "branch", "committed"] as const).map((value) => (
            <Button
              key={value}
              title={
                {
                  branch: "Branch",
                  committed: "Committed",
                  working: "Working tree",
                }[value]
              }
              compact
              variant={mode === value ? "primary" : "secondary"}
              onPress={() => setMode(value)}
            />
          ))}
        </Row>
        {mode !== "working" && (
          <Field
            label="Base branch or commit (optional)"
            placeholder="Server default"
            value={base}
            onChangeText={setBase}
          />
        )}
        <Button
          title="View diff"
          onPress={() => {
            void loadDiff();
          }}
          busy={busy}
        />
        <ErrorNotice
          error={error}
          onRetry={() => setRevision((value) => value + 1)}
        />
      </View>
      {loading ? (
        <Busy />
      ) : (
        <FlatList
          data={files}
          keyExtractor={(file) => file.file}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Empty
              title={error ? "Changes unavailable" : "No changes"}
              detail={
                error
                  ? "Retry the request or check your repository."
                  : "Your working tree has no changed files."
              }
            />
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View diff for ${item.file}`}
              style={styles.fileRow}
              onPress={() => {
                void loadDiff(item.file);
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <BodyText numberOfLines={2} ellipsizeMode="middle">
                  {item.file}
                </BodyText>
                <BodyText muted style={{ fontSize: 12 }}>
                  {item.status}
                </BodyText>
              </View>
              <BodyText style={{ color: colors.success }}>
                +{item.additions}
              </BodyText>
              <BodyText style={{ color: colors.danger }}>
                −{item.deletions}
              </BodyText>
            </Pressable>
          )}
        />
      )}
      <Sheet
        visible={diff !== null}
        title={reviewVisible ? "Review comment" : "Changes"}
        onClose={() => {
          void closeDiff();
        }}
      >
        {reviewVisible && review ? (
          <>
            <BodyText selectable style={{ fontFamily: mono }}>
              {review.file}
            </BodyText>
            <Field
              label="Comment for OpenCode"
              multiline
              value={reviewComment}
              onChangeText={setReviewComment}
              editable={!addingReview}
            />
            <ErrorNotice error={error} />
            <Button
              title="Add review to prompt"
              variant="primary"
              busy={addingReview}
              disabled={!reviewComment.trim()}
              onPress={() => {
                void addReview();
              }}
            />
            <Button
              title="Back to diff"
              disabled={addingReview}
              onPress={() => setReviewVisible(false)}
            />
          </>
        ) : (
          <>
            {diff?.length === 0 && (
              <Empty
                title="No diff"
                detail="The selected comparison has no changes."
              />
            )}
            {diff?.map((file) => (
              <Card key={file.file}>
                <BodyText selectable style={{ fontFamily: mono }}>
                  {file.file}
                </BodyText>
                <BodyText muted>
                  +{file.additions} −{file.deletions} · {file.status}
                </BodyText>
                <Patch patch={file.patch} />
                {file.more && (
                  <BodyText muted>The server truncated this diff.</BodyText>
                )}
                {onAttachFile && (
                  <Button
                    title={
                      review?.file === file.file && reviewComment.trim()
                        ? "Continue review comment"
                        : "Add review comment"
                    }
                    compact
                    onPress={() => {
                      void openReview(file);
                    }}
                  />
                )}
              </Card>
            ))}
          </>
        )}
      </Sheet>
      <Sheet
        visible={branchesVisible}
        title="Branches"
        onClose={() => setBranchesVisible(false)}
      >
        <BodyText muted>Select a branch as the comparison base.</BodyText>
        {branches.map((branch) => (
          <Button
            key={branch}
            title={branch}
            onPress={() => {
              setBase(branch);
              setMode("branch");
              setBranchesVisible(false);
            }}
          />
        ))}
      </Sheet>
    </View>
  );
};

const Worktrees = ({
  client,
  directory,
  onDirectoryChange,
}: Pick<Props, "client" | "directory" | "onDirectoryChange">) => {
  const styles = useThemedStyles(createStyles);
  const [location, setLocation] = useState<LocationPublicInfo | null>(null);
  const [trees, setTrees] = useState<WorktreeDirectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [from, setFrom] = useState("");
  const [revision, setRevision] = useState(0);
  const [treeRequest, setTreeRequest] = useState({
    client,
    directory,
    revision,
  });
  if (
    treeRequest.client !== client ||
    treeRequest.directory !== directory ||
    treeRequest.revision !== revision
  ) {
    setTreeRequest({ client, directory, revision });
    setLoading(true);
    setError(null);
  }
  useEffect(() => {
    const { client: requestClient, directory: requestDirectory } = treeRequest;
    const controller = new AbortController();
    void requestClient.location
      .get(
        { location: { directory: requestDirectory } },
        { signal: controller.signal }
      )
      .then(async (result) => {
        const list = await requestClient.worktree.list(
          { projectID: result.project.id },
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          setLocation(result);
          setTrees(list);
        }
        return list;
      })
      .catch((error_) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(error_));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [treeRequest]);
  const create = async () => {
    if (!location) {
      return;
    }
    setError(null);
    const projectID = location.project.id;
    await runWithFlag(setBusy, async () => {
      try {
        const tree = await client.worktree.create({
          branch: branch.trim() || undefined,
          from: from.trim() || undefined,
          name: name.trim() || undefined,
          projectID,
        });
        setCreateVisible(false);
        onDirectoryChange(tree.directory);
      } catch (error_) {
        setError(errorMessage(error_));
      }
    });
  };
  const remove = async (tree: WorktreeDirectory) => {
    if (
      !location ||
      tree.directory === location.project.directory ||
      !(await confirmAction(
        "Remove this worktree?",
        `The server will remove ${tree.directory}. Removal stops if the worktree has uncommitted changes.`
      ))
    ) {
      return;
    }
    setError(null);
    const projectID = location.project.id;
    await runWithFlag(setBusy, async () => {
      try {
        await client.worktree.remove({
          directory: tree.directory,
          force: false,
          projectID,
        });
        setRevision((value) => value + 1);
      } catch (error_) {
        setError(errorMessage(error_));
      }
    });
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Row>
        <BodyText muted style={{ flex: 1 }}>
          Isolated Git workspaces
        </BodyText>
        <Button
          title="Create"
          compact
          variant="primary"
          disabled={!location}
          onPress={() => setCreateVisible(true)}
        />
        <Button
          title="Refresh"
          compact
          onPress={() => setRevision((value) => value + 1)}
        />
      </Row>
      <ErrorNotice
        error={error}
        onRetry={() => setRevision((value) => value + 1)}
      />
      {loading ? (
        <Busy />
      ) : (
        <>
          {location && (
            <Card>
              <BodyText style={{ fontWeight: "600" }}>
                Project checkout
              </BodyText>
              <BodyText muted style={{ fontFamily: mono, fontSize: 13 }}>
                {location.project.directory}
              </BodyText>
              <Button
                title={
                  directory === location.project.directory
                    ? "Current checkout"
                    : "Open checkout"
                }
                disabled={directory === location.project.directory}
                onPress={() => onDirectoryChange(location.project.directory)}
              />
            </Card>
          )}
          {!error && trees.length === 0 && (
            <Empty
              title="No worktrees"
              detail="Create a worktree to keep a separate branch and set of files."
            />
          )}
          {trees.map((tree) => (
            <Card key={tree.directory}>
              <BodyText style={{ fontWeight: "600" }}>
                {fileName(tree.directory)}
              </BodyText>
              <BodyText
                selectable
                muted
                style={{ fontFamily: mono, fontSize: 13 }}
              >
                {tree.directory}
              </BodyText>
              <Row>
                <Button
                  title={
                    tree.directory === directory ? "Current worktree" : "Open"
                  }
                  disabled={tree.directory === directory || busy}
                  onPress={() => onDirectoryChange(tree.directory)}
                />
                <Button
                  title="Remove"
                  variant="danger"
                  disabled={
                    tree.directory === directory ||
                    tree.directory === location?.project.directory
                  }
                  busy={busy}
                  onPress={() => {
                    void remove(tree);
                  }}
                />
              </Row>
            </Card>
          ))}
        </>
      )}
      <Sheet
        visible={createVisible}
        title="Create worktree"
        onClose={() => {
          if (!busy) {
            setCreateVisible(false);
          }
        }}
      >
        <ErrorNotice error={error} />
        <Field
          label="Name (optional)"
          value={name}
          onChangeText={setName}
          editable={!busy}
        />
        <Field
          label="Branch (optional)"
          value={branch}
          onChangeText={setBranch}
          editable={!busy}
        />
        <Field
          label="Start from branch or commit (optional)"
          value={from}
          onChangeText={setFrom}
          editable={!busy}
        />
        <BodyText muted>The server chooses defaults for blank fields.</BodyText>
        <Button
          title="Create and open"
          variant="primary"
          busy={busy}
          onPress={() => {
            void create();
          }}
        />
      </Sheet>
    </ScrollView>
  );
};

const Workspace = ({
  client,
  connection,
  directory,
  onDirectoryChange,
  onAttachFile,
  visible = true,
  sessionID,
  section: activeTab,
}: Props) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.screen}>
      <View
        style={[styles.screen, activeTab !== "Files" && { display: "none" }]}
      >
        <Files
          client={client}
          directory={directory}
          onAttachFile={onAttachFile}
        />
      </View>
      {activeTab === "Changes" && (
        <Changes
          client={client}
          directory={directory}
          onAttachFile={onAttachFile}
        />
      )}
      {activeTab === "Worktrees" && (
        <Worktrees
          client={client}
          directory={directory}
          onDirectoryChange={onDirectoryChange}
        />
      )}
      {visible && activeTab === "Terminal" && (
        <TerminalPanel
          client={client}
          connection={connection}
          directory={directory}
          sessionID={sessionID}
        />
      )}
    </View>
  );
};

export const WorkspaceScreen = (props: Props) => (
  <Workspace key={`${props.connection.id}:${props.directory}`} {...props} />
);
