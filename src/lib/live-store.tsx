import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

export type StreamStatus = "Connecting" | "Live" | "Reconnecting";

export interface SessionNotice {
  activityNotice?: string;
  waiting?: { kind: "approval" | "question"; title: string };
}

interface LiveState {
  failure: string | null;
  notices: Record<string, SessionNotice | undefined>;
  setFailure: (failure: string | null) => void;
  setSessionNotice: (sessionID: string, notice: SessionNotice) => void;
  setStatus: (status: StreamStatus) => void;
  setStreamError: (message: string | null) => void;
  status: StreamStatus;
  streamError: string | null;
}

type LiveStore = StoreApi<LiveState>;

const createLiveStore = (): LiveStore =>
  createStore<LiveState>()((set) => ({
    failure: null,
    notices: {},
    setFailure: (failure) => set({ failure }),
    setSessionNotice: (sessionID, notice) =>
      set((state) => ({ notices: { ...state.notices, [sessionID]: notice } })),
    setStatus: (status) => set({ status }),
    setStreamError: (streamError) => set({ streamError }),
    status: "Connecting",
    streamError: null,
  }));

const LiveStoreContext = createContext<LiveStore | null>(null);

// One provider for each server connection. The event bus writes the stream
// status, the failure message and the Pi notices. Screens only read them.
// `failure` appears after repeated retries. `streamError` appears after each
// failed attempt and clears on the next event.
export const LiveStoreProvider = ({ children }: { children: ReactNode }) => {
  const store = useMemo(() => createLiveStore(), []);
  return (
    <LiveStoreContext.Provider value={store}>
      {children}
    </LiveStoreContext.Provider>
  );
};

const useLiveStoreApi = () => {
  const store = useContext(LiveStoreContext);
  if (!store) {
    throw new Error("Live state is used outside LiveStoreProvider");
  }
  return store;
};

// Returns the actions and getState without subscribing.
export const useLiveActions = () => {
  const store = useLiveStoreApi();
  return store.getState();
};

export const useLiveStore = <T,>(selector: (state: LiveState) => T) =>
  useStore(useLiveStoreApi(), selector);
