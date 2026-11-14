import assert from "node:assert/strict";
import test from "node:test";

import { SNACKBAR_DURATION_MS, createSnackbarQueue } from "../src/lib/undo";
import type { DismissReason } from "../src/lib/undo";

const createClock = () => {
  let now = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  let nextTimer = 0;
  return {
    advance: (ms: number) => {
      now += ms;
      for (const [key, timer] of timers) {
        if (timer.at <= now) {
          timers.delete(key);
          timer.fn();
        }
      }
    },
    schedule: (fn: () => void, ms: number) => {
      nextTimer += 1;
      const key = nextTimer;
      timers.set(key, { at: now + ms, fn });
      return () => {
        timers.delete(key);
      };
    },
  };
};

const setup = () => {
  const clock = createClock();
  const queue = createSnackbarQueue(clock.schedule);
  const events: string[] = [];
  const entry = (name: string) => ({
    actionLabel: "Undo",
    durationMs: SNACKBAR_DURATION_MS,
    message: name,
    onAction: () => events.push(`${name}:onAction`),
    onDismiss: (reason: DismissReason) => events.push(`${name}:${reason}`),
  });
  return { clock, entry, events, queue };
};

test("an entry dismisses with timeout after its duration", () => {
  const { clock, entry, events, queue } = setup();
  queue.show(entry("a"));
  clock.advance(SNACKBAR_DURATION_MS - 1);
  assert.equal(queue.current()?.message, "a");
  assert.deepEqual(events, []);
  clock.advance(1);
  assert.equal(queue.current(), undefined);
  assert.deepEqual(events, ["a:timeout"]);
});

test("act runs the action then dismisses with action and never times out", () => {
  const { clock, entry, events, queue } = setup();
  const id = queue.show(entry("a"));
  queue.act(id);
  clock.advance(SNACKBAR_DURATION_MS * 2);
  assert.deepEqual(events, ["a:onAction", "a:action"]);
});

test("show while visible dismisses the previous entry with replaced", () => {
  const { entry, events, queue } = setup();
  queue.show(entry("a"));
  queue.show(entry("b"));
  assert.equal(queue.current()?.message, "b");
  assert.deepEqual(events, ["a:replaced"]);
});

test("a replaced entry timer does not dismiss the new entry", () => {
  const { clock, entry, events, queue } = setup();
  queue.show(entry("a"));
  clock.advance(3000);
  queue.show(entry("b"));
  clock.advance(3000);
  assert.equal(queue.current()?.message, "b");
  assert.deepEqual(events, ["a:replaced"]);
});

test("dispose dismisses the current entry with unmount", () => {
  const { clock, entry, events, queue } = setup();
  queue.show(entry("a"));
  queue.dispose();
  clock.advance(SNACKBAR_DURATION_MS * 2);
  assert.deepEqual(events, ["a:unmount"]);
});

test("dismiss with a stale id leaves the current entry", () => {
  const { entry, events, queue } = setup();
  const first = queue.show(entry("a"));
  queue.show(entry("b"));
  queue.dismiss(first, "swipe");
  assert.equal(queue.current()?.message, "b");
  assert.deepEqual(events, ["a:replaced"]);
});

test("subscribers hear every change until they unsubscribe", () => {
  const { entry, queue } = setup();
  let calls = 0;
  const unsubscribe = queue.subscribe(() => {
    calls += 1;
  });
  const id = queue.show(entry("a"));
  queue.dismiss(id, "swipe");
  assert.equal(calls, 2);
  unsubscribe();
  queue.show(entry("b"));
  assert.equal(calls, 2);
});
