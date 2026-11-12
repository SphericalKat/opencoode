import type { InstructionEntryInfo } from "@opencode/client";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import {
  Button,
  Busy,
  Card,
  ErrorNotice,
  Field,
  BodyText,
  Row,
  confirmAction,
} from "./ui";

const fetchInstructions = async (
  client: Client,
  sessionID: string,
  isCurrent: () => boolean,
  apply: {
    done: () => void;
    entries: (entries: InstructionEntryInfo[]) => void;
    error: (message: string) => void;
  }
) => {
  try {
    const result = await client.experimental.session.instructions.entry.list({
      sessionID,
    });
    if (isCurrent()) {
      apply.entries(result);
    }
  } catch (error_) {
    if (isCurrent()) {
      apply.error(errorMessage(error_));
    }
  }
  if (isCurrent()) {
    apply.done();
  }
};

export const Instructions = ({
  client,
  sessionID,
}: {
  client: Client;
  sessionID: string;
}) => {
  const [entries, setEntries] = useState<InstructionEntryInfo[]>([]);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [json, setJson] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const sequence = useRef(0);
  const mounted = useRef(true);
  const scope = useRef({ client, sessionID });
  useLayoutEffect(() => {
    if (
      scope.current.client !== client ||
      scope.current.sessionID !== sessionID
    ) {
      scope.current = { client, sessionID };
    }
  });
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sequence.current += 1;
    };
  }, []);

  const load = useCallback(async () => {
    sequence.current += 1;
    const request = sequence.current;
    await fetchInstructions(
      client,
      sessionID,
      () => mounted.current && request === sequence.current,
      { done: () => setLoading(false), entries: setEntries, error: setError }
    );
  }, [client, sessionID]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    await load();
  }, [load]);
  const [renderedScope, setRenderedScope] = useState({ client, sessionID });
  if (
    renderedScope.client !== client ||
    renderedScope.sessionID !== sessionID
  ) {
    setRenderedScope({ client, sessionID });
    setEntries([]);
    setKey("");
    setValue("");
    setJson(false);
    setLoading(true);
    setError(undefined);
  }
  useEffect(() => {
    void load();
    return () => {
      sequence.current += 1;
    };
  }, [load]);

  const run = async (operation: () => Promise<void>) => {
    if (busy) {
      return;
    }
    const owner = scope.current;
    setBusy(true);
    setError(undefined);
    try {
      await operation();
      if (owner === scope.current && mounted.current) {
        setKey("");
        setValue("");
        setJson(false);
        await refresh();
      }
    } catch (error_) {
      if (owner === scope.current && mounted.current) {
        setError(errorMessage(error_));
      }
    }
    if (mounted.current) {
      setBusy(false);
    }
  };

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
        compact
        disabled={busy || loading}
        onPress={() => {
          void refresh();
        }}
      />
      <ErrorNotice
        error={error}
        onRetry={() => {
          void refresh();
        }}
      />
      {loading && <Busy />}
      {!loading && !error && entries.length === 0 && (
        <BodyText muted>No saved instruction entries</BodyText>
      )}
      {entries.map((entry) => (
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
              compact
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
              compact
              variant="danger"
              disabled={busy}
              onPress={() => {
                void run(async () => {
                  const owner = scope.current;
                  if (
                    (await confirmAction(
                      "Delete instruction?",
                      `Remove the instruction named ${entry.key}?`
                    )) &&
                    owner === scope.current &&
                    mounted.current
                  ) {
                    await client.experimental.session.instructions.entry.remove(
                      { key: entry.key, sessionID }
                    );
                  }
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
          compact
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
            void run(async () => {
              if (!key.trim()) {
                throw new Error("Enter an instruction name");
              }
              const parsed = json ? JSON.parse(value) : value;
              await client.experimental.session.instructions.entry.put({
                key: key.trim(),
                sessionID,
                value: parsed,
              });
            });
          }}
        />
      </Card>
    </View>
  );
};
