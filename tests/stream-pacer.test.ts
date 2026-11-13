import assert from "node:assert/strict";
import test from "node:test";

import { createStreamPacer } from "../src/lib/stream-pacer";

const INTERVAL = 50;

const tickTimes = (arrivals: [number, number][], end: number) => {
  const pacer = createStreamPacer();
  const pending = [...arrivals];
  const ticks: number[] = [];
  for (let now = 0; now <= end; now += 1) {
    while (pending.length && pending[0][0] <= now) {
      const [time, characters] = pending.shift() ?? [now, 0];
      pacer.feed(characters, time);
    }
    if (now % INTERVAL === 0 && pacer.take(INTERVAL)) {
      ticks.push(now);
    }
  }
  return ticks;
};

const longestGap = (ticks: number[], from: number, to: number) => {
  const inside = ticks.filter((time) => time >= from && time <= to);
  let longest = 0;
  for (let index = 1; index < inside.length; index += 1) {
    longest = Math.max(longest, inside[index] - inside[index - 1]);
  }
  return longest;
};

test("bursts a second apart tick continuously once the cadence is known", () => {
  const arrivals: [number, number][] = [0, 1000, 2000, 3000, 4000].map(
    (time) => [time, 200]
  );
  const ticks = tickTimes(arrivals, 5000);
  assert.equal(longestGap(ticks, 1000, 4000), INTERVAL);
});

test("frame-by-frame deltas tick on every interval", () => {
  const arrivals: [number, number][] = [];
  for (let time = 0; time < 2000; time += 16) {
    arrivals.push([time, 3]);
  }
  const ticks = tickTimes(arrivals, 2000);
  assert.equal(longestGap(ticks, 100, 1950), INTERVAL);
});

test("ticks stop soon after the text stops", () => {
  const arrivals: [number, number][] = [0, 500, 1000].map((time) => [
    time,
    120,
  ]);
  const ticks = tickTimes(arrivals, 6000);
  assert.ok((ticks.at(-1) ?? 0) <= 1000 + 500 * 1.25 + INTERVAL);
});

test("a pause long enough to be a new stream does not bridge the silence", () => {
  const ticks = tickTimes(
    [
      [0, 200],
      [5000, 200],
    ],
    6000
  );
  assert.equal(ticks.filter((time) => time > 1000 && time < 5000).length, 0);
});

test("no text means no ticks", () => {
  assert.deepEqual(tickTimes([], 1000), []);
});
