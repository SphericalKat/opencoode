import type { StoreApi } from "zustand/vanilla";

import { createStoreContext } from "./create-store-context";

// A tab holds no title. Titles come from `session.detail` or `sessions.list`.
export interface OpenSessionTab {
  directory: string;
  id: string;
}

export interface SessionTabsState {
  // Open tabs by server ID. A server change keeps the tabs of other servers.
  openTabs: Record<string, OpenSessionTab[] | undefined>;
}

const noTabs: OpenSessionTab[] = [];

export const selectOpenTabs =
  (serverID: string | null | undefined) =>
  (state: SessionTabsState): OpenSessionTab[] =>
    (serverID ? state.openTabs[serverID] : undefined) ?? noTabs;

const createActions = (store: StoreApi<SessionTabsState>) => ({
  clearTabs: (serverID: string) =>
    store.setState((state) => ({
      openTabs: { ...state.openTabs, [serverID]: undefined },
    })),
  closeTab: (serverID: string, sessionID: string) =>
    store.setState((state) => ({
      openTabs: {
        ...state.openTabs,
        [serverID]: selectOpenTabs(serverID)(state).filter(
          (item) => item.id !== sessionID
        ),
      },
    })),
  // Adds the tab, or updates its directory when the tab exists.
  openTab: (serverID: string, tab: OpenSessionTab) => {
    const tabs = selectOpenTabs(serverID)(store.getState());
    const previous = tabs.find((item) => item.id === tab.id);
    if (previous?.directory === tab.directory) {
      return;
    }
    store.setState((state) => ({
      openTabs: {
        ...state.openTabs,
        [serverID]: previous
          ? tabs.map((item) => (item.id === tab.id ? tab : item))
          : [...tabs, tab],
      },
    }));
  },
});

export const {
  Provider: SessionTabsStoreProvider,
  useActions: useSessionTabsActions,
  useApi: useSessionTabsStoreApi,
  useSelector: useSessionTabsStore,
} = createStoreContext<SessionTabsState, ReturnType<typeof createActions>>(
  "Session tabs store",
  () => ({
    openTabs: {},
  }),
  createActions
);
