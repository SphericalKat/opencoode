export const noop = () => {
  // Intentionally does nothing.
};

export const settle = async (
  work: () => Promise<void>,
  onError: (reason: unknown) => unknown,
  cleanup?: () => void
) => {
  try {
    await work();
  } catch (error_) {
    await onError(error_);
  } finally {
    cleanup?.();
  }
};

export const withCleanup = async <T>(
  work: () => Promise<T>,
  cleanup: () => void
) => {
  try {
    return await work();
  } finally {
    cleanup();
  }
};
