import type {
  IntegrationAttempt,
  IntegrationCommandAttempt,
  IntegrationInfo,
  IntegrationMethod,
} from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Linking } from "react-native";

import { SheetGroup, SheetRow } from "../../components/list-sheet";
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
import { errorMessage, errorMessageOrNull } from "../../lib/client";
import type { Client } from "../../lib/client";
import { initialFormValues, prepareFormAnswer } from "../../lib/forms";
import type { FormValues } from "../../lib/forms";
import { integrationAttemptOptions } from "../../lib/queries/settings";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import { externalURL } from "../../lib/settings";
import { useThemedStyles } from "../../lib/theme";
import { useForeground } from "../../stores/app-lifecycle-store";
import { useSettingsBusy, useSettingsMutation } from "./shared";
import { createStyles } from "./styles";

interface ConnectInput {
  answer: ReturnType<typeof prepareFormAnswer>["answer"];
  integrationID: string;
  label: string | undefined;
  location: { directory: string };
  method: Exclude<IntegrationMethod, { type: "env" }>;
}

type Attempt =
  | { kind: "oauth"; data: IntegrationAttempt }
  | { kind: "command"; data: IntegrationCommandAttempt };
const methodLabel = (item: IntegrationMethod) => {
  if (item.type === "env") {
    return `Server environment: ${item.names.join(", ")}`;
  }
  return item.label || (item.type === "key" ? "API key" : item.type);
};

interface ConnectHandlers {
  key: string;
  onClose: () => void;
  onKeyUsed: () => void;
  open: (url: string) => Promise<void>;
  setAttempt: (attempt: Attempt) => void;
}

const connectIntegration = async (
  client: Client,
  input: ConnectInput,
  handlers: ConnectHandlers
) => {
  const { method: chosen, ...request } = input;
  if (chosen.type === "key") {
    if (!handlers.key.trim()) {
      throw new Error("Enter an API key");
    }
    await client.integration.connect.key({
      ...request,
      key: handlers.key.trim(),
    });
    handlers.onKeyUsed();
    handlers.onClose();
  } else if (chosen.type === "external") {
    await client.integration.connect.external({
      ...request,
      methodID: chosen.id,
    });
    handlers.onClose();
  } else if (chosen.type === "oauth") {
    const result = await client.integration.oauth.connect({
      ...request,
      methodID: chosen.id,
    });
    handlers.setAttempt({ data: result.data, kind: "oauth" });
    await handlers.open(result.data.url);
  } else {
    const result = await client.integration.command.connect({
      ...request,
      methodID: chosen.id,
    });
    handlers.setAttempt({ data: result.data, kind: "command" });
  }
};

interface AttemptPanelProps {
  attempt: Attempt;
  busy: boolean;
  code: string;
  status: string;
  onCancel: () => void;
  onCheck: () => void;
  onCodeChange: (code: string) => void;
  onOpen: (url: string) => void;
  onSubmitCode: () => void;
}

const AttemptPanel = ({
  attempt,
  busy,
  code,
  status,
  onCancel,
  onCheck,
  onCodeChange,
  onOpen,
  onSubmitCode,
}: AttemptPanelProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <BodyText style={styles.name}>
        {status === "pending" ? "Complete the sign-in" : status}
      </BodyText>
      {attempt.kind === "oauth" && (
        <>
          <BodyText>{attempt.data.instructions}</BodyText>
          <Button
            title="Open sign-in page"
            onPress={() => onOpen(attempt.data.url)}
          />
          {attempt.data.mode === "code" && (
            <>
              <Field
                label="Authorization code"
                value={code}
                onChangeText={onCodeChange}
              />
              <Button
                title="Submit code"
                variant="primary"
                busy={busy}
                disabled={!code.trim()}
                onPress={onSubmitCode}
              />
            </>
          )}
        </>
      )}
      {attempt.kind === "command" && (
        <BodyText muted>
          Complete any browser or terminal steps on the server. This page checks
          the result automatically.
        </BodyText>
      )}
      <Button title="Check status" size="compact" onPress={onCheck} />
      <Button
        title="Cancel sign-in"
        variant="danger"
        busy={busy}
        onPress={onCancel}
      />
    </>
  );
};

interface MethodFieldsProps {
  busy: boolean;
  fieldErrors: Record<string, string>;
  keyValue: string;
  label: string;
  method: Exclude<IntegrationMethod, { type: "env" }>;
  values: FormValues;
  onContinue: () => void;
  onKeyChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onValuesChange: (values: FormValues) => void;
}

const MethodFields = ({
  busy,
  fieldErrors,
  keyValue,
  label,
  method,
  values,
  onContinue,
  onKeyChange,
  onLabelChange,
  onValuesChange,
}: MethodFieldsProps) => (
  <>
    <Field
      label="Account name (optional)"
      value={label}
      onChangeText={onLabelChange}
    />
    {method.type === "key" && (
      <Field
        label="API key"
        secureTextEntry
        value={keyValue}
        onChangeText={onKeyChange}
      />
    )}
    {"form" in method && (
      <DynamicFields
        fields={method.form ?? []}
        values={values}
        onChange={onValuesChange}
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
      onPress={onContinue}
    />
  </>
);

const useAttemptStatus = ({
  attempt,
  client,
  directory,
  integrationID,
  onClose,
}: {
  attempt: Attempt | undefined;
  client: Client;
  directory: string;
  integrationID: string;
  onClose: () => void;
}) => {
  const scope = useServerScope();
  const foreground = useForeground();
  const attemptStatus = useQuery(
    integrationAttemptOptions(
      scope,
      client,
      {
        attemptID: attempt?.data.attemptID ?? "",
        directory,
        integrationID,
        kind: attempt?.kind ?? "oauth",
      },
      !!attempt && foreground
    )
  );
  const status = attempt ? (attemptStatus.data?.status ?? "pending") : "";
  const failureMessage =
    attemptStatus.data?.status === "failed" ? attemptStatus.data.message : null;
  const statusError = errorMessageOrNull(attemptStatus.error);
  const { refetch: checkStatus } = attemptStatus;
  useEffect(() => {
    if (status === "complete") {
      onClose();
    }
  }, [status, onClose]);
  return { checkStatus, failureMessage, status, statusError };
};

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
  const [method, setMethod] = useState<IntegrationMethod>();
  const [values, setValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [code, setCode] = useState("");
  const [attempt, setAttempt] = useState<Attempt>();
  const [error, setError] = useState<string | null>(null);
  const scope = useServerScope();
  const busy = useSettingsBusy();
  const { checkStatus, failureMessage, status, statusError } = useAttemptStatus(
    { attempt, client, directory, integrationID: integration.id, onClose }
  );
  const open = async (url: string) => {
    try {
      await Linking.openURL(externalURL(url));
    } catch (error_) {
      setError(errorMessage(error_));
    }
  };
  const connectKeys = () => [
    queryKeys.credentials(scope),
    queryKeys.dir.settings(scope, directory, "integrations"),
    queryKeys.dir.catalog(scope, directory),
  ];
  const connect = useSettingsMutation({
    invalidate: connectKeys,
    mutationFn: (input: ConnectInput) =>
      connectIntegration(client, input, {
        key,
        onClose,
        onKeyUsed: () => setKey(""),
        open,
        setAttempt,
      }),
    onError: setError,
  });
  const completeCode = useSettingsMutation({
    invalidate: connectKeys,
    mutationFn: async (current: Attempt) => {
      await client.integration.oauth.complete({
        attemptID: current.data.attemptID,
        code: code.trim(),
        integrationID: integration.id,
        location: { directory },
      });
      await checkStatus();
    },
    onError: setError,
  });
  const cancelAttempt = useSettingsMutation({
    invalidate: () => [],
    mutationFn: async (current: Attempt) => {
      const input = {
        attemptID: current.data.attemptID,
        integrationID: integration.id,
        location: { directory },
      };
      await (current.kind === "oauth"
        ? client.integration.oauth.cancel(input)
        : client.integration.command.cancel(input));
      setAttempt(undefined);
    },
    onError: setError,
  });
  const start = () => {
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
    setError(null);
    connect.mutate({ ...input, method });
  };
  return (
    <Sheet visible title={`Connect ${integration.name}`} onClose={onClose}>
      <ErrorNotice error={error ?? failureMessage ?? statusError} />
      {!attempt && (
        <>
          <BodyText muted>
            Choose a connection method. Credentials stay on your OpenCode
            server.
          </BodyText>
          <SheetGroup>
            {integration.methods.map((item, index) => (
              <SheetRow
                key={index}
                label={methodLabel(item)}
                checked={method === item}
                accessibilityRole="radio"
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
          </SheetGroup>
          {method?.type === "env" && (
            <BodyText muted>
              Set these environment variables on the server, then restart
              OpenCode.
            </BodyText>
          )}
          {method && method.type !== "env" && (
            <MethodFields
              busy={busy}
              fieldErrors={fieldErrors}
              keyValue={key}
              label={label}
              method={method}
              values={values}
              onContinue={start}
              onKeyChange={setKey}
              onLabelChange={setLabel}
              onValuesChange={setValues}
            />
          )}
          {!integration.methods.length && (
            <Empty title="No connection methods" />
          )}
        </>
      )}
      {attempt && (
        <AttemptPanel
          attempt={attempt}
          busy={busy}
          code={code}
          status={status}
          onCancel={() => {
            setError(null);
            cancelAttempt.mutate(attempt);
          }}
          onCheck={() => {
            void checkStatus();
          }}
          onCodeChange={setCode}
          onOpen={(url) => {
            void open(url);
          }}
          onSubmitCode={() => {
            setError(null);
            completeCode.mutate(attempt);
          }}
        />
      )}
    </Sheet>
  );
};
