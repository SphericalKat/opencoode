import type { ExperimentalScheduleCreateInput } from "@opencode/client";

export interface ScheduleDraft {
  name: string;
  prompt: string;
  mode: "in" | "at" | "every" | "cron";
  trigger: string;
  timezone: string;
  after: string;
  until: string;
  runs: string;
}

const assertValidTimeZone = (tz: string) => {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return formatter;
  } catch {
    throw new Error("Enter a valid time zone, such as Asia/Kolkata");
  }
};

const scheduleWhen = (
  mode: ScheduleDraft["mode"],
  trigger: string,
  tz: string | undefined
): ExperimentalScheduleCreateInput["when"] => {
  if (mode === "in") {
    return { in: trigger, tz };
  }
  if (mode === "at") {
    return { at: trigger, tz };
  }
  if (mode === "every") {
    return { every: trigger, tz };
  }
  return { cron: trigger, tz };
};

const scheduleEnds = (
  draft: ScheduleDraft,
  repeating: boolean,
  times: number | undefined
) =>
  repeating && (draft.after.trim() || draft.until.trim() || times !== undefined)
    ? {
        after: draft.after.trim() || undefined,
        at: draft.until.trim() || undefined,
        times,
      }
    : undefined;

export const prepareSchedule = (
  sessionID: string,
  draft: ScheduleDraft
): ExperimentalScheduleCreateInput => {
  const prompt = draft.prompt.trim();
  const trigger = draft.trigger.trim();
  const tz = draft.timezone.trim() || undefined;
  if (!prompt) {
    throw new Error("Enter the prompt for this schedule");
  }
  if (!trigger) {
    throw new Error("Enter when this schedule runs");
  }
  if (tz) {
    assertValidTimeZone(tz);
  }
  const repeating = draft.mode === "every" || draft.mode === "cron";
  const times = repeating && draft.runs.trim() ? Number(draft.runs) : undefined;
  if (times !== undefined && (!Number.isSafeInteger(times) || times < 1)) {
    throw new Error("Enter a whole number of runs, greater than zero");
  }
  const when = scheduleWhen(draft.mode, trigger, tz);
  const ends = scheduleEnds(draft, repeating, times);
  return {
    ends,
    name: draft.name.trim() || undefined,
    prompt,
    sessionID,
    when,
  };
};
