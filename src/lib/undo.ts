export const SNACKBAR_DURATION_MS = 5000;
export const SNACKBAR_SCREEN_READER_DURATION_MS = 10_000;

export type DismissReason =
  | "timeout"
  | "action"
  | "replaced"
  | "swipe"
  | "unmount";

export interface UndoEntry {
  id: number;
  message: string;
  actionLabel?: string;
  durationMs: number;
  onAction?: () => void;
  onDismiss?: (reason: DismissReason) => void;
}

type Schedule = (fn: () => void, ms: number) => () => void;

export const createSnackbarQueue = (schedule: Schedule) => {
  let current: UndoEntry | undefined;
  let cancelTimer: (() => void) | undefined;
  let nextId = 1;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const clearCurrent = () => {
    cancelTimer?.();
    cancelTimer = undefined;
    const entry = current;
    current = undefined;
    return entry;
  };

  const dismiss = (id: number, reason: DismissReason) => {
    if (current?.id !== id) {
      return;
    }
    const entry = clearCurrent();
    notify();
    entry?.onDismiss?.(reason);
  };

  const act = (id: number) => {
    if (current?.id !== id) {
      return;
    }
    const entry = clearCurrent();
    notify();
    entry?.onAction?.();
    entry?.onDismiss?.("action");
  };

  const show = (entry: Omit<UndoEntry, "id">) => {
    const previous = clearCurrent();
    const id = nextId;
    nextId += 1;
    current = { ...entry, id };
    cancelTimer = schedule(() => dismiss(id, "timeout"), entry.durationMs);
    notify();
    previous?.onDismiss?.("replaced");
    return id;
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const dispose = () => {
    const entry = clearCurrent();
    entry?.onDismiss?.("unmount");
    listeners.clear();
  };

  return {
    act,
    current: () => current,
    dismiss,
    dispose,
    show,
    subscribe,
  };
};
