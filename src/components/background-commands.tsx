import type { ShellListOutput } from "@opencode/client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { AppState, ScrollView, Text, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { objectKey } from "../lib/object-key";
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

const commandDirectoryFor = (
  id: string,
  initialShellID: string | undefined,
  initialDirectory: string | undefined,
  directory: string
): string =>
  id === initialShellID ? initialDirectory || directory : directory;

interface ListContext {
  client: Client;
  directory: string;
  sessionID: string;
  listRequest: RefObject<AbortController | undefined>;
  setLoading: (value: boolean) => void;
  setError: (value: string | undefined) => void;
  setCommands: (value: Command[]) => void;
}

const fetchCommands = async (
  {
    client,
    directory,
    sessionID,
    listRequest,
    setLoading,
    setError,
    setCommands,
  }: ListContext,
  quiet: boolean
): Promise<void> => {
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
};

interface OutputContext {
  client: Client;
  directory: string;
  sessionID: string;
  initialShellID?: string;
  initialDirectory?: string;
  outputRequest: RefObject<AbortController | undefined>;
  pageStart: RefObject<number>;
  setOutputBusy: (value: boolean) => void;
  setOutputError: (value: string | undefined) => void;
  setSelected: (value: Command | undefined) => void;
  setPage: (value: Output | undefined) => void;
}

const fetchOutput = async (
  {
    client,
    directory,
    sessionID,
    initialShellID,
    initialDirectory,
    outputRequest,
    pageStart,
    setOutputBusy,
    setOutputError,
    setSelected,
    setPage,
  }: OutputContext,
  id: string,
  start: number,
  quiet: boolean
): Promise<void> => {
  if (quiet && outputRequest.current && !outputRequest.current.signal.aborted) {
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
    const commandDirectory = commandDirectoryFor(
      id,
      initialShellID,
      initialDirectory,
      directory
    );
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
};

const ownsSelection = (
  selected: Command,
  selectedID: string,
  sessionID: string,
  stopping: boolean
): boolean =>
  selected.id === selectedID &&
  selected.metadata.sessionID === sessionID &&
  !stopping;

const confirmRemoval = (running: boolean) =>
  confirmAction(
    running ? "Stop this command?" : "Remove retained output?",
    running
      ? "The server will stop this command and remove its captured output."
      : "The server will delete the captured output for this command."
  );

interface RemoveContext {
  client: Client;
  directory: string;
  sessionID: string;
  initialShellID?: string;
  initialDirectory?: string;
  selectedID: string | undefined;
  selected: Command | undefined;
  stopping: boolean;
  generation: RefObject<number>;
  mounted: RefObject<boolean>;
  selectedRef: RefObject<string | undefined>;
  outputRequest: RefObject<AbortController | undefined>;
  setStopping: (value: boolean) => void;
  setOutputError: (value: string | undefined) => void;
  setSelectedID: (value: string | undefined) => void;
  setSelected: (value: Command | undefined) => void;
  setPage: (value: Output | undefined) => void;
  refresh: () => Promise<void>;
}

const removeCommand = async ({
  client,
  directory,
  sessionID,
  initialShellID,
  initialDirectory,
  selectedID,
  selected,
  stopping,
  generation,
  mounted,
  selectedRef,
  outputRequest,
  setStopping,
  setOutputError,
  setSelectedID,
  setSelected,
  setPage,
  refresh,
}: RemoveContext): Promise<void> => {
  if (
    !selectedID ||
    !selected ||
    !ownsSelection(selected, selectedID, sessionID, stopping)
  ) {
    return;
  }
  const id = selectedID;
  const owner = generation.current;
  const running = selected?.status === "running";
  if (!(await confirmRemoval(running))) {
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
    const commandDirectory = commandDirectoryFor(
      id,
      initialShellID,
      initialDirectory,
      directory
    );
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
};

interface SelectedCommandView {
  colors: ReturnType<typeof useTheme>["colors"];
  directory: string;
  sessionID: string;
  initialShellID?: string;
  initialDirectory?: string;
  selectedID: string;
  selected: Command | undefined;
  page: Output | undefined;
  outputBusy: boolean;
  outputError: string | undefined;
  stopping: boolean;
  loadOutput: (id: string, start?: number, quiet?: boolean) => Promise<void>;
  remove: () => Promise<void>;
}

const renderPage = (
  page: Output,
  { colors, outputBusy, selectedID, loadOutput }: SelectedCommandView
) => (
  <>
    <BodyText muted>
      Bytes {page.start.toLocaleString()}–{page.cursor.toLocaleString()} of{" "}
      {page.size.toLocaleString()}
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
);

const SelectedCommand = (view: SelectedCommandView) => {
  const {
    directory,
    sessionID,
    initialShellID,
    initialDirectory,
    selectedID,
    selected,
    page,
    outputBusy,
    outputError,
    stopping,
    loadOutput,
    remove,
  } = view;
  return (
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
      {page && renderPage(page, view)}
      {selected && selected.metadata.sessionID !== sessionID && (
        <BodyText muted>
          This command belongs to another session. Open that session to stop it
          or remove its output.
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
  );
};

const Commands = ({
  client,
  sessionID,
  directory,
  initialShellID,
  initialDirectory,
}: Props) => {
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
  const showLoading = loading && foreground;
  const showOutputBusy = outputBusy && foreground;
  const listRequest = useRef<AbortController | undefined>(undefined);
  const outputRequest = useRef<AbortController | undefined>(undefined);
  const generation = useRef(0);
  const mounted = useRef(true);
  const selectedRef = useRef(selectedID);
  const pageStart = useRef(0);
  const previousForeground = useRef(foreground);

  useEffect(() => {
    selectedRef.current = selectedID;
  }, [selectedID]);
  useEffect(() => {
    mounted.current = true;
    const generationCounter = generation;
    const listRequests = listRequest;
    const outputRequests = outputRequest;
    return () => {
      mounted.current = false;
      generationCounter.current += 1;
      listRequests.current?.abort();
      outputRequests.current?.abort();
    };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => subscription.remove();
  }, []);

  const refresh = useCallback(
    (quiet = false) =>
      fetchCommands(
        {
          client,
          directory,
          listRequest,
          sessionID,
          setCommands,
          setError,
          setLoading,
        },
        quiet
      ),
    [client, directory, sessionID]
  );

  const loadOutput = useCallback(
    (id: string, start = 0, quiet = false) =>
      fetchOutput(
        {
          client,
          directory,
          initialDirectory,
          initialShellID,
          outputRequest,
          pageStart,
          sessionID,
          setOutputBusy,
          setOutputError,
          setPage,
          setSelected,
        },
        id,
        start,
        quiet
      ),
    [client, directory, sessionID, initialShellID, initialDirectory]
  );

  useEffect(() => {
    const resumed = foreground && !previousForeground.current;
    previousForeground.current = foreground;
    if (!foreground) {
      listRequest.current?.abort();
      outputRequest.current?.abort();
      return;
    }
    void refresh();
    if (resumed && selectedRef.current) {
      void loadOutput(selectedRef.current, pageStart.current);
    }
    const timer = setInterval(() => {
      void refresh(true);
    }, 3000);
    const listRequests = listRequest;
    return () => {
      clearInterval(timer);
      listRequests.current?.abort();
    };
  }, [foreground, refresh, loadOutput]);
  const [seenSelectedID, setSeenSelectedID] = useState(selectedID);
  if (seenSelectedID !== selectedID) {
    setSeenSelectedID(selectedID);
    setSelected(undefined);
    setPage(undefined);
    setOutputError(undefined);
  }
  useEffect(() => {
    pageStart.current = 0;
    if (selectedID && previousForeground.current) {
      void loadOutput(selectedID);
    }
    const outputRequests = outputRequest;
    return () => outputRequests.current?.abort();
  }, [selectedID, loadOutput]);
  const selectedStatus = selected?.status;
  const outputStart = page?.start;
  const outputCursor = page?.cursor;
  const outputSize = page?.size;
  useEffect(() => {
    if (
      !foreground ||
      !selectedID ||
      selectedStatus !== "running" ||
      (outputCursor !== undefined &&
        outputSize !== undefined &&
        outputCursor < outputSize)
    ) {
      return;
    }
    const timer = setInterval(() => {
      void loadOutput(selectedID, outputStart ?? 0, true);
    }, 3000);
    return () => clearInterval(timer);
  }, [
    foreground,
    selectedID,
    selectedStatus,
    outputStart,
    outputCursor,
    outputSize,
    loadOutput,
  ]);

  const remove = () =>
    removeCommand({
      client,
      directory,
      generation,
      initialDirectory,
      initialShellID,
      mounted,
      outputRequest,
      refresh,
      selected,
      selectedID,
      selectedRef,
      sessionID,
      setOutputError,
      setPage,
      setSelected,
      setSelectedID,
      setStopping,
      stopping,
    });

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
          busy={showLoading}
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
      {showLoading && !commands.length && <Busy />}
      {!showLoading && !error && !commands.length && (
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
        <SelectedCommand
          colors={colors}
          directory={directory}
          initialDirectory={initialDirectory}
          initialShellID={initialShellID}
          loadOutput={loadOutput}
          outputBusy={showOutputBusy}
          outputError={outputError}
          page={page}
          remove={remove}
          selected={selected}
          selectedID={selectedID}
          sessionID={sessionID}
          stopping={stopping}
        />
      )}
    </View>
  );
};

export const BackgroundCommands = (props: Props) => (
  <Commands
    key={JSON.stringify([
      objectKey(props.client),
      props.sessionID,
      props.directory,
      props.initialShellID,
      props.initialDirectory,
    ])}
    {...props}
  />
);
