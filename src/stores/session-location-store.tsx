import { createStoreContext } from "./create-store-context";

export type WorkspaceSection = "Files" | "Changes" | "Worktrees" | "Terminal";

export interface PendingLocation {
  directory: string;
  sessionID: string;
}

export interface SessionLocationState {
  betaHome: boolean;
  betaHomeProject: { directory: string; revision: number } | undefined;
  creatingSession: boolean;
  directory: string;
  openingSession: string | null;
  pendingLocation: PendingLocation | null;
  selectionRevision: number;
  sessionID: string | null;
}

export const {
  Provider: SessionLocationStoreProvider,
  useApi: useSessionLocationStoreApi,
  useSelector: useSessionLocationStore,
} = createStoreContext<SessionLocationState>("Session location store", () => ({
  betaHome: true,
  betaHomeProject: undefined,
  creatingSession: false,
  directory: "",
  openingSession: null,
  pendingLocation: null,
  selectionRevision: 0,
  sessionID: null,
}));
