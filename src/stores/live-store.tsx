import type { StoreApi } from "zustand/vanilla";

import { createStoreContext } from "./create-store-context";

export type StreamStatus = "Connecting" | "Live" | "Reconnecting";

export interface SessionNotice {
  activityNotice?: string;
  waiting?: { kind: "approval" | "question"; title: string };
}

interface LiveState {
  failure: string | null;
  notices: Record<string, SessionNotice | undefined>;
  status: StreamStatus;
  streamError: string | null;
}

const createActions = (store: StoreApi<LiveState>) => ({
  setFailure: (failure: string | null) => store.setState({ failure }),
  setSessionNotice: (sessionID: string, notice: SessionNotice) =>
    store.setState((state) => ({
      notices: { ...state.notices, [sessionID]: notice },
    })),
  setStatus: (status: StreamStatus) => store.setState({ status }),
  setStreamError: (streamError: string | null) =>
    store.setState({ streamError }),
});

// One provider for each server connection. The event bus writes the stream
// status, the failure message and the Pi notices. Screens only read them.
// `failure` appears after repeated retries. `streamError` appears after each
// failed attempt and clears on the next event.
export const {
  Provider: LiveStoreProvider,
  useActions: useLiveActions,
  useSelector: useLiveStore,
} = createStoreContext<LiveState, ReturnType<typeof createActions>>(
  "Live store",
  () => ({
    failure: null,
    notices: {},
    status: "Connecting",
    streamError: null,
  }),
  createActions
);
