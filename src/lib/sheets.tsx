import React, { createContext, useCallback, useContext, useId, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

type SheetCoordinator = {
  suspended: boolean;
  recoveryPending: boolean;
  presentSheet: (id: string) => void;
  dismissSheet: (id: string) => boolean;
  suspendSheets: () => Promise<void>;
  resumeSheets: () => void;
};

const Context = createContext<SheetCoordinator>({
  suspended: false,
  recoveryPending: false,
  presentSheet: () => {},
  dismissSheet: () => false,
  suspendSheets: async () => {},
  resumeSheets: () => {},
});

export function SheetCoordinatorProvider({ children }: { children: React.ReactNode }) {
  const [suspended, setSuspended] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const suspensionRequested = useRef(false);
  const presented = useRef(new Set<string>());
  const waiting = useRef(new Set<() => void>());
  const presentSheet = useCallback((id: string) => { presented.current.add(id); }, []);
  const dismissSheet = useCallback((id: string) => {
    const deferActions = suspensionRequested.current;
    presented.current.delete(id);
    if (!presented.current.size && deferActions) {
      setRecoveryPending(false);
      setSuspended(true);
      const ready = [...waiting.current];
      waiting.current.clear();
      ready.forEach(resolve => resolve());
    }
    return deferActions;
  }, []);
  const suspendSheets = useCallback(() => {
    suspensionRequested.current = true;
    return new Promise<void>(resolve => {
      if (presented.current.size) {
        setRecoveryPending(true);
        waiting.current.add(resolve);
      } else {
        setRecoveryPending(false);
        setSuspended(true);
        resolve();
      }
    });
  }, []);
  const resumeSheets = useCallback(() => {
    suspensionRequested.current = false;
    setRecoveryPending(false);
    setSuspended(false);
    const ready = [...waiting.current];
    waiting.current.clear();
    ready.forEach(resolve => resolve());
  }, []);
  const value = useMemo(() => ({ suspended, recoveryPending, presentSheet, dismissSheet, suspendSheets, resumeSheets }), [suspended, recoveryPending, presentSheet, dismissSheet, suspendSheets, resumeSheets]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSheetCoordinator() { return useContext(Context); }

export function useNativePresentation() {
  const { presentSheet, dismissSheet } = useSheetCoordinator();
  const id = useId();
  const sequence = useRef(0);
  return useCallback(async function withNativePresentation<T>(operation: () => Promise<T>): Promise<T> {
    if (Platform.OS === 'web') return operation();
    const presentation = `${id}:native:${++sequence.current}`;
    presentSheet(presentation);
    try { return await operation(); }
    finally { dismissSheet(presentation); }
  }, [id, presentSheet, dismissSheet]);
}
