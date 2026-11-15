const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15_000;

// min(1000 * 2^n, 15 s) for the nth failed attempt, counted from 0.
export const retryDelay = (attempts: number) =>
  Math.min(RETRY_BASE_MS * 2 ** attempts, RETRY_MAX_MS);
