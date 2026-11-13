import type {
  IntegrationAttempt,
  IntegrationCommandAttempt,
  IntegrationInfo,
  IntegrationMethod,
} from "@opencode/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";

import { DynamicFields } from "../../components/session-forms";
import {
  Button,
  Card,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  mono,
  Sheet,
} from "../../components/ui";
import { errorMessage } from "../../lib/client";
import type { Client } from "../../lib/client";
import { initialFormValues, prepareFormAnswer } from "../../lib/forms";
import type { FormValues } from "../../lib/forms";
import { externalURL } from "../../lib/settings";
import { useThemedStyles } from "../../lib/theme";
import { createStyles } from "./styles";

type Attempt =
  | { kind: "oauth"; data: IntegrationAttempt }
  | { kind: "command"; data: IntegrationCommandAttempt };
export const ConnectIntegration = ({
  client,
  directory,
  integration,
  onClose,
}: {
  client: Client;
  directory: string;
  integration: IntegrationInfo;
  onClose: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  const [method, setMethod] = useState<IntegrationMethod>();
  const [values, setValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [code, setCode] = useState("");
  const [attempt, setAttempt] = useState<Attempt>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const statusRequest = useRef(false);
  useEffect(
    () => () => {
      active.current = false;
    },
    []
  );
  const check = useCallback(async () => {
    if (!attempt || statusRequest.current) {
      return;
    }
    statusRequest.current = true;
    try {
      const input = {
        attemptID: attempt.data.attemptID,
        integrationID: integration.id,
        location: { directory },
      };
      const result =
        attempt.kind === "oauth"
          ? await client.integration.oauth.status(input)
          : await client.integration.command.status(input);
      if (active.current) {
        setStatus(result.data.status);
        if (result.data.status === "failed") {
          setError(result.data.message);
        }
        if (result.data.status === "complete") {
          onClose();
        }
      }
    } catch (error_) {
      if (active.current) {
        setError(errorMessage(error_));
      }
    }
    statusRequest.current = false;
  }, [attempt, client, directory, integration.id, onClose]);
  useEffect(() => {
    if (!attempt || ["complete", "expired", "failed"].includes(status)) {
      return;
    }
    const first = setTimeout(() => {
      void check();
    }, 0);
    const timer = setInterval(() => {
      void check();
    }, 3000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [attempt, status, check]);
  const open = async (url: string) => {
    try {
      await Linking.openURL(externalURL(url));
    } catch (error_) {
      setError(errorMessage(error_));
    }
  };
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (error_) {
      if (active.current) {
        setError(errorMessage(error_));
      }
    }
    if (active.current) {
      setBusy(false);
    }
  };
  const start = async () => {
    if (!method || method.type === "env") {
      return;
    }
    const prepared = prepareFormAnswer(
      "form" in method ? (method.form ?? []) : [],
      values
    );
    setFieldErrors(prepared.errors);
    if (Object.keys(prepared.errors).length) {
      return;
    }
    const input = {
      answer: prepared.answer,
      integrationID: integration.id,
      label: label.trim() || undefined,
      location: { directory },
    };
    await run(async () => {
      if (method.type === "key") {
        if (!key.trim()) {
          throw new Error("Enter an API key");
        }
        await client.integration.connect.key({ ...input, key: key.trim() });
        setKey("");
        onClose();
      } else if (method.type === "external") {
        await client.integration.connect.external({
          ...input,
          methodID: method.id,
        });
        onClose();
      } else if (method.type === "oauth") {
        const result = await client.integration.oauth.connect({
          ...input,
          methodID: method.id,
        });
        setAttempt({ data: result.data, kind: "oauth" });
        setStatus("pending");
        await open(result.data.url);
      } else {
        const result = await client.integration.command.connect({
          ...input,
          methodID: method.id,
        });
        setAttempt({ data: result.data, kind: "command" });
        setStatus("pending");
      }
    });
  };
  return (
    <Sheet visible title={`Connect ${integration.name}`} onClose={onClose}>
      <ErrorNotice error={error} />
      {!attempt && (
        <>
          <BodyText muted>
            Choose a connection method. Credentials stay on your OpenCode
            server.
          </BodyText>
          {integration.methods.map((item, index) => (
            <Button
              key={index}
              title={
                item.type === "env"
                  ? `Server environment: ${item.names.join(", ")}`
                  : item.label || (item.type === "key" ? "API key" : item.type)
              }
              selected={method === item}
              variant={method === item ? "primary" : "secondary"}
              onPress={() => {
                setMethod(item);
                setError(null);
                setFieldErrors({});
                setValues(
                  initialFormValues("form" in item ? (item.form ?? []) : [])
                );
              }}
            />
          ))}
          {method?.type === "env" && (
            <BodyText muted>
              Set these environment variables on the server, then restart
              OpenCode.
            </BodyText>
          )}
          {method && method.type !== "env" && (
            <>
              <Field
                label="Account name (optional)"
                value={label}
                onChangeText={setLabel}
              />
              {method.type === "key" && (
                <Field
                  label="API key"
                  secureTextEntry
                  value={key}
                  onChangeText={setKey}
                />
              )}
              {"form" in method && (
                <DynamicFields
                  fields={method.form ?? []}
                  values={values}
                  onChange={setValues}
                  errors={fieldErrors}
                />
              )}
              {method.type === "command" && (
                <Card>
                  <BodyText muted>
                    This starts the sign-in command on your server.
                  </BodyText>
                  <BodyText style={{ fontFamily: mono }}>
                    {method.command.join(" ")}
                  </BodyText>
                </Card>
              )}
              <Button
                title="Continue"
                variant="primary"
                busy={busy}
                onPress={() => {
                  void start();
                }}
              />
            </>
          )}
          {!integration.methods.length && (
            <Empty title="No connection methods" />
          )}
        </>
      )}
      {attempt && (
        <>
          <BodyText style={styles.name}>
            {status === "pending" ? "Complete the sign-in" : status}
          </BodyText>
          {attempt.kind === "oauth" && (
            <>
              <BodyText>{attempt.data.instructions}</BodyText>
              <Button
                title="Open sign-in page"
                onPress={() => {
                  void open(attempt.data.url);
                }}
              />
              {attempt.data.mode === "code" && (
                <>
                  <Field
                    label="Authorization code"
                    value={code}
                    onChangeText={setCode}
                  />
                  <Button
                    title="Submit code"
                    variant="primary"
                    busy={busy}
                    disabled={!code.trim()}
                    onPress={() => {
                      void run(async () => {
                        await client.integration.oauth.complete({
                          attemptID: attempt.data.attemptID,
                          code: code.trim(),
                          integrationID: integration.id,
                          location: { directory },
                        });
                        await check();
                      });
                    }}
                  />
                </>
              )}
            </>
          )}
          {attempt.kind === "command" && (
            <BodyText muted>
              Complete any browser or terminal steps on the server. This page
              checks the result automatically.
            </BodyText>
          )}
          <Button
            title="Check status"
            compact
            onPress={() => {
              void check();
            }}
          />
          <Button
            title="Cancel sign-in"
            variant="danger"
            busy={busy}
            onPress={() => {
              void run(async () => {
                const input = {
                  attemptID: attempt.data.attemptID,
                  integrationID: integration.id,
                  location: { directory },
                };
                await (attempt.kind === "oauth"
                  ? client.integration.oauth.cancel(input)
                  : client.integration.command.cancel(input));
                setAttempt(undefined);
                setStatus("");
              });
            }}
          />
        </>
      )}
    </Sheet>
  );
};
