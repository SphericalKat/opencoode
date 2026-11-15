import { createStoreContext } from "./create-store-context";

export interface OpenSessionTab {
  directory: string;
  id: string;
  title: string;
}

export interface SessionTabsState {
  openTabs: OpenSessionTab[];
}

export const {
  Provider: SessionTabsStoreProvider,
  useApi: useSessionTabsStoreApi,
  useSelector: useSessionTabsStore,
} = createStoreContext<SessionTabsState>("Session tabs store", () => ({
  openTabs: [],
}));
