import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import { confirmAction } from "../components/ui";

interface Guard {
  update: (id: string, label: string | null) => void;
  confirm: (id?: string) => Promise<boolean>;
  subscribe: (listener: () => void) => () => void;
  has: (id: string) => boolean;
}
const Context = createContext<Guard>({
  confirm: () => Promise.resolve(true),
  has: () => false,
  subscribe: () => () => {
    // Without a provider there is nothing to unsubscribe.
  },
  update: () => {
    // Without a provider there are no unsaved changes to track.
  },
});

export const UnsavedProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const changes = useRef(new Map<string, string>());
  const listeners = useRef(new Set<() => void>());
  const update = useCallback((id: string, label: string | null) => {
    if ((changes.current.get(id) ?? null) === label) {
      return;
    }
    if (label) {
      changes.current.set(id, label);
    } else {
      changes.current.delete(id);
    }
    for (const listener of listeners.current) {
      listener();
    }
  }, []);
  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
  const has = useCallback((id: string) => changes.current.has(id), []);
  const confirm = useCallback(async (id?: string) => {
    const labels = id
      ? [changes.current.get(id)].filter(Boolean)
      : [...new Set(changes.current.values())];
    return (
      !labels.length ||
      (await confirmAction(
        "Leave this view?",
        `${labels.join(", ")} contains unsaved changes. Continue?`
      ))
    );
  }, []);
  const value = useMemo(
    () => ({ confirm, has, subscribe, update }),
    [update, confirm, subscribe, has]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useUnsavedChanges = (
  id: string,
  label: string,
  dirty: boolean
) => {
  const { update } = useContext(Context);
  useEffect(() => {
    update(id, dirty ? label : null);
    return () => update(id, null);
  }, [id, label, dirty, update]);
};

export const useUnsavedGuard = (id?: string) => {
  const { confirm } = useContext(Context);
  return useCallback(() => confirm(id), [confirm, id]);
};

export const useHasUnsavedChanges = (id: string) => {
  const { subscribe, has } = useContext(Context);
  return useSyncExternalStore(
    subscribe,
    () => has(id),
    () => false
  );
};
