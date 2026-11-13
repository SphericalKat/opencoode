import { isFileNotFoundError } from "@opencode/client";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { ShellIcon } from "../../components/shell-icon";
import {
  Button,
  Card,
  confirmAction,
  Disclosure,
  disabledOpacity,
  ErrorNotice,
  Field,
  JsonView,
  BodyText,
  mono,
  Sheet,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { saveConfigFile, withSettingsRequest } from "../../lib/settings";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { useUnsavedChanges } from "../../lib/unsaved";
import { Page, runBusy, useResource } from "./shared";
import { createStyles } from "./styles";

type ConfigAction =
  | { kind: "reload" }
  | { kind: "open-project" }
  | { kind: "edit"; path: string }
  | { kind: "shell"; path: string | null }
  | { kind: "save" };

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

const ConfigActionRow = ({
  onPress,
  showDivider,
  status,
  title,
}: {
  onPress: () => void;
  showDivider: boolean;
  status: "busy" | "disabled" | "idle";
  title: string;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isActive = status === "busy";
  const dimmed = status === "disabled";
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ busy: isActive, disabled: status !== "idle" }}
        disabled={status !== "idle"}
        onPress={onPress}
        style={({ pressed }) => [
          styles.sectionRow,
          pressed && { backgroundColor: colors.raised },
          dimmed && { opacity: disabledOpacity },
        ]}
      >
        <View style={styles.detail}>
          <BodyText style={styles.sectionName}>{title}</BodyText>
        </View>
        {isActive ? (
          <ActivityIndicator size="small" color={colors.muted} />
        ) : (
          <ShellIcon name="chevron" size={16} color={colors.muted} />
        )}
      </Pressable>
      {showDivider && (
        <View pointerEvents="none" style={styles.sectionDivider} />
      )}
    </View>
  );
};

const DefaultShellDisclosure = ({
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
  <Disclosure title="Default shell">
    <BodyText muted>
      This sets the shell for commands on your OpenCode server.
    </BodyText>
    <Button
      title="Use system default"
      busy={sameConfigAction(activeAction, { kind: "shell", path: null })}
      disabled={busy}
      onPress={onSelectDefault}
    />
    {shells?.map((shell) => (
      <Button
        key={shell.path}
        title={`${shell.name} · ${shell.path}`}
        disabled={busy || !shell.acceptable}
        busy={sameConfigAction(activeAction, {
          kind: "shell",
          path: shell.path,
        })}
        onPress={() => onSelectShell(shell.path, shell.name)}
      />
    ))}
  </Disclosure>
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
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(
    client,
    directory,
    async (signal) => {
      const [entries, shells] = await Promise.all([
        client.config.get({ location: { directory } }, { signal }),
        client.config.shells({ signal }),
      ]);
      return { entries, shells };
    }
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
  const [notice, setNotice] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ConfigAction | null>(null);
  const busy = activeAction !== null;
  const busyLock = useRef(false);
  const run = async (
    action: ConfigAction,
    task: (signal: AbortSignal) => Promise<void>
  ) => {
    if (busyLock.current) {
      return;
    }
    busyLock.current = true;
    setErrorAction(null);
    setNotice(null);
    await runBusy(
      (next) => {
        setActiveAction(next ? action : null);
      },
      setErrorAction,
      async () => {
        await withSettingsRequest(task);
      }
    );
    busyLock.current = false;
  };
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
      <View style={styles.groupPanel}>
        <ConfigActionRow
          showDivider={false}
          status={rowStatus(activeAction, { kind: "reload" })}
          title="Reload server configuration"
          onPress={() => {
            void run({ kind: "reload" }, async (signal) => {
              await client.location.reload({ signal });
              await refresh(signal);
              signal.throwIfAborted();
              setNotice("I reloaded the server configuration.");
            });
          }}
        />
        <ConfigActionRow
          showDivider
          status={rowStatus(activeAction, { kind: "open-project" })}
          title="Open project configuration"
          onPress={() => {
            void run({ kind: "open-project" }, async (signal) => {
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
            });
          }}
        />
      </View>
      {data?.entries.map((entry, index) => (
        <Card key={index}>
          <BodyText style={{ fontFamily: mono, fontSize: 13 }}>
            {entry.path || "Runtime configuration"}
          </BodyText>
          <BodyText muted>
            {entry.type === "directory"
              ? "Configuration directory"
              : "Configuration document"}
          </BodyText>
          {entry.type === "document" && (
            <>
              <Disclosure title="Read effective values" variant="embedded">
                <JsonView value={entry.info} />
              </Disclosure>
              {entry.path && (
                <Button
                  title="Edit source file"
                  busy={
                    entry.path
                      ? sameConfigAction(activeAction, {
                          kind: "edit",
                          path: entry.path,
                        })
                      : false
                  }
                  disabled={busy}
                  onPress={() => {
                    const editPath = entry.path;
                    if (!editPath) {
                      return;
                    }
                    void run(
                      { kind: "edit", path: editPath },
                      async (signal) => {
                        const source = new TextDecoder().decode(
                          await client.file.read(
                            { location: { directory }, path: editPath },
                            { signal }
                          )
                        );
                        signal.throwIfAborted();
                        setEditing({ original: source, path: editPath });
                        setText(source);
                      }
                    );
                  }}
                />
              )}
            </>
          )}
        </Card>
      ))}
      <DefaultShellDisclosure
        activeAction={activeAction}
        busy={busy}
        shells={data?.shells}
        onSelectDefault={() => {
          void run({ kind: "shell", path: null }, async (signal) => {
            await client.experimental.config.update(
              { shell: null },
              { signal }
            );
            await refresh(signal);
            signal.throwIfAborted();
            setNotice("I set the shell to the system default.");
          });
        }}
        onSelectShell={(shellPath, shellName) => {
          void run({ kind: "shell", path: shellPath }, async (signal) => {
            await client.experimental.config.update(
              { shell: shellPath },
              { signal }
            );
            await refresh(signal);
            signal.throwIfAborted();
            setNotice(`I selected ${shellName}.`);
          });
        }}
      />
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
              "Your unsaved changes will be lost."
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
          void run({ kind: "save" }, async (signal) => {
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
            await refresh(signal);
            signal.throwIfAborted();
            setEditing(undefined);
            setNotice("I saved and reloaded the configuration.");
          });
        }}
        text={text}
      />
    </Page>
  );
};
