import type { ShellListOutput } from "@opencode/client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView, Text, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { useTheme } from "../lib/theme";
import {
  Button,
  Busy,
  Card,
  confirmAction,
  Empty,
  ErrorNotice,
  BodyText,
  mono,
  Row,
} from "./ui";

type Command = ShellListOutput["data"][number];
interface Output {
  start: number;
  output: string;
  cursor: number;
  size: number;
}
interface Props {
  client: Client;
  sessionID: string;
  directory: string;
  initialShellID?: string;
  initialDirectory?: string;
}
const pageBytes = 32 * 1024;

export function BackgroundCommands(props: Props) {
  return (
    <Commands
      key={JSON.stringify([
        props.sessionID,
        props.directory,
        props.initialShellID,
        props.initialDirectory,
      ])}
      {...props}
    />
  );
}

function Commands({
  client,
  sessionID,
  directory,
  initialShellID,
  initialDirectory,
}: Props) {
  const { colors } = useTheme();
  const [commands, setCommands] = useState<Command[]>([]);
  const [limit, setLimit] = useState(20);
  const [selectedID, setSelectedID] = useState<string | undefined>(
    initialShellID
  );
  const [selected, setSelected] = useState<Command>();
  const [page, setPage] = useState<Output>();
  const [loading, setLoading] = useState(true);
  const [outputBusy, setOutputBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string>();
  const [outputError, setOutputError] = useState<string>();
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
  );
  const listRequest = useRef<AbortController | undefined>(undefined);
  const outputRequest = useRef<AbortController | undefined>(undefined);
  const generation = useRef(0);
  const mounted = useRef(true);
  const selectedRef = useRef(selectedID);
  selectedRef.current = selectedID;
  const pageStart = useRef(0);
  const previousForeground = useRef(foreground);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      listRequest.current?.abort();
      outputRequest.current?.abort();
    };
  }, [client, sessionID, directory]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(
    async (quiet = false) => {
      if (quiet && listRequest.current && !listRequest.current.signal.aborted) {
        return;
      }
      listRequest.current?.abort();
      const controller = new AbortController();
      listRequest.current = controller;
      if (!quiet) {
        setLoading(true);
      }
      setError(undefined);
      try {
        const result = await client.shell.list(
          { location: { directory } },
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          setCommands(
            result.data.filter(
              (command) => command.metadata.sessionID === sessionID
            )
          );
        }
      } catch (error_) {
        if (!controller.signal.aborted) {
          setError(errorMessage(error_));
        }
      } finally {
        if (listRequest.current === controller) {
          listRequest.current = undefined;
        }
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [client, directory, sessionID]
  );

  const loadOutput = useCallback(
    async (id: string, start = 0, quiet = false) => {
      if (
        quiet &&
        outputRequest.current &&
        !outputRequest.current.signal.aborted
      ) {
        return;
      }
      pageStart.current = start;
      outputRequest.current?.abort();
      const controller = new AbortController();
      outputRequest.current = controller;
      if (!quiet) {
        setOutputBusy(true);
      }
      setOutputError(undefined);
      try {
        const commandDirectory =
          id === initialShellID ? initialDirectory || directory : directory;
        const command = await client.shell.get(
          { id, location: { directory: commandDirectory } },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) {
          return;
        }
        if (
          command.data.metadata.sessionID !== sessionID &&
          id !== initialShellID
        ) {
          throw new Error("This command is not associated with this session");
        }
        setSelected(command.data);
        const result = await client.shell.output(
          {
            cursor: start,
            id,
            limit: pageBytes,
            location: { directory: commandDirectory },
          },
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          setPage({
            cursor: result.data.cursor,
            output: result.data.output,
            size: result.data.size,
            start,
          });
        }
      } catch (error_) {
        if (!controller.signal.aborted) {
          setOutputError(errorMessage(error_));
        }
      } finally {
        if (outputRequest.current === controller) {
          outputRequest.current = undefined;
        }
        if (!controller.signal.aborted) {
          setOutputBusy(false);
        }
      }
    },
    [client, directory, sessionID, initialShellID, initialDirectory]
  );

  useEffect(() => {
    const resumed = foreground && !previousForeground.current;
    previousForeground.current = foreground;
    if (!foreground) {
      listRequest.current?.abort();
      outputRequest.current?.abort();
      setLoading(false);
      setOutputBusy(false);
      return;
    }
    void refresh();
    if (resumed && selectedRef.current) {
      void loadOutput(selectedRef.current, pageStart.current);
    }
    const timer = setInterval(() => {
      void refresh(true);
    }, 3000);
    return () => {
      clearInterval(timer);
      listRequest.current?.abort();
    };
  }, [foreground, refresh, loadOutput]);
  useEffect(() => {
    setSelected(undefined);
    setPage(undefined);
    setOutputError(undefined);
    pageStart.current = 0;
    if (selectedID && previousForeground.current) {
      void loadOutput(selectedID);
    }
    return () => outputRequest.current?.abort();
  }, [selectedID, loadOutput]);
  useEffect(() => {
    if (
      !foreground ||
      !selectedID ||
      selected?.status !== "running" ||
      (page && page.cursor < page.size)
    ) {
      return;
    }
    const timer = setInterval(() => {
      void loadOutput(selectedID, page?.start ?? 0, true);
    }, 3000);
    return () => clearInterval(timer);
  }, [
    foreground,
    selectedID,
    selected?.status,
    page?.start,
    page?.cursor,
    page?.size,
    loadOutput,
  ]);

  async function remove() {
    if (
      !selectedID ||
      !selected ||
      selected.id !== selectedID ||
      selected.metadata.sessionID !== sessionID ||
      stopping
    ) {
      return;
    }
    const id = selectedID;
    const owner = generation.current;
    const running = selected?.status === "running";
    if (
      !(await confirmAction(
        running ? "Stop this command?" : "Remove retained output?",
        running
          ? "The server will stop this command and remove its captured output."
          : "The server will delete the captured output for this command."
      ))
    ) {
      return;
    }
    if (
      !mounted.current ||
      owner !== generation.current ||
      selectedRef.current !== id
    ) {
      return;
    }
    setStopping(true);
    setOutputError(undefined);
    try {
      const commandDirectory =
        id === initialShellID ? initialDirectory || directory : directory;
      await client.shell.remove({
        id,
        location: { directory: commandDirectory },
      });
      if (!mounted.current || owner !== generation.current) {
        return;
      }
      outputRequest.current?.abort();
      setSelectedID(undefined);
      setSelected(undefined);
      setPage(undefined);
      await refresh();
    } catch (error_) {
      if (mounted.current && owner === generation.current) {
        setOutputError(errorMessage(error_));
      }
    } finally {
      if (mounted.current && owner === generation.current) {
        setStopping(false);
      }
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <BodyText muted>
        Commands belong to this session. Running commands refresh while this
        panel is open.
      </BodyText>
      <Row>
        <BodyText style={{ flex: 1, fontWeight: "500" }}>
          {commands.length} running
        </BodyText>
        <Button
          title="Refresh"
          compact
          busy={loading}
          onPress={() => {
            void refresh();
            if (selectedID) {
              void loadOutput(selectedID, page?.start ?? 0);
            }
          }}
        />
      </Row>
      <ErrorNotice
        error={error}
        onRetry={() => {
          void refresh();
        }}
      />
      {loading && !commands.length && <Busy />}
      {!loading && !error && !commands.length && (
        <Empty
          title="No running commands"
          detail="Open a shell message's full output to inspect a completed command."
        />
      )}
      {commands.slice(0, limit).map((command) => (
        <Card key={command.id}>
          <BodyText
            selectable
            numberOfLines={3}
            style={{ fontFamily: mono, fontSize: 13 }}
          >
            {command.command}
          </BodyText>
          <BodyText muted numberOfLines={2}>
            {command.cwd}
          </BodyText>
          <Button
            title={selectedID === command.id ? "Selected" : "View output"}
            compact
            selected={selectedID === command.id}
            disabled={stopping}
            onPress={() => setSelectedID(command.id)}
          />
        </Card>
      ))}
      {commands.length > limit && (
        <Button
          title="Load more commands"
          compact
          onPress={() => setLimit((value) => value + 20)}
        />
      )}
      {selectedID && (
        <Card>
          {selectedID === initialShellID &&
            initialDirectory &&
            initialDirectory !== directory && (
              <BodyText muted>Output location: {initialDirectory}</BodyText>
            )}
          {selected && (
            <>
              <BodyText selectable style={{ fontFamily: mono, fontSize: 13 }}>
                {selected.command}
              </BodyText>
              <BodyText muted>
                {selected.status}
                {selected.exit === undefined ? "" : ` · Exit ${selected.exit}`}
                {selected.signal ? ` · ${selected.signal}` : ""}
              </BodyText>
            </>
          )}
          <ErrorNotice
            error={outputError}
            onRetry={() => {
              void loadOutput(selectedID, page?.start ?? 0);
            }}
          />
          {outputBusy && !page && <Busy />}
          {page && (
            <>
              <BodyText muted>
                Bytes {page.start.toLocaleString()}–
                {page.cursor.toLocaleString()} of {page.size.toLocaleString()}
              </BodyText>
              {page.output ? (
                <ScrollView horizontal style={{ maxHeight: 360 }}>
                  <ScrollView nestedScrollEnabled style={{ maxHeight: 360 }}>
                    <Text
                      selectable
                      style={{
                        color: colors.text,
                        fontFamily: mono,
                        fontSize: 13,
                        lineHeight: 20,
                      }}
                    >
                      {page.output}
                    </Text>
                  </ScrollView>
                </ScrollView>
              ) : (
                <BodyText muted>No output at this position</BodyText>
              )}
              <Row>
                <Button
                  title="Start over"
                  compact
                  disabled={outputBusy || page.start === 0}
                  onPress={() => {
                    void loadOutput(selectedID);
                  }}
                />
                <Button
                  title="Next output"
                  compact
                  disabled={outputBusy || page.cursor >= page.size}
                  onPress={() => {
                    void loadOutput(selectedID, page.cursor);
                  }}
                />
                <Button
                  title="Refresh output"
                  compact
                  busy={outputBusy}
                  onPress={() => {
                    void loadOutput(selectedID, page.start);
                  }}
                />
              </Row>
            </>
          )}
          {selected && selected.metadata.sessionID !== sessionID && (
            <BodyText muted>
              This command belongs to another session. Open that session to stop
              it or remove its output.
            </BodyText>
          )}
          {selected &&
            selected.id === selectedID &&
            selected.metadata.sessionID === sessionID && (
              <Button
                title={
                  selected.status === "running"
                    ? "Stop command and remove output"
                    : "Remove retained output"
                }
                variant="danger"
                busy={stopping}
                onPress={() => {
                  void remove();
                }}
              />
            )}
        </Card>
      )}
    </View>
  );
}
