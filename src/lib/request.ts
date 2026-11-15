export const REQUEST_TIMEOUT_MS = 15_000;

const TIMEOUT_MESSAGE =
  "The request timed out. Check your connection, then refresh before you retry.";

// Joins the TanStack Query abort signal with a 15 second deadline and reports a
// readable error when the deadline fires.
export const withDeadline = async <T>(
  signal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
  { message = TIMEOUT_MESSAGE, timeoutMs = REQUEST_TIMEOUT_MS } = {}
): Promise<T> => {
  const deadline = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  try {
    return await run(combined);
  } catch (error) {
    if (deadline.aborted && !signal?.aborted) {
      throw new Error(message, { cause: error });
    }
    throw error;
  }
};
