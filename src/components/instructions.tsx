import type { InstructionEntryInfo } from "@opencode/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import { View } from "react-native";

import { errorMessage, errorMessageOrNull } from "../lib/client";
import type { Client } from "../lib/client";
import { sessionInstructionsOptions } from "../lib/queries/panels";
import { queryKeys } from "../lib/query-keys";
import { useServerScope } from "../lib/server-scope";
import { useUndoableRemoval } from "./snackbar";
import { Button, Busy, Card, ErrorNotice, Field, BodyText, Row } from "./ui";

const NO_ENTRIES: InstructionEntryInfo[] = [];

export const Instructions = ({
  client,
  sessionID,
}: {
  client: Client;
  sessionID: string;
}) => {
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const query = useQuery(sessionInstructionsOptions(scope, client, sessionID));
  const entries = query.data ?? NO_ENTRIES;
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [json, setJson] = useState(false);
  const [actionError, setActionError] = useState<string>();
  const { hidden, remove: removeEntry } = useUndoableRemoval("instructions");
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.session.instructions(scope, sessionID),
    });
  const save = useMutation({
    mutationFn: async () => {
      if (!key.trim()) {
        throw new Error("Enter an instruction name");
      }
      const parsed = json ? JSON.parse(value) : value;
      await client.experimental.session.instructions.entry.put({
        key: key.trim(),
        sessionID,
        value: parsed,
      });
    },
    onError: (reason) => setActionError(errorMessage(reason)),
    onSuccess: () => {
      setKey("");
      setValue("");
      setJson(false);
      return invalidate();
    },
  });
  const removeInstruction = useMutation({
    mutationFn: (entryKey: string) =>
      client.experimental.session.instructions.entry.remove({
        key: entryKey,
        sessionID,
      }),
    onSuccess: invalidate,
  });
  const busy = save.isPending;
  const loading = query.isFetching;
  const error = actionError ?? errorMessageOrNull(query.error);
  const { refetch } = query;
  const refresh = () => {
    setActionError(undefined);
    void refetch();
  };
  const visibleEntries = entries.filter((entry) => !hidden.has(entry.key));

  return (
    <View style={{ gap: 14 }}>
      <BodyText muted>
        These instructions stay with this session through compaction and
        reverts. Changes reach the agent at its next step.
      </BodyText>
      <BodyText muted>
        This feature needs the experimental instruction API on the server.
      </BodyText>
      <Button
        title="Refresh instructions"
        size="compact"
        disabled={busy || loading}
        onPress={refresh}
      />
      <ErrorNotice error={error} onRetry={refresh} />
      {loading && <Busy />}
      {!loading && !error && visibleEntries.length === 0 && (
        <BodyText muted>No saved instruction entries</BodyText>
      )}
      {visibleEntries.map((entry) => (
        <Card key={entry.key}>
          <BodyText style={{ fontWeight: "600" }}>{entry.key}</BodyText>
          <BodyText selectable>
            {typeof entry.value === "string"
              ? entry.value
              : JSON.stringify(entry.value, null, 2)}
          </BodyText>
          <Row>
            <Button
              title="Edit"
              size="compact"
              disabled={busy}
              onPress={() => {
                setKey(entry.key);
                setValue(
                  typeof entry.value === "string"
                    ? entry.value
                    : JSON.stringify(entry.value, null, 2)
                );
                setJson(typeof entry.value !== "string");
              }}
            />
            <Button
              title="Delete"
              size="compact"
              variant="danger"
              disabled={busy}
              onPress={() => {
                removeEntry(entry.key, {
                  commit: () => removeInstruction.mutateAsync(entry.key),
                  message: "Instruction deleted",
                });
              }}
            />
          </Row>
        </Card>
      ))}
      <Card>
        <BodyText style={{ fontWeight: "600" }}>
          {entries.some((entry) => entry.key === key.trim())
            ? "Update instruction"
            : "Add instruction"}
        </BodyText>
        <Field
          label="Instruction name"
          value={key}
          onChangeText={setKey}
          placeholder="project-guidance"
        />
        <Button
          title={json ? "Value format: JSON" : "Value format: text"}
          size="compact"
          onPress={() => setJson(!json)}
        />
        <Field
          label={json ? "JSON value" : "Instruction text"}
          multiline
          value={value}
          onChangeText={setValue}
        />
        <Button
          title="Save instruction"
          variant="primary"
          busy={busy}
          disabled={!key.trim() || (!json && !value.trim())}
          onPress={() => {
            setActionError(undefined);
            save.mutate();
          }}
        />
      </Card>
    </View>
  );
};
