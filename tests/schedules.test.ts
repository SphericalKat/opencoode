import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSchedule, type ScheduleDraft } from '../src/lib/schedules';

const draft: ScheduleDraft = { name: '', prompt: 'Check the build', mode: 'every', trigger: '1 hour', timezone: 'Asia/Kolkata', after: '', until: '', runs: '' };

test('schedule form rejects empty input and invalid repeat limits before server admission', () => {
  assert.throws(() => prepareSchedule('ses_a', { ...draft, prompt: '  ' }), /Enter the prompt/);
  assert.throws(() => prepareSchedule('ses_a', { ...draft, trigger: '' }), /Enter when/);
  for (const runs of ['0', '-1', '1.5', 'Infinity', 'abc', '9007199254740992']) {
    assert.throws(() => prepareSchedule('ses_a', { ...draft, runs }), /whole number/);
  }
  assert.throws(() => prepareSchedule('ses_a', { ...draft, timezone: 'Not/AZone' }), /valid time zone/);
});

test('one-shot requests do not inherit repeat limits from a previous form mode', () => {
  const request = prepareSchedule('ses_a', { ...draft, mode: 'in', trigger: '20 minutes', runs: 'invalid', after: '8 hours' });
  assert.equal(request.ends, undefined);
});
