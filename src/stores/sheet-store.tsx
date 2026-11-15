import type { Project } from "@opencode/client";

import { noop } from "../shell/constants";
import { createStoreContext } from "./create-store-context";

export interface PendingNavigationSheet {
  epoch: number;
  kind: "servers" | "projects";
  serverRequest?: number;
}

export interface SheetState {
  automaticServerRequest: number | null;
  moreOpen: boolean;
  navigationOpen: boolean;
  navigationPresented: boolean;
  newDirectory: string;
  // Runs after the More sheet closes. See `afterBetaMenu`.
  pendingAction: (() => void) | null;
  pendingNavigationSheet: PendingNavigationSheet | null;
  projectBusy: boolean;
  projectError: string | null;
  projects: Project[];
  projectsOpen: boolean;
  serverSheetRequest: number;
  serversOpen: boolean;
  // Registered by the navigation sheet hook so queued actions call the latest one.
  showServerSheet: () => void;
}

export const {
  Provider: SheetStoreProvider,
  useApi: useSheetStoreApi,
  useSelector: useSheetStore,
} = createStoreContext<SheetState>("Sheet store", () => ({
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
  serverSheetRequest: 0,
  serversOpen: false,
  showServerSheet: noop,
}));
