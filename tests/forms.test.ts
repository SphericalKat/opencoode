import assert from 'node:assert/strict';
import test from 'node:test';
import type { FormField } from '@opencode/client';
import { initialFormValues, prepareFormAnswer } from '../src/lib/forms';

test('forms omit inactive stale answers and resolve later conditions from active parsed answers', () => {
  const fields: FormField[] = [
    { key: 'count', type: 'integer' },
    { key: 'extra', type: 'string', required: true, when: [{ key: 'count', op: 'eq', value: 2 }] },
    { key: 'nested', type: 'string', required: true, when: [{ key: 'extra', op: 'neq', value: 'skip' }] },
  ];
  assert.deepEqual(prepareFormAnswer(fields, { count: '1', extra: 'stale', nested: 'stale' }), { answer: { count: 1 }, errors: {} });
  assert.deepEqual(prepareFormAnswer(fields, { count: '2', extra: 'continue', nested: 'done' }), { answer: { count: 2, extra: 'continue', nested: 'done' }, errors: {} });
});

test('multiselect conditions require an answer and check membership', () => {
  const fields: FormField[] = [
    { key: 'choices', type: 'multiselect', options: [{ value: 'a', label: 'A' }] },
    { key: 'detail', type: 'string', required: true, when: [{ key: 'choices', op: 'eq', value: 'a' }] },
    { key: 'other', type: 'string', required: true, when: [{ key: 'choices', op: 'neq', value: 'a' }] },
  ];
  assert.deepEqual(prepareFormAnswer(fields, {}).errors, {});
  assert.deepEqual(prepareFormAnswer(fields, { choices: ['a'] }).errors, { detail: 'Enter a value' });
});

test('defaults include hidden values without replacing explicit false or zero', () => {
  const fields: FormField[] = [
    { key: 'region', type: 'string', hidden: true, default: 'us' },
    { key: 'enabled', type: 'boolean', default: true, required: true },
    { key: 'count', type: 'number', default: 5, required: true },
  ];
  assert.deepEqual(initialFormValues(fields), { region: 'us', enabled: true, count: 5 });
  assert.deepEqual(prepareFormAnswer(fields, { enabled: false, count: 0 }), { answer: { region: 'us', enabled: false, count: 0 }, errors: {} });
});

test('forms reject invalid numeric and restricted choice answers', () => {
  const fields: FormField[] = [
    { key: 'count', type: 'integer', minimum: 1, maximum: 3 },
    { key: 'choice', type: 'string', options: [{ value: 'allowed', label: 'Allowed' }] },
    { key: 'multiple', type: 'multiselect', maxItems: 1, custom: true, options: [] },
  ];
  const result = prepareFormAnswer(fields, { count: '1.5', choice: 'invalid', multiple: ['a', 'b'] });
  assert.deepEqual(Object.keys(result.errors), ['count', 'choice', 'multiple']);
  assert.deepEqual(result.answer, {});
});

test('formats and size constraints block invalid form submissions', () => {
  const fields: FormField[] = [
    { key: 'date', type: 'string', format: 'date' },
    { key: 'name', type: 'string', minLength: 3, maxLength: 4, pattern: '^[a-z]+$' },
    { key: 'url', type: 'external', url: 'https://example.com' },
  ];
  assert.deepEqual(Object.keys(prepareFormAnswer(fields, { date: '2026-02-30', name: 'A', url: true }).errors), ['date', 'name']);
  assert.deepEqual(prepareFormAnswer(fields, { date: '2026-02-28', name: 'okay', url: true }), { answer: { date: '2026-02-28', name: 'okay', url: true }, errors: {} });
});

test('external steps require explicit acknowledgment and cleared defaults stay cleared', () => {
  const fields: FormField[] = [
    { key: 'choice', type: 'string', default: 'default' },
    { key: 'auth', type: 'external', url: 'https://example.com' },
  ];
  assert.deepEqual(prepareFormAnswer(fields, { choice: undefined }), { answer: {}, errors: { auth: 'Confirm that you completed this step' } });
  assert.deepEqual(prepareFormAnswer(fields, { choice: undefined, auth: true }), { answer: { auth: true }, errors: {} });
});
