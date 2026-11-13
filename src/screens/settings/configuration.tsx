import { isFileNotFoundError } from "@opencode/client";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { ShellIcon } from "../../components/shell-icon";
import {
  Button,
  Card,
  confirmAction,
  Disclosure,
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

const ConfigActionRow = ({
  action,
  activeAction,
  busy,
  onPress,
  showDivider,
  title,
}: {
  action: string;
  activeAction: string | null;
  busy: boolean;
  onPress: () => void;
  showDivider: boolean;
  title: string;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isActive = activeAction === action;
  const dimmed = busy && !isActive;
  return (
    <View>
      {showDivider && (
        <View pointerEvents="none" style={styles.sectionDivider} />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ busy: isActive, disabled: busy }}
        disabled={busy}
        onPress={onPress}
        style={({ pressed }) => [
          styles.sectionRow,
          pressed && { backgroundColor: colors.raised },
          dimmed && { opacity: 0.55 },
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
    </View>
  );
};

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
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const busy = activeAction !== null;
  const busyLock = useRef(false);
  const run = async (
    action: string,
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
          action="reload"
          activeAction={activeAction}
          busy={busy}
          showDivider={false}
          title="Reload server configuration"
          onPress={() => {
            void run("reload", async (signal) => {
              await client.location.reload({ signal });
              await refresh(signal);
              signal.throwIfAborted();
              setNotice("I reloaded the server configuration.");
            });
          }}
        />
        <ConfigActionRow
          action="open-project"
          activeAction={activeAction}
          busy={busy}
          showDivider
          title="Open project configuration"
          onPress={() => {
            void run("open-project", async (signal) => {
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
                  busy={activeAction === `edit:${entry.path}`}
                  disabled={busy}
                  onPress={() => {
                    void run(`edit:${entry.path}`, async (signal) => {
                      if (!entry.path) {
                        return;
                      }
                      const source = new TextDecoder().decode(
                        await client.file.read(
                          { location: { directory }, path: entry.path },
                          { signal }
                        )
                      );
                      signal.throwIfAborted();
                      setEditing({ original: source, path: entry.path });
                      setText(source);
                    });
                  }}
                />
              )}
            </>
          )}
        </Card>
      ))}
      <Disclosure title="Default shell">
        <BodyText muted>
          This sets the shell for commands on your OpenCode server.
        </BodyText>
        <Button
          title="Use system default"
          busy={activeAction === "shell:default"}
          disabled={busy}
          onPress={() => {
            void run("shell:default", async (signal) => {
              await client.experimental.config.update(
                { shell: null },
                { signal }
              );
              await refresh(signal);
              signal.throwIfAborted();
              setNotice("I set the shell to the system default.");
            });
          }}
        />
        {data?.shells.map((shell) => (
          <Button
            key={shell.path}
            title={`${shell.name} · ${shell.path}`}
            disabled={busy || !shell.acceptable}
            busy={activeAction === `shell:${shell.path}`}
            onPress={() => {
              void run(`shell:${shell.path}`, async (signal) => {
                await client.experimental.config.update(
                  { shell: shell.path },
                  { signal }
                );
                await refresh(signal);
                signal.throwIfAborted();
                setNotice(`I selected ${shell.name}.`);
              });
            }}
          />
        ))}
      </Disclosure>
      <Sheet
        visible={!!editing}
        title="Edit configuration"
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
      >
        <BodyText style={{ fontFamily: mono, fontSize: 13 }}>
          {editing?.path}
        </BodyText>
        <ErrorNotice error={errorAction} />
        <Field
          label="JSON or JSONC"
          multiline
          editable={!busy}
          value={text}
          onChangeText={setText}
          style={{
            fontFamily: mono,
            fontSize: 13,
            lineHeight: 21,
            minHeight: 360,
          }}
        />
        <Button
          title="Save and reload"
          busy={activeAction === "save"}
          variant="primary"
          disabled={busy || text === editing?.original}
          onPress={() => {
            void run("save", async (signal) => {
              if (!editing) {
                return;
              }
              await saveConfigFile(
                client,
                directory,
                editing.path,
                editing.original,
                text,
                signal
              );
              setEditing({ ...editing, original: text });
              await client.location.reload({ signal });
              await refresh(signal);
              signal.throwIfAborted();
              setEditing(undefined);
              setNotice("I saved and reloaded the configuration.");
            });
          }}
        />
      </Sheet>
    </Page>
  );
};
