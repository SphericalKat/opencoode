import type { SessionPanelRequest } from "../shell/types";
import { createStoreContext } from "./create-store-context";

export interface ChatUiState {
  messageSelected: boolean;
  panelRequest: SessionPanelRequest | undefined;
  panelRequestID: number;
}

export const {
  Provider: ChatUiStoreProvider,
  useApi: useChatUiStoreApi,
  useSelector: useChatUiStore,
} = createStoreContext<ChatUiState>("Chat UI store", () => ({
  messageSelected: false,
  panelRequest: undefined,
  panelRequestID: 0,
}));
