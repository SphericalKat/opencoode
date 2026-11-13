import type { FormField, FormInfo, PermissionRequest } from "@opencode/client";
import React, { useState } from "react";
import { Linking, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";

import type { Client } from "../lib/client";
import {
  initialFormValues,
  isFieldActive,
  prepareFormAnswer,
} from "../lib/forms";
import type { FormValues } from "../lib/forms";
import { playHaptic } from "../lib/haptics";
import { useTheme } from "../lib/theme";
import {
  Button,
  Card,
  ErrorNotice,
  Field,
  Heading,
  BodyText,
  Row,
  mono,
} from "./ui";

type FieldValue = FormValues[string];
type ExternalField = Extract<FormField, { type: "external" }>;
type BooleanField = Extract<FormField, { type: "boolean" }>;
type MultiselectField = Extract<FormField, { type: "multiselect" }>;
type StringField = Extract<FormField, { type: "string" }>;
type FieldOption = NonNullable<StringField["options"]>[number];

const noErrors: Record<string, string> = {};

const openExternalLink = async (
  url: string,
  setLinkError: (error: string | null) => void
) => {
  try {
    if (!/^[Hh][Tt][Tt][Pp][Ss]?:\/\//u.test(url)) {
      throw new Error("This link requires an HTTP or HTTPS address");
    }
    await Linking.openURL(url);
    setLinkError(null);
  } catch (error) {
    setLinkError(
      error instanceof Error ? error.message : "Cannot open this link"
    );
  }
};

const keyboardTypeFor = (field: FormField): KeyboardTypeOptions => {
  if (field.type !== "string") {
    return "numbers-and-punctuation";
  }
  return field.format === "email" ? "email-address" : "default";
};

export const DynamicFields = ({
  fields,
  values,
  onChange,
  errors = noErrors,
}: {
  fields: readonly FormField[];
  values: FormValues;
  onChange: (values: FormValues) => void;
  errors?: Record<string, string>;
}) => {
  const { colors } = useTheme();
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [linkError, setLinkError] = useState<string | null>(null);
  const current = prepareFormAnswer(fields, values).answer;
  const change = (key: string, value: FormValues[string]) =>
    onChange({ ...values, [key]: value });
  const open = (url: string) => openExternalLink(url, setLinkError);
  const renderExternal = (field: ExternalField, value: FieldValue) => (
    <>
      <BodyText muted style={{ fontFamily: mono, fontSize: 13 }}>
        {field.url}
      </BodyText>
      <Button
        title="Open link"
        onPress={() => {
          open(field.url);
        }}
      />
      <Button
        title={value === true ? "✓ Completed" : "I completed this step"}
        variant={value === true ? "primary" : "secondary"}
        onPress={() => change(field.key, value !== true)}
      />
    </>
  );
  const renderBoolean = (field: BooleanField, value: FieldValue) => (
    <Row>
      {[true, false].map((choice) => (
        <Button
          key={String(choice)}
          title={choice ? "Yes" : "No"}
          variant={value === choice ? "primary" : "secondary"}
          compact
          onPress={() => change(field.key, choice)}
        />
      ))}
      {!field.required && value !== undefined && (
        <Button
          title="Clear"
          compact
          variant="ghost"
          onPress={() => change(field.key, undefined)}
        />
      )}
    </Row>
  );
  const renderMultiselect = (field: MultiselectField, value: FieldValue) => (
    <>
      <Row>
        {field.options.map((option) => (
          <Button
            key={option.value}
            title={`${Array.isArray(value) && value.includes(option.value) ? "✓ " : ""}${option.label}`}
            variant={
              Array.isArray(value) && value.includes(option.value)
                ? "primary"
                : "secondary"
            }
            compact
            onPress={() =>
              change(
                field.key,
                Array.isArray(value) && value.includes(option.value)
                  ? value.filter((item) => item !== option.value)
                  : [...(Array.isArray(value) ? value : []), option.value]
              )
            }
          />
        ))}
      </Row>
      {field.custom && (
        <>
          <Row>
            {(Array.isArray(value) ? value : [])
              .filter(
                (item) => !field.options.some((option) => option.value === item)
              )
              .map((item) => (
                <Button
                  key={item}
                  title={`${item} ×`}
                  compact
                  onPress={() =>
                    change(
                      field.key,
                      Array.isArray(value)
                        ? value.filter((selected) => selected !== item)
                        : []
                    )
                  }
                />
              ))}
          </Row>
          <Field
            label={`Custom value for ${field.title || field.key}`}
            value={custom[field.key] || ""}
            onChangeText={(text) => setCustom({ ...custom, [field.key]: text })}
          />
          <Button
            title="Add custom value"
            compact
            disabled={!custom[field.key]?.trim()}
            onPress={() => {
              change(field.key, [
                ...new Set([
                  ...(Array.isArray(value) ? value : []),
                  custom[field.key].trim(),
                ]),
              ]);
              setCustom({ ...custom, [field.key]: "" });
            }}
          />
        </>
      )}
    </>
  );
  const renderOptions = (
    field: StringField,
    options: FieldOption[],
    value: FieldValue
  ) => (
    <>
      <Row>
        {options.map((option) => (
          <Button
            key={option.value}
            title={option.label}
            variant={value === option.value ? "primary" : "secondary"}
            compact
            onPress={() => change(field.key, option.value)}
          />
        ))}
      </Row>
      {field.custom && (
        <Field
          label={`Custom value for ${field.title || field.key}`}
          value={typeof value === "string" ? value : ""}
          onChangeText={(text) => change(field.key, text)}
        />
      )}
      {!field.required && value !== undefined && (
        <Button
          title="Clear selection"
          compact
          variant="ghost"
          onPress={() => change(field.key, undefined)}
        />
      )}
    </>
  );
  const renderInput = (field: FormField, value: FieldValue, label: string) => {
    if (field.type === "external") {
      return renderExternal(field, value);
    }
    if (field.type === "boolean") {
      return renderBoolean(field, value);
    }
    if (field.type === "multiselect") {
      return renderMultiselect(field, value);
    }
    if (field.type === "string" && field.options) {
      return renderOptions(field, field.options, value);
    }
    return (
      <Field
        accessibilityLabel={label}
        value={value === undefined ? "" : String(value)}
        placeholder={field.type === "string" ? field.placeholder : undefined}
        keyboardType={keyboardTypeFor(field)}
        onChangeText={(text) => change(field.key, text)}
      />
    );
  };
  return (
    <View style={{ gap: 18 }}>
      <ErrorNotice error={linkError} />
      {fields.map((field) => {
        if (
          field.type !== "external" &&
          (field.hidden || !isFieldActive(field, current))
        ) {
          return null;
        }
        const label = `${field.title || field.key}${field.type !== "external" && field.required ? " *" : ""}`;
        const value = values[field.key];
        return (
          <View key={field.key} style={{ gap: 8 }}>
            <BodyText style={{ fontWeight: "600" }}>{label}</BodyText>
            {field.description && (
              <BodyText muted>{field.description}</BodyText>
            )}
            {renderInput(field, value, label)}
            {errors[field.key] && (
              <BodyText style={{ color: colors.danger }}>
                {errors[field.key]}
              </BodyText>
            )}
          </View>
        );
      })}
    </View>
  );
};

const submitForm = async ({
  client,
  form,
  cancel,
  answer,
  locationDirectory,
  onChanged,
  onError,
  setBusy,
}: {
  client: Client;
  form: FormInfo;
  cancel: boolean;
  answer: ReturnType<typeof prepareFormAnswer>["answer"];
  locationDirectory?: string;
  onChanged: () => void;
  onError: (error: unknown) => void;
  setBusy: (busy: boolean) => void;
}) => {
  setBusy(true);
  try {
    const options = locationDirectory
      ? {
          headers: {
            "x-opencode-directory": encodeURIComponent(locationDirectory),
          },
        }
      : undefined;
    await (cancel
      ? client.session.form.cancel(
          { formID: form.id, sessionID: form.sessionID },
          options
        )
      : client.session.form.reply(
          {
            answer,
            formID: form.id,
            sessionID: form.sessionID,
          },
          options
        ));
    onChanged();
  } catch (error) {
    onError(error);
  } finally {
    setBusy(false);
  }
};

const PendingForm = ({
  client,
  form,
  onChanged,
  onError,
  locationDirectory,
}: {
  client: Client;
  form: FormInfo;
  onChanged: () => void;
  onError: (error: unknown) => void;
  locationDirectory?: string;
}) => {
  const { colors } = useTheme();
  const [values, setValues] = useState<FormValues>(() =>
    initialFormValues(form.fields)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const run = async (cancel: boolean) => {
    const prepared = prepareFormAnswer(form.fields, values);
    if (!cancel && Object.keys(prepared.errors).length) {
      setErrors(prepared.errors);
      return;
    }
    await submitForm({
      answer: prepared.answer,
      cancel,
      client,
      form,
      locationDirectory,
      onChanged,
      onError,
      setBusy,
    });
  };
  return (
    <Card style={{ borderColor: colors.blue }}>
      <Heading>{form.title}</Heading>
      <DynamicFields
        fields={form.fields}
        values={values}
        onChange={setValues}
        errors={errors}
      />
      {Object.keys(errors).some((key) => {
        const field = form.fields.find((item) => item.key === key);
        return field && field.type !== "external" && field.hidden;
      }) && (
        <ErrorNotice error="A hidden field requires a valid default. Check the server configuration." />
      )}
      <Row>
        <Button
          title="Submit answers"
          variant="primary"
          disabled={busy}
          onPress={() => {
            run(false);
          }}
        />
        <Button
          title="Dismiss"
          disabled={busy}
          onPress={() => {
            run(true);
          }}
        />
      </Row>
    </Card>
  );
};

const replyToPermission = async ({
  client,
  decision,
  message,
  permission,
  sessionID,
  onChanged,
  onError,
  setBusy,
}: {
  client: Client;
  decision: "once" | "always" | "reject";
  message: string;
  permission: PermissionRequest;
  sessionID: string;
  onChanged: () => void;
  onError: (error: unknown) => void;
  setBusy: (busy: boolean) => void;
}) => {
  setBusy(true);
  try {
    await client.permission.reply({
      decision,
      message: message.trim() || undefined,
      requestID: permission.id,
      sessionID,
    });
    onChanged();
  } catch (error) {
    onError(error);
  } finally {
    setBusy(false);
  }
};

const PendingPermission = ({
  client,
  sessionID,
  permission,
  onChanged,
  onError,
}: {
  client: Client;
  sessionID: string;
  permission: PermissionRequest;
  onChanged: () => void;
  onError: (error: unknown) => void;
}) => {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const reply = (decision: "once" | "always" | "reject") => {
    playHaptic(decision === "reject" ? "failure" : "success");
    return replyToPermission({
      client,
      decision,
      message,
      onChanged,
      onError,
      permission,
      sessionID,
      setBusy,
    });
  };
  return (
    <Card style={{ borderColor: colors.success }}>
      <BodyText style={{ color: colors.success, fontWeight: "600" }}>
        Permission required
      </BodyText>
      <Heading>{permission.action}</Heading>
      {permission.message && <BodyText>{permission.message}</BodyText>}
      {permission.resources.map((resource, index) => (
        <BodyText
          key={`${index}-${resource}`}
          style={{ fontFamily: mono, fontSize: 13 }}
        >
          {resource}
        </BodyText>
      ))}
      <Field
        label="Reply message (optional)"
        value={message}
        onChangeText={setMessage}
      />
      <Row>
        <Button
          title="Allow once"
          variant="primary"
          disabled={busy}
          onPress={() => {
            reply("once");
          }}
        />
        {permission.save && permission.save.length > 0 && (
          <Button
            title="Always allow"
            disabled={busy}
            onPress={() => {
              reply("always");
            }}
          />
        )}
        <Button
          title="Reject"
          variant="danger"
          disabled={busy}
          onPress={() => {
            reply("reject");
          }}
        />
      </Row>
      {permission.save && permission.save.length > 0 && (
        <BodyText muted>
          Always allow saves permission for: {permission.save.join(", ")}
        </BodyText>
      )}
    </Card>
  );
};

export const SessionForms = ({
  client,
  sessionID,
  forms,
  permissions,
  onChanged,
  onError,
  locationDirectory,
}: {
  client: Client;
  sessionID: string;
  forms: FormInfo[];
  permissions: PermissionRequest[];
  onChanged: () => void;
  onError: (error: unknown) => void;
  locationDirectory?: string;
}) => {
  if (!forms.length && !permissions.length) {
    return null;
  }
  return (
    <View style={{ gap: 12 }}>
      {permissions
        .filter((permission) => permission.sessionID === sessionID)
        .map((permission) => (
          <PendingPermission
            key={permission.id}
            client={client}
            sessionID={sessionID}
            permission={permission}
            onChanged={onChanged}
            onError={onError}
          />
        ))}
      {forms
        .filter(
          (form) => form.sessionID === sessionID || form.sessionID === "global"
        )
        .map((form) => (
          <PendingForm
            key={form.id}
            client={client}
            form={form}
            onChanged={onChanged}
            onError={onError}
            locationDirectory={locationDirectory}
          />
        ))}
    </View>
  );
};
