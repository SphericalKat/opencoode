import type { Project } from "@opencode/client";
import type { StoreApi } from "zustand/vanilla";

import { createStoreContext } from "./create-store-context";

export interface PendingNavigationSheet {
  kind: "servers" | "projects";
  // ID of the server that was active when the sheet was queued.
  serverID: string | null;
  serverRequest?: number;
}

export interface SheetState {
  automaticServerRequest: number | null;
  moreOpen: boolean;
  navigationOpen: boolean;
  navigationPresented: boolean;
  newDirectory: string;
  // Runs after the More or Navigation sheet closes.
  pendingAction: (() => void) | null;
  pendingNavigationSheet: PendingNavigationSheet | null;
  projectBusy: boolean;
  projectError: string | null;
  projects: Project[];
  projectsOpen: boolean;
  // Counts requests to open the Servers sheet. The shell root listens to it.
  serverSheetOpenRequest: number;
  serverSheetRequest: number;
  serversOpen: boolean;
}

const createActions = (store: StoreApi<SheetState>) => ({
  // Starts an open request for the Servers sheet and returns its number.
  // Later requests make the earlier ones stale.
  beginServerRequest: (automatic: boolean) => {
    const request = store.getState().serverSheetRequest + 1;
    store.setState(
      automatic
        ? { automaticServerRequest: request, serverSheetRequest: request }
        : { serverSheetRequest: request }
    );
    return request;
  },
  beginProjectsLoad: () =>
    store.setState({ projectBusy: true, projectError: null }),
  // Drops the automatic Servers request that is still current and closes the
  // Servers sheet it opened. Returns true when it dropped one.
  cancelAutomaticServerRequest: () => {
    const {
      automaticServerRequest,
      pendingNavigationSheet,
      serverSheetRequest,
    } = store.getState();
    if (
      automaticServerRequest === null ||
      automaticServerRequest !== serverSheetRequest
    ) {
      return false;
    }
    store.setState({
      automaticServerRequest: null,
      pendingNavigationSheet:
        pendingNavigationSheet?.kind === "servers" &&
        pendingNavigationSheet.serverRequest === automaticServerRequest
          ? null
          : pendingNavigationSheet,
      serverSheetRequest: serverSheetRequest + 1,
      serversOpen: false,
    });
    return true;
  },
  changeNewDirectory: (newDirectory: string) =>
    store.setState({ newDirectory, projectError: null }),
  clearAutomaticServerRequest: () =>
    store.setState({ automaticServerRequest: null }),
  clearPendingNavigationSheet: () =>
    store.setState({ pendingNavigationSheet: null }),
  // Closes the Servers sheet and makes its pending requests stale.
  closeServers: () =>
    store.setState((state) => ({
      automaticServerRequest: null,
      serverSheetRequest: state.serverSheetRequest + 1,
      serversOpen: false,
    })),
  // Closes the Navigation sheet and queues a sheet to open after it dismisses.
  deferNavigationSheet: (pending: PendingNavigationSheet) =>
    store.setState({ navigationOpen: false, pendingNavigationSheet: pending }),
  finishProjectsLoad: () => store.setState({ projectBusy: false }),
  // Resets the sheet state after the Navigation sheet dismisses. Returns the
  // queued action and queued sheet.
  finishNavigationDismissal: () => {
    const { pendingAction, pendingNavigationSheet } = store.getState();
    store.setState({
      navigationPresented: false,
      pendingAction: null,
      pendingNavigationSheet: null,
    });
    return { pendingAction, pendingNavigationSheet };
  },
  hideMore: () => store.setState({ moreOpen: false }),
  hideNavigation: () => store.setState({ navigationOpen: false }),
  hideProjects: () => store.setState({ projectsOpen: false }),
  hideServers: () =>
    store.setState({ automaticServerRequest: null, serversOpen: false }),
  // Cancels the pending Servers request and drops its automatic flag.
  invalidateServerRequest: () =>
    store.setState((state) => ({
      automaticServerRequest: null,
      serverSheetRequest: state.serverSheetRequest + 1,
    })),
  // Opens the Navigation sheet.
  presentNavigation: () =>
    store.setState({
      navigationOpen: true,
      navigationPresented: true,
      pendingNavigationSheet: null,
    }),
  // Closes the More sheet and runs `action` after it dismisses.
  queueAfterMore: (action: () => void) =>
    store.setState({ moreOpen: false, pendingAction: action }),
  // Closes the Navigation sheet and runs `action` after it dismisses.
  queueAfterNavigation: (action: () => void) =>
    store.setState({ navigationOpen: false, pendingAction: action }),
  // Asks the shell root to open the Servers sheet.
  requestServerSheet: () =>
    store.setState((state) => ({
      serverSheetOpenRequest: state.serverSheetOpenRequest + 1,
    })),
  resetSheets: () => store.setState({ moreOpen: false, navigationOpen: false }),
  setNewDirectory: (newDirectory: string) => store.setState({ newDirectory }),
  setProjectError: (projectError: string | null) =>
    store.setState({ projectError }),
  setProjects: (projects: Project[]) => store.setState({ projects }),
  showMore: () => store.setState({ moreOpen: true }),
  showNavigation: () => store.setState({ navigationOpen: true }),
  showProjects: () => store.setState({ projectsOpen: true }),
  // Keeps `automaticServerRequest`, so a recovered connection can close the
  // sheet that recovery opened.
  showServers: () => store.setState({ serversOpen: true }),
  // Returns the queued action and clears it.
  takePendingAction: () => {
    const { pendingAction } = store.getState();
    store.setState({ pendingAction: null });
    return pendingAction;
  },
});

export const {
  create: createSheetStore,
  Provider: SheetStoreProvider,
  useActions: useSheetActions,
  useApi: useSheetStoreApi,
  useSelector: useSheetStore,
} = createStoreContext<SheetState, ReturnType<typeof createActions>>(
  "Sheet store",
  () => ({
    automaticServerRequest: null,
    moreOpen: false,
    navigationOpen: false,
    navigationPresented: false,
    newDirectory: "",
    pendingAction: null,
    pendingNavigationSheet: null,
    projectBusy: false,
    projectError: null,
    projects: [],
    projectsOpen: false,
    serverSheetOpenRequest: 0,
    serverSheetRequest: 0,
    serversOpen: false,
  }),
  createActions
);
