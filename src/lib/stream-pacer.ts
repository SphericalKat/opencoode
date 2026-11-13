// Servers deliver streamed text in irregular bursts. The pacer turns those
// bursts into a steady tick: each burst is spread over the expected wait for
// the next one, so ticks keep going between bursts and stop soon after the
// text stops.

const FIRST_GAP = 400;
const FRESH_STREAM_GAP = 2000;
const GAP_SMOOTHING = 0.5;
const BRIDGE_FACTOR = 1.25;
const MAX_DRAIN_WINDOW = 1500;

export interface StreamPacer {
  feed: (characters: number, now: number) => void;
  reset: () => void;
  take: (interval: number) => boolean;
}

export const createStreamPacer = (): StreamPacer => {
  let budget = 0;
  let drainPerMs = 0;
  let expectedGap = FIRST_GAP;
  let measured = false;
  let lastArrival: number | undefined;

  return {
    feed: (characters, now) => {
      if (characters <= 0) {
        return;
      }
      const gap = lastArrival === undefined ? undefined : now - lastArrival;
      lastArrival = now;
      if (gap === undefined || gap > FRESH_STREAM_GAP) {
        expectedGap = FIRST_GAP;
        measured = false;
        budget = 0;
      } else if (measured) {
        expectedGap += (gap - expectedGap) * GAP_SMOOTHING;
      } else {
        expectedGap = gap;
        measured = true;
      }
      budget = Math.max(budget, 0) + characters;
      const window = Math.min(expectedGap * BRIDGE_FACTOR, MAX_DRAIN_WINDOW);
      drainPerMs = budget / window;
    },
    reset: () => {
      budget = 0;
      drainPerMs = 0;
      expectedGap = FIRST_GAP;
      measured = false;
      lastArrival = undefined;
    },
    take: (interval) => {
      if (budget <= 0) {
        return false;
      }
      budget -= drainPerMs * interval;
      return true;
    },
  };
};
