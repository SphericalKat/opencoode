import type { ExperimentalScheduleCreateInput } from '@opencode/client';

export type ScheduleDraft = {
  name: string;
  prompt: string;
  mode: 'in' | 'at' | 'every' | 'cron';
  trigger: string;
  timezone: string;
  after: string;
  until: string;
  runs: string;
};

export function prepareSchedule(sessionID: string, draft: ScheduleDraft): ExperimentalScheduleCreateInput {
  const prompt = draft.prompt.trim();
  const trigger = draft.trigger.trim();
  const tz = draft.timezone.trim() || undefined;
  if (!prompt) throw new Error('Enter the prompt for this schedule');
  if (!trigger) throw new Error('Enter when this schedule runs');
  if (tz) {
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); }
    catch { throw new Error('Enter a valid time zone, such as Asia/Kolkata'); }
  }
  const repeating = draft.mode === 'every' || draft.mode === 'cron';
  const times = repeating && draft.runs.trim() ? Number(draft.runs) : undefined;
  if (times !== undefined && (!Number.isSafeInteger(times) || times < 1)) throw new Error('Enter a whole number of runs, greater than zero');
  const when: ExperimentalScheduleCreateInput['when'] = draft.mode === 'in' ? { in: trigger, tz }
    : draft.mode === 'at' ? { at: trigger, tz }
    : draft.mode === 'every' ? { every: trigger, tz }
    : { cron: trigger, tz };
  const ends = repeating && (draft.after.trim() || draft.until.trim() || times !== undefined)
    ? { after: draft.after.trim() || undefined, at: draft.until.trim() || undefined, times }
    : undefined;
  return { sessionID, name: draft.name.trim() || undefined, prompt, when, ends };
}
