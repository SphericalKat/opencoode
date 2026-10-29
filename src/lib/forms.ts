import type { FormField } from '@opencode/client';

export type FormValues = Record<string, string | number | boolean | string[] | undefined>;
export type FormAnswer = Record<string, string | number | boolean | string[]>;

export function initialFormValues(fields: readonly FormField[]): FormValues {
  return Object.fromEntries(fields.flatMap(field => field.type !== 'external' && field.default !== undefined ? [[field.key, field.default]] : []));
}

export function isFieldActive(field: FormField, answer: FormValues): boolean {
  return field.type === 'external' || !field.when || field.when.every(condition => {
    const value = answer[condition.key];
    if (value === undefined) return false;
    const equal = Array.isArray(value) ? value.some(item => item === condition.value) : value === condition.value;
    return condition.op === 'eq' ? equal : !equal;
  });
}

export function prepareFormAnswer(fields: readonly FormField[], values: FormValues): { answer: FormAnswer; errors: Record<string, string> } {
  const answer: FormAnswer = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (field.type === 'external') {
      if (values[field.key] !== true) errors[field.key] = 'Confirm that you completed this step';
      else answer[field.key] = true;
      continue;
    }
    if (!isFieldActive(field, answer)) continue;
    const value = Object.prototype.hasOwnProperty.call(values, field.key) ? values[field.key] : field.default;
    if (value === undefined || ((field.type === 'number' || field.type === 'integer') && value === '')) {
      if (field.required) errors[field.key] = 'Enter a value';
      continue;
    }
    if (field.required && (value === '' || (Array.isArray(value) && value.length === 0))) {
      errors[field.key] = 'Enter a value';
      continue;
    }
    if (field.type === 'boolean') {
      if (typeof value !== 'boolean') errors[field.key] = 'Choose Yes or No';
      else answer[field.key] = value;
      continue;
    }
    if (field.type === 'integer' || field.type === 'number') {
      const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
      if (!Number.isFinite(number) || (field.type === 'integer' && !Number.isInteger(number))) errors[field.key] = field.type === 'integer' ? 'Enter a whole number' : 'Enter a number';
      else if (field.minimum !== undefined && number < Number(field.minimum)) errors[field.key] = `Enter ${field.minimum} or more`;
      else if (field.maximum !== undefined && number > Number(field.maximum)) errors[field.key] = `Enter ${field.maximum} or less`;
      else answer[field.key] = number;
      continue;
    }
    if (field.type === 'multiselect') {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) errors[field.key] = 'Choose valid options';
      else if (new Set(value).size !== value.length) errors[field.key] = 'Choose each option once';
      else if (!field.custom && value.some(item => !field.options.some(option => option.value === item))) errors[field.key] = 'Choose an option from the list';
      else if (field.minItems !== undefined && value.length < field.minItems) errors[field.key] = `Choose at least ${field.minItems} options`;
      else if (field.maxItems !== undefined && value.length > field.maxItems) errors[field.key] = `Choose no more than ${field.maxItems} options`;
      else answer[field.key] = value;
      continue;
    }
    if (typeof value !== 'string') { errors[field.key] = 'Enter text'; continue; }
    if (field.options && !field.custom && !field.options.some(option => option.value === value)) errors[field.key] = 'Choose an option from the list';
    else if (field.minLength !== undefined && value.length < field.minLength) errors[field.key] = `Enter at least ${field.minLength} characters`;
    else if (field.maxLength !== undefined && value.length > field.maxLength) errors[field.key] = `Enter no more than ${field.maxLength} characters`;
    else if (field.pattern && !matchesPattern(value, field.pattern)) errors[field.key] = 'Enter text in the required format';
    else if (field.format && !matchesFormat(value, field.format)) errors[field.key] = `Enter a valid ${field.format}`;
    else answer[field.key] = value;
  }
  return { answer, errors };
}

function matchesPattern(value: string, pattern: string): boolean {
  try { return new RegExp(pattern).test(value); } catch { return false; }
}

function matchesFormat(value: string, format: 'email' | 'uri' | 'date' | 'date-time'): boolean {
  if (format === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  if (format === 'uri') { try { return !!new URL(value).protocol; } catch { return false; } }
  if (format === 'date') return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return Number.isFinite(Date.parse(value));
}
