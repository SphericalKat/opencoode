import type { StoreApi } from "zustand/vanilla";

import type { WorkspaceSection } from "../lib/routes";
import { createStoreContext } from "./create-store-context";

export interface PendingLocation {
  directory: string;
  sessionID: string;
}

export interface SessionLocationState {
  betaHome: boolean;
  betaHomeProject: { directory: string } | undefined;
  creatingSession: boolean;
  directory: string;
  openingSession: string | null;
  pendingLocation: PendingLocation | null;
  sessionID: string | null;
  workspaceSection: WorkspaceSection;
}

export interface SelectionPatch {
  directory?: string;
  sessionID: string | null;
}

const createActions = (store: StoreApi<SessionLocationState>) => ({
  beginCreatingSession: () =>
    store.setState({ creatingSession: true, openingSession: null }),
  // Home with no selected session.
  clearSelection: () =>
    store.setState({
      betaHome: true,
      pendingLocation: null,
      sessionID: null,
    }),
  clearPendingLocation: () => store.setState({ pendingLocation: null }),
  // Clears the location without touching the home flag, for a removed server.
  resetLocation: () =>
    store.setState({ directory: "", pendingLocation: null, sessionID: null }),
  // Restores the saved workspace of a connected server.
  restoreWorkspace: (directory: string, sessionID: string | null) =>
    store.setState({
      betaHome: !sessionID,
      betaHomeProject: undefined,
      directory,
      pendingLocation: null,
      sessionID,
    }),
  selectBetaHomeProject: (directory: string) =>
    store.setState({
      betaHome: true,
      betaHomeProject: { directory },
      directory,
      pendingLocation: null,
      sessionID: null,
    }),
  setBetaHome: (betaHome: boolean) => store.setState({ betaHome }),
  setCreatingSession: (creatingSession: boolean) =>
    store.setState({ creatingSession }),
  setDirectory: (directory: string) =>
    store.setState({ directory, pendingLocation: null }),
  setOpeningSession: (openingSession: string | null) =>
    store.setState({ openingSession }),
  setPendingLocation: (pendingLocation: PendingLocation) =>
    store.setState({ pendingLocation }),
  // Selects a session, or home when `sessionID` is null. A missing
  // `directory` keeps the current one.
  setSelection: ({ directory, sessionID }: SelectionPatch) =>
    store.setState((state) => ({
      betaHome: !sessionID,
      directory: directory ?? state.directory,
      pendingLocation: null,
      sessionID,
    })),
  setWorkspaceSection: (workspaceSection: WorkspaceSection) =>
    store.setState({ workspaceSection }),
  showHome: () => store.setState({ betaHome: true, openingSession: null }),
});

export const {
  Provider: SessionLocationStoreProvider,
  useActions: useSessionLocationActions,
  useApi: useSessionLocationStoreApi,
  useSelector: useSessionLocationStore,
} = createStoreContext<SessionLocationState, ReturnType<typeof createActions>>(
  "Session location store",
  () => ({
    betaHome: true,
    betaHomeProject: undefined,
    creatingSession: false,
    directory: "",
    openingSession: null,
    pendingLocation: null,
    sessionID: null,
    workspaceSection: "Changes",
  }),
  createActions
);
