import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

interface SheetCoordinator {
  suspended: boolean;
  recoveryPending: boolean;
  presentSheet: (id: string) => void;
  dismissSheet: (id: string) => boolean;
  suspendSheets: () => Promise<void>;
  resumeSheets: () => void;
}

const Context = createContext<SheetCoordinator>({
  dismissSheet: () => false,
  presentSheet: () => {
    // No-op without a provider.
  },
  recoveryPending: false,
  resumeSheets: () => {
    // No-op without a provider.
  },
  suspendSheets: () => Promise.resolve(),
  suspended: false,
});

export const SheetCoordinatorProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [suspended, setSuspended] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const suspensionRequested = useRef(false);
  const presented = useRef(new Set<string>());
  const waiting = useRef(new Set<() => void>());
  const presentSheet = useCallback((id: string) => {
    presented.current.add(id);
  }, []);
  const dismissSheet = useCallback((id: string) => {
    const deferActions = suspensionRequested.current;
    presented.current.delete(id);
    if (!presented.current.size && deferActions) {
      setRecoveryPending(false);
      setSuspended(true);
      const ready = [...waiting.current];
      waiting.current.clear();
      for (const resolve of ready) {
        resolve();
      }
    }
    return deferActions;
  }, []);
  const suspendSheets = useCallback(() => {
    suspensionRequested.current = true;
    return new Promise<void>((resolve) => {
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
    for (const resolve of ready) {
      resolve();
    }
  }, []);
  const value = useMemo(
    () => ({
      dismissSheet,
      presentSheet,
      recoveryPending,
      resumeSheets,
      suspendSheets,
      suspended,
    }),
    [
      suspended,
      recoveryPending,
      presentSheet,
      dismissSheet,
      suspendSheets,
      resumeSheets,
    ]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export const useSheetCoordinator = () => useContext(Context);

export const useNativePresentation = () => {
  const { presentSheet, dismissSheet } = useSheetCoordinator();
  const id = useId();
  const sequence = useRef(0);
  return useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T> => {
      if (Platform.OS === "web") {
        return operation();
      }
      sequence.current += 1;
      const presentation = `${id}:native:${sequence.current}`;
      presentSheet(presentation);
      let result: T;
      try {
        result = await operation();
      } catch (error) {
        dismissSheet(presentation);
        throw error;
      }
      dismissSheet(presentation);
      return result;
    },
    [id, presentSheet, dismissSheet]
  );
};
