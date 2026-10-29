import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { confirmAction } from '../components/ui';

type Guard = { update: (id: string, label: string | null) => void; confirm: () => Promise<boolean> };
const Context = createContext<Guard>({ update: () => {}, confirm: async () => true });

export function UnsavedProvider({ children }: { children: React.ReactNode }) {
  const changes = useRef(new Map<string, string>());
  const update = useCallback((id: string, label: string | null) => {
    if (label) changes.current.set(id, label);
    else changes.current.delete(id);
  }, []);
  const confirm = useCallback(async () => !changes.current.size || confirmAction('Leave this view?', `${[...new Set(changes.current.values())].join(', ')} contains unsaved changes. Continue?`), []);
  const value = useMemo(() => ({ update, confirm }), [update, confirm]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useUnsavedChanges(id: string, label: string, dirty: boolean) {
  const { update } = useContext(Context);
  useEffect(() => {
    update(id, dirty ? label : null);
    return () => update(id, null);
  }, [id, label, dirty, update]);
}

export function useUnsavedGuard() { return useContext(Context).confirm; }
