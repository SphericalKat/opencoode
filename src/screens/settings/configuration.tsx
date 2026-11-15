import { isFileNotFoundError } from "@opencode/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { confirmAction } from "../../components/dialog";
import { SheetGroup, SheetRow } from "../../components/list-sheet";
import { ShellIcon } from "../../components/shell-icon";
import {
  Button,
  ErrorNotice,
  Field,
  JsonView,
  BodyText,
  mono,
  Sheet,
  touchTarget,
  usePressFeedback,
} from "../../components/ui";
import { errorMessage } from "../../lib/client";
import type { Client } from "../../lib/client";
import { configurationOptions } from "../../lib/queries/settings";
import { queryKeys } from "../../lib/query-keys";
import { withDeadline } from "../../lib/request";
import { useServerScope } from "../../lib/server-scope";
import { saveConfigFile } from "../../lib/settings";
import { useTheme, useThemedStyles } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { useUnsavedChanges } from "../../lib/unsaved";
import { Page, resourceOf } from "./shared";

type ConfigAction =
  | { kind: "reload" }
  | { kind: "open-project" }
  | { kind: "edit"; path: string }
  | { kind: "shell"; path: string | null }
  | { kind: "save" };

interface ConfigRun {
  action: ConfigAction;
  // Set when the write changes server configuration, so every query for the
  // directory refetches before `done` runs.
  changesConfig?: boolean;
  done?: () => void;
  task: (signal: AbortSignal) => Promise<void>;
}

const sameConfigAction = (
  current: ConfigAction | null,
  expected: ConfigAction
): boolean => {
  if (!current || current.kind !== expected.kind) {
    return false;
  }
  if (current.kind === "edit" && expected.kind === "edit") {
    return current.path === expected.path;
  }
  if (current.kind === "shell" && expected.kind === "shell") {
    return current.path === expected.path;
  }
  return true;
};

const rowStatus = (
  activeAction: ConfigAction | null,
  expected: ConfigAction
): "busy" | "disabled" | "idle" => {
  if (!activeAction) {
    return "idle";
  }
  return sameConfigAction(activeAction, expected) ? "busy" : "disabled";
};

const createRowStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    copy: { flexShrink: 1, minWidth: 0 },
    disabled: { opacity: 0.5 },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 20,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: touchTarget,
      paddingEnd: 12,
      paddingStart: 12,
      paddingVertical: 8,
    },
    subtitle: {
      color: colors.muted,
      fontFamily: mono,
      fontSize: 13,
      lineHeight: 18,
    },
    trailing: { marginLeft: "auto" },
  });

export const MonoRow = ({
  disabled,
  label,
  onPress,
  status = "idle",
  subtitle,
}: {
  disabled?: boolean;
  label: string;
  onPress?: () => void;
  status?: "busy" | "idle";
  subtitle?: string | null;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createRowStyles);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const content = (
    <>
      <View style={styles.copy}>
        <BodyText style={styles.label}>{label}</BodyText>
        {subtitle ? (
          <BodyText style={styles.subtitle}>{subtitle}</BodyText>
        ) : null}
      </View>
      {onPress && (
        <View style={styles.trailing}>
          {status === "busy" ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <ShellIcon name="chevron" size={16} color={colors.faint} />
          )}
        </View>
      )}
    </>
  );
  if (!onPress) {
    return (
      <View accessible style={styles.row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${label}, ${subtitle}` : label}
      accessibilityState={{ disabled: !!disabled }}
      android_ripple={android_ripple}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && pressedStyle,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
};

const ConfigActionRow = ({
  onPress,
  status,
  title,
}: {
  onPress: () => void;
  status: "busy" | "disabled" | "idle";
  title: string;
}) => {
  const { colors } = useTheme();
  return (
    <SheetRow
      label={title}
      onPress={onPress}
      disabled={status !== "idle"}
      trailing={
        status === "busy" ? (
          <ActivityIndicator size="small" color={colors.muted} />
        ) : (
          "chevron"
        )
      }
    />
  );
};

const DefaultShellGroup = ({
  activeAction,
  busy,
  onSelectDefault,
  onSelectShell,
  shells,
}: {
  activeAction: ConfigAction | null;
  busy: boolean;
  onSelectDefault: () => void;
  onSelectShell: (path: string, name: string) => void;
  shells?: { acceptable: boolean; name: string; path: string }[];
}) => (
  <>
    <BodyText muted>
      This sets the shell for commands on your OpenCode server.
    </BodyText>
    <SheetGroup variant="grouped" title="Default shell">
      <ConfigActionRow
        title="Use system default"
        status={rowStatus(activeAction, { kind: "shell", path: null })}
        onPress={onSelectDefault}
      />
      {shells?.map((shell) => (
        <MonoRow
          key={shell.path}
          label={shell.name}
          subtitle={shell.path}
          disabled={busy || !shell.acceptable}
          status={
            sameConfigAction(activeAction, { kind: "shell", path: shell.path })
              ? "busy"
              : "idle"
          }
          onPress={() => onSelectShell(shell.path, shell.name)}
        />
      ))}
    </SheetGroup>
  </>
);

const ConfigEditorSheet = ({
  activeAction,
  busy,
  editing,
  errorAction,
  onChangeText,
  onClose,
  onSave,
  text,
}: {
  activeAction: ConfigAction | null;
  busy: boolean;
  editing?: { original: string | null; path: string };
  errorAction: string | null;
  onChangeText: (next: string) => void;
  onClose: () => void;
  onSave: () => void;
  text: string;
}) => (
  <Sheet visible={!!editing} title="Edit configuration" onClose={onClose}>
    <BodyText style={{ fontFamily: mono, fontSize: 13 }}>
      {editing?.path}
    </BodyText>
    <ErrorNotice error={errorAction} />
    <Field
      label="JSON or JSONC"
      multiline
      editable={!busy}
      value={text}
      onChangeText={onChangeText}
      style={{
        fontFamily: mono,
        fontSize: 13,
        lineHeight: 21,
        minHeight: 360,
      }}
    />
    <Button
      title="Save and reload"
      busy={sameConfigAction(activeAction, { kind: "save" })}
      variant="primary"
      disabled={busy || text === editing?.original}
      onPress={onSave}
    />
  </Sheet>
);

export const Configuration = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const { colors } = useTheme();
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const { data, error, loading, refresh } = resourceOf(
    useQuery(configurationOptions(scope, client, directory))
  );
  const [editing, setEditing] = useState<{
    path: string;
    original: string | null;
  }>();
  const [text, setText] = useState("");
  useUnsavedChanges(
    `configuration:${directory}`,
    "Configuration editor",
    Boolean(editing && text !== editing.original)
  );
  const [viewing, setViewing] = useState<{
    info: unknown;
    path?: string | null;
  }>();
  const [notice, setNotice] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const configWrite = useMutation({
    mutationFn: ({ task }: ConfigRun) => withDeadline(undefined, task),
    onError: (reason) => setErrorAction(errorMessage(reason)),
    onSuccess: async (_result, { changesConfig, done }) => {
      if (changesConfig) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.dir.all(scope, directory),
        });
      }
      done?.();
    },
    scope: { id: `configuration:${scope}:${directory}` },
  });
  const activeAction = configWrite.isPending
    ? configWrite.variables.action
    : null;
  const busy = configWrite.isPending;
  const startConfigTask = (next: ConfigRun) => {
    if (busy) {
      return;
    }
    setErrorAction(null);
    setNotice(null);
    configWrite.mutate(next);
  };
  const editSource = (editPath: string) => {
    if (!editPath) {
      return;
    }
    startConfigTask({
      action: { kind: "edit", path: editPath },
      task: async (signal) => {
        const source = new TextDecoder().decode(
          await client.file.read(
            { location: { directory }, path: editPath },
            { signal }
          )
        );
        signal.throwIfAborted();
        setEditing({ original: source, path: editPath });
        setText(source);
      },
    });
  };
  const entries = data?.entries ?? [];
  const directories = entries.flatMap((entry, index) =>
    entry.type === "directory" ? [{ entry, index }] : []
  );
  const documents = entries.flatMap((entry, index) =>
    entry.type === "document" ? [{ entry, index }] : []
  );
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <BodyText muted>
        These files define agents, models, providers, permissions, tools, and
        other server options.
      </BodyText>
      <ErrorNotice error={errorAction} />
      {notice && (
        <BodyText style={{ color: colors.success }}>{notice}</BodyText>
      )}
      <SheetGroup variant="grouped">
        <ConfigActionRow
          status={rowStatus(activeAction, { kind: "reload" })}
          title="Reload server configuration"
          onPress={() => {
            startConfigTask({
              action: { kind: "reload" },
              changesConfig: true,
              done: () => setNotice("I reloaded the server configuration."),
              task: async (signal) => {
                await client.location.reload({ signal });
              },
            });
          }}
        />
        <ConfigActionRow
          status={rowStatus(activeAction, { kind: "open-project" })}
          title="Open project configuration"
          onPress={() => {
            startConfigTask({
              action: { kind: "open-project" },
              task: async (signal) => {
                const path = `${directory.replace(/[\\/]+$/u, "")}/opencode.jsonc`;
                try {
                  const source = new TextDecoder().decode(
                    await client.file.read(
                      { location: { directory }, path },
                      { signal }
                    )
                  );
                  signal.throwIfAborted();
                  setEditing({ original: source, path });
                  setText(source);
                } catch (error_) {
                  if (!isFileNotFoundError(error_)) {
                    throw error_;
                  }
                  signal.throwIfAborted();
                  setEditing({ original: null, path });
                  setText(
                    '{\n  "$schema": "https://opencode.ai/config.json"\n}\n'
                  );
                }
              },
            });
          }}
        />
      </SheetGroup>
      {directories.length > 0 && (
        <SheetGroup variant="grouped" title="Locations">
          {directories.map(({ entry, index }) => (
            <MonoRow
              key={`${index}:${entry.path}`}
              label="Configuration directory"
              subtitle={entry.path}
            />
          ))}
        </SheetGroup>
      )}
      {documents.length > 0 && (
        <SheetGroup variant="grouped" title="Configuration documents">
          {documents.map(({ entry, index }) => (
            <MonoRow
              key={`view:${index}:${entry.path}`}
              label={
                entry.path ? "Read effective values" : "Read runtime values"
              }
              subtitle={entry.path}
              onPress={() => setViewing({ info: entry.info, path: entry.path })}
            />
          ))}
          {documents.map(({ entry, index }) =>
            entry.path ? (
              <MonoRow
                key={`edit:${index}:${entry.path}`}
                label="Edit source file"
                subtitle={entry.path}
                disabled={busy}
                status={
                  sameConfigAction(activeAction, {
                    kind: "edit",
                    path: entry.path,
                  })
                    ? "busy"
                    : "idle"
                }
                onPress={() => editSource(entry.path ?? "")}
              />
            ) : null
          )}
        </SheetGroup>
      )}
      <DefaultShellGroup
        activeAction={activeAction}
        busy={busy}
        shells={data?.shells}
        onSelectDefault={() => {
          startConfigTask({
            action: { kind: "shell", path: null },
            changesConfig: true,
            done: () => setNotice("I set the shell to the system default."),
            task: async (signal) => {
              await client.experimental.config.update(
                { shell: null },
                { signal }
              );
            },
          });
        }}
        onSelectShell={(shellPath, shellName) => {
          startConfigTask({
            action: { kind: "shell", path: shellPath },
            changesConfig: true,
            done: () => setNotice(`I selected ${shellName}.`),
            task: async (signal) => {
              await client.experimental.config.update(
                { shell: shellPath },
                { signal }
              );
            },
          });
        }}
      />
      <Sheet
        visible={!!viewing}
        title="Effective values"
        onClose={() => setViewing(undefined)}
      >
        {viewing?.path ? (
          <BodyText style={{ fontFamily: mono, fontSize: 13 }}>
            {viewing.path}
          </BodyText>
        ) : null}
        <JsonView value={viewing?.info} />
      </Sheet>
      <ConfigEditorSheet
        activeAction={activeAction}
        busy={busy}
        editing={editing}
        errorAction={errorAction}
        onChangeText={setText}
        onClose={() => {
          if (busy) {
            return;
          }
          if (text === editing?.original) {
            setEditing(undefined);
          } else {
            void confirmAction(
              "Discard changes?",
              "Your unsaved changes will be lost.",
              { confirmLabel: "Discard" }
            ).then((ok) => {
              if (ok) {
                setEditing(undefined);
              }
              return ok;
            });
          }
        }}
        onSave={() => {
          const current = editing;
          if (!current) {
            return;
          }
          startConfigTask({
            action: { kind: "save" },
            changesConfig: true,
            done: () => {
              setEditing(undefined);
              setNotice("I saved and reloaded the configuration.");
            },
            task: async (signal) => {
              await saveConfigFile(
                client,
                directory,
                current.path,
                current.original,
                text,
                signal
              );
              setEditing({ ...current, original: text });
              await client.location.reload({ signal });
            },
          });
        }}
        text={text}
      />
    </Page>
  );
};
