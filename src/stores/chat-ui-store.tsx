import type { StoreApi } from "zustand/vanilla";

import type { SessionPanelRequest } from "../shell/types";
import { createStoreContext } from "./create-store-context";

// Both maps are keyed by chat ID: the session ID of the main chat or of a
// Pi chat. A chat that unmounts clears its own selection. Other chats keep theirs.
export interface ChatUiState {
  panelRequestCount: number;
  panelRequests: Record<string, SessionPanelRequest | undefined>;
  selected: Record<string, boolean | undefined>;
}

const createActions = (store: StoreApi<ChatUiState>) => ({
  clearSelection: (chatID: string) =>
    store.setState((state) => ({
      selected: { ...state.selected, [chatID]: undefined },
    })),
  requestPanel: (chatID: string, panel: SessionPanelRequest["panel"]) =>
    store.setState((state) => {
      const id = state.panelRequestCount + 1;
      return {
        panelRequestCount: id,
        panelRequests: {
          ...state.panelRequests,
          [chatID]: { id, panel },
        },
      };
    }),
  setSelection: (chatID: string, selected: boolean) =>
    store.setState((state) => ({
      selected: { ...state.selected, [chatID]: selected },
    })),
});

export const {
  Provider: ChatUiStoreProvider,
  useActions: useChatUiActions,
  useApi: useChatUiStoreApi,
  useSelector: useChatUiStore,
} = createStoreContext<ChatUiState, ReturnType<typeof createActions>>(
  "Chat UI store",
  () => ({
    panelRequestCount: 0,
    panelRequests: {},
    selected: {},
  }),
  createActions
);
