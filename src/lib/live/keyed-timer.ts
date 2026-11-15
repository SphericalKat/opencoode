// Runs one callback for each key after a quiet period. A key that is already
// waiting keeps its timer, so a burst of events causes one run.
export const createKeyedTimer = (delayMs: number) => {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  return {
    clear() {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    },
    schedule(key: string, run: () => void) {
      if (timers.has(key)) {
        return;
      }
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          run();
        }, delayMs)
      );
    },
  };
};
