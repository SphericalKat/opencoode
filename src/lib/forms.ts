import type { FormField } from "@opencode/client";

export type FormValues = Record<
  string,
  string | number | boolean | string[] | undefined
>;
export type FormAnswer = Record<string, string | number | boolean | string[]>;

type FormValue = FormAnswer[string];
type FieldOutcome = { error: string } | { value: FormValue } | undefined;
type NumericField = Extract<FormField, { type: "number" | "integer" }>;
type MultiselectField = Extract<FormField, { type: "multiselect" }>;
type TextField = Exclude<
  FormField,
  { type: "number" | "integer" | "boolean" | "multiselect" | "external" }
>;

const matchesPattern = (value: string, pattern: string): boolean => {
  try {
    return new RegExp(pattern, "u").test(value);
  } catch {
    return false;
  }
};

const matchesFormat = (
  value: string,
  format: "email" | "uri" | "date" | "date-time"
): boolean => {
  if (format === "email") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
  }
  if (format === "uri") {
    try {
      return !!new URL(value).protocol;
    } catch {
      return false;
    }
  }
  if (format === "date") {
    return (
      /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value
    );
  }
  return Number.isFinite(Date.parse(value));
};

export const initialFormValues = (fields: readonly FormField[]): FormValues =>
  Object.fromEntries(
    fields.flatMap((field) =>
      field.type !== "external" && field.default !== undefined
        ? [[field.key, field.default]]
        : []
    )
  );

export const isFieldActive = (field: FormField, answer: FormValues): boolean =>
  field.type === "external" ||
  !field.when ||
  field.when.every((condition) => {
    const value = answer[condition.key];
    if (value === undefined) {
      return false;
    }
    const equal = Array.isArray(value)
      ? value.some((item) => item === condition.value)
      : value === condition.value;
    return condition.op === "eq" ? equal : !equal;
  });

const toNumber = (value: FormValue): number => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    return Number(value);
  }
  return Number.NaN;
};

const validateNumber = (
  field: NumericField,
  value: FormValue
): FieldOutcome => {
  const number = toNumber(value);
  if (
    !Number.isFinite(number) ||
    (field.type === "integer" && !Number.isInteger(number))
  ) {
    return {
      error:
        field.type === "integer" ? "Enter a whole number" : "Enter a number",
    };
  }
  if (field.minimum !== undefined && number < Number(field.minimum)) {
    return { error: `Enter ${field.minimum} or more` };
  }
  if (field.maximum !== undefined && number > Number(field.maximum)) {
    return { error: `Enter ${field.maximum} or less` };
  }
  return { value: number };
};

const validateMultiselect = (
  field: MultiselectField,
  value: FormValue
): FieldOutcome => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return { error: "Choose valid options" };
  }
  if (new Set(value).size !== value.length) {
    return { error: "Choose each option once" };
  }
  if (
    !field.custom &&
    value.some((item) => !field.options.some((option) => option.value === item))
  ) {
    return { error: "Choose an option from the list" };
  }
  if (field.minItems !== undefined && value.length < field.minItems) {
    return { error: `Choose at least ${field.minItems} options` };
  }
  if (field.maxItems !== undefined && value.length > field.maxItems) {
    return { error: `Choose no more than ${field.maxItems} options` };
  }
  return { value };
};

const validateText = (field: TextField, value: FormValue): FieldOutcome => {
  if (typeof value !== "string") {
    return { error: "Enter text" };
  }
  if (
    field.options &&
    !field.custom &&
    !field.options.some((option) => option.value === value)
  ) {
    return { error: "Choose an option from the list" };
  }
  if (field.minLength !== undefined && value.length < field.minLength) {
    return { error: `Enter at least ${field.minLength} characters` };
  }
  if (field.maxLength !== undefined && value.length > field.maxLength) {
    return { error: `Enter no more than ${field.maxLength} characters` };
  }
  if (field.pattern && !matchesPattern(value, field.pattern)) {
    return { error: "Enter text in the required format" };
  }
  if (field.format && !matchesFormat(value, field.format)) {
    return { error: `Enter a valid ${field.format}` };
  }
  return { value };
};

const validateField = (
  field: FormField,
  values: FormValues,
  answer: FormAnswer
): FieldOutcome => {
  if (field.type === "external") {
    return values[field.key] === true
      ? { value: true }
      : { error: "Confirm that you completed this step" };
  }
  if (!isFieldActive(field, answer)) {
    return undefined;
  }
  const value = Object.hasOwn(values, field.key)
    ? values[field.key]
    : field.default;
  if (
    value === undefined ||
    ((field.type === "number" || field.type === "integer") && value === "")
  ) {
    return field.required ? { error: "Enter a value" } : undefined;
  }
  if (
    field.required &&
    (value === "" || (Array.isArray(value) && value.length === 0))
  ) {
    return { error: "Enter a value" };
  }
  if (field.type === "boolean") {
    return typeof value === "boolean"
      ? { value }
      : { error: "Choose Yes or No" };
  }
  if (field.type === "integer" || field.type === "number") {
    return validateNumber(field, value);
  }
  if (field.type === "multiselect") {
    return validateMultiselect(field, value);
  }
  return validateText(field, value);
};

export const prepareFormAnswer = (
  fields: readonly FormField[],
  values: FormValues
): { answer: FormAnswer; errors: Record<string, string> } => {
  const answer: FormAnswer = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const outcome = validateField(field, values, answer);
    if (outcome === undefined) {
      continue;
    }
    if ("error" in outcome) {
      errors[field.key] = outcome.error;
    } else {
      answer[field.key] = outcome.value;
    }
  }
  return { answer, errors };
};
