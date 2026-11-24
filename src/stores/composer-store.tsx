import type { StoreApi } from "zustand/vanilla";

import { createStoreContext } from "./create-store-context";

export interface AttachmentHandoff {
  context?: string;
  path?: string;
}

export interface ComposerState {
  // One-shot file handoff from the workspace, keyed by session ID. The chat
  // composer clears the entry after it consumes it. Drafts stay in `lib/drafts.ts`.
  handoffs: Record<string, AttachmentHandoff | undefined>;
}

const createActions = (store: StoreApi<ComposerState>) => ({
  clearHandoff: (sessionID: string) =>
    store.setState((state) => ({
      handoffs: { ...state.handoffs, [sessionID]: undefined },
    })),
  setHandoff: (sessionID: string, handoff: AttachmentHandoff) =>
    store.setState((state) => ({
      handoffs: { ...state.handoffs, [sessionID]: handoff },
    })),
});

export const {
  Provider: ComposerStoreProvider,
  useActions: useComposerActions,
  useApi: useComposerStoreApi,
  useSelector: useComposerStore,
} = createStoreContext<ComposerState, ReturnType<typeof createActions>>(
  "Composer store",
  () => ({
    handoffs: {},
  }),
  createActions
);
