import type { ShellListOutput } from "@opencode/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { withCleanup } from "../lib/async";
import { errorMessage, errorMessageOrNull } from "../lib/client";
import type { Client } from "../lib/client";
import { objectKey } from "../lib/object-key";
import { shellListOptions, shellOutputOptions } from "../lib/queries/panels";
import { queryKeys } from "../lib/query-keys";
import { useServerScope } from "../lib/server-scope";
import { useTheme } from "../lib/theme";
import { useForeground } from "../stores/app-lifecycle-store";
import { confirmAction } from "./dialog";
import { SheetGroup, SheetRow } from "./list-sheet";
import {
  Button,
  Busy,
  Card,
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

const commandDirectoryFor = (
  id: string,
  initialShellID: string | undefined,
  initialDirectory: string | undefined,
  directory: string
): string =>
  id === initialShellID ? initialDirectory || directory : directory;

const confirmRemoval = (running: boolean) =>
  confirmAction(
    running ? "Stop this command?" : "Remove retained output?",
    running
      ? "The server will stop this command and remove its captured output."
      : "The server will delete the captured output for this command.",
    { confirmLabel: running ? "Stop" : "Remove" }
  );

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
  outputError: string | null | undefined;
  stopping: boolean;
  goToOutput: (start: number) => void;
  refreshOutput: () => void;
  remove: () => void;
}

const renderPage = (
  page: Output,
  { colors, outputBusy, goToOutput, refreshOutput }: SelectedCommandView
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
        size="compact"
        disabled={outputBusy || page.start === 0}
        onPress={() => goToOutput(0)}
      />
      <Button
        title="Next output"
        size="compact"
        disabled={outputBusy || page.cursor >= page.size}
        onPress={() => goToOutput(page.cursor)}
      />
      <Button
        title="Refresh output"
        size="compact"
        busy={outputBusy}
        onPress={refreshOutput}
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
    refreshOutput,
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
      <ErrorNotice error={outputError} onRetry={refreshOutput} />
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
            onPress={remove}
          />
        )}
    </Card>
  );
};

const ownsSelection = (
  selected: Command | undefined,
  selectedID: string,
  sessionID: string
): selected is Command =>
  selected?.id === selectedID && selected.metadata.sessionID === sessionID;

const selectedOutput = (
  selectedID: string | undefined,
  data: { command: Command; page: Output } | undefined
) => (selectedID ? { command: data?.command, page: data?.page } : {});

interface RemoveCommandOptions {
  client: Client;
  commandDirectory: string;
  directory: string;
  initialDirectory?: string;
  initialShellID?: string;
  onError: (reason: unknown) => void;
  onRemoved: () => void;
}

const useRemoveCommand = ({
  client,
  commandDirectory,
  directory,
  initialDirectory,
  initialShellID,
  onError,
  onRemoved,
}: RemoveCommandOptions) => {
  const scope = useServerScope();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      client.shell.remove({
        id,
        location: {
          directory: commandDirectoryFor(
            id,
            initialShellID,
            initialDirectory,
            directory
          ),
        },
      }),
    onError,
    onSuccess: async (_result, id) => {
      onRemoved();
      queryClient.removeQueries({
        queryKey: queryKeys.dir.shellOutput(scope, commandDirectory, id),
      });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.dir.shells(scope, directory),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.dir.pty(scope, directory),
        }),
      ]);
    },
  });
};

interface CommandListProps {
  commands: Command[];
  disabled: boolean;
  limit: number;
  onLoadMore: () => void;
  onSelect: (id: string) => void;
  selectedID: string | undefined;
}

const CommandList = ({
  commands,
  disabled,
  limit,
  onLoadMore,
  onSelect,
  selectedID,
}: CommandListProps) => (
  <>
    {commands.length > 0 && (
      <SheetGroup>
        {commands.slice(0, limit).map((command) => (
          <SheetRow
            key={command.id}
            label={command.command}
            description={command.cwd}
            checked={selectedID === command.id}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`View output: ${command.command}`}
            onPress={() => onSelect(command.id)}
          />
        ))}
      </SheetGroup>
    )}
    {commands.length > limit && (
      <Button title="Load more commands" size="compact" onPress={onLoadMore} />
    )}
  </>
);

const NO_COMMANDS: Command[] = [];

const Commands = ({
  client,
  sessionID,
  directory,
  initialShellID,
  initialDirectory,
}: Props) => {
  const { colors } = useTheme();
  const scope = useServerScope();
  const foreground = useForeground();
  const [limit, setLimit] = useState(20);
  const [selectedID, setSelectedID] = useState<string | undefined>(
    initialShellID
  );
  const [outputStart, setOutputStart] = useState(0);
  const [manualBusy, setManualBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string>();
  const commandDirectory = selectedID
    ? commandDirectoryFor(
        selectedID,
        initialShellID,
        initialDirectory,
        directory
      )
    : directory;
  const shells = useQuery({
    ...shellListOptions(scope, client, directory, foreground),
    select: (all) =>
      all.filter((command) => command.metadata.sessionID === sessionID),
  });
  const commands = shells.data ?? NO_COMMANDS;
  const output = useQuery(
    shellOutputOptions(
      scope,
      client,
      {
        allowOtherSession: selectedID === initialShellID,
        directory: commandDirectory,
        id: selectedID ?? "",
        sessionID,
        start: outputStart,
      },
      foreground && !!selectedID
    )
  );
  const { command: selected, page } = selectedOutput(selectedID, output.data);
  const removeCommand = useRemoveCommand({
    client,
    commandDirectory,
    directory,
    initialDirectory,
    initialShellID,
    onError: (reason) => setRemoveError(errorMessage(reason)),
    onRemoved: () => setSelectedID(undefined),
  });
  const stopping = removeCommand.isPending;
  const { refetch: refetchShells } = shells;
  const { refetch: refetchOutput } = output;
  const reload = async (includeOutput: boolean) => {
    setManualBusy(true);
    setRemoveError(undefined);
    await withCleanup(
      () =>
        Promise.all([
          refetchShells(),
          includeOutput ? refetchOutput() : undefined,
        ]),
      () => setManualBusy(false)
    );
  };
  const error = errorMessageOrNull(shells.error);
  const outputError = removeError ?? errorMessageOrNull(output.error);
  const showLoading = (shells.isPending || manualBusy) && foreground;
  const showOutputBusy = (output.isPending && !!selectedID) || manualBusy;
  const selectCommand = (id: string) => {
    setSelectedID(id);
    setOutputStart(0);
    setRemoveError(undefined);
  };
  const remove = async () => {
    if (
      !selectedID ||
      stopping ||
      !ownsSelection(selected, selectedID, sessionID)
    ) {
      return;
    }
    if (await confirmRemoval(selected.status === "running")) {
      setRemoveError(undefined);
      removeCommand.mutate(selectedID);
    }
  };

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
          size="compact"
          busy={showLoading}
          onPress={() => {
            void reload(!!selectedID);
          }}
        />
      </Row>
      <ErrorNotice
        error={error}
        onRetry={() => {
          void reload(false);
        }}
      />
      {showLoading && !commands.length && <Busy />}
      {!showLoading && !error && !commands.length && (
        <Empty
          title="No running commands"
          detail="Open a shell message's full output to inspect a completed command."
        />
      )}
      <CommandList
        commands={commands}
        disabled={stopping}
        limit={limit}
        onLoadMore={() => setLimit((value) => value + 20)}
        onSelect={selectCommand}
        selectedID={selectedID}
      />
      {selectedID && (
        <SelectedCommand
          colors={colors}
          directory={directory}
          initialDirectory={initialDirectory}
          initialShellID={initialShellID}
          goToOutput={setOutputStart}
          refreshOutput={() => {
            void reload(true);
          }}
          outputBusy={showOutputBusy}
          outputError={outputError}
          page={page}
          remove={() => {
            void remove();
          }}
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
