export function createStreamBatch<T>(apply: (events: T[]) => void, options: { delayMs?: number; frame?: boolean } = {}) {
  let events: T[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame: number | undefined;
  const cancel = () => {
    if (timer !== undefined) clearTimeout(timer);
    if (frame !== undefined) cancelAnimationFrame(frame);
    timer = undefined;
    frame = undefined;
  };
  const flush = () => {
    cancel();
    if (!events.length) return;
    const batch = events;
    events = [];
    apply(batch);
  };
  return {
    push(event: T) {
      events.push(event);
      if (timer !== undefined || frame !== undefined) return;
      if (options.frame && typeof requestAnimationFrame === 'function') {
        frame = requestAnimationFrame(() => { frame = undefined; flush(); });
      } else {
        timer = setTimeout(flush, options.frame ? 16 : options.delayMs ?? 50);
      }
    },
    flush,
    clear() {
      cancel();
      events = [];
    },
  };
}
