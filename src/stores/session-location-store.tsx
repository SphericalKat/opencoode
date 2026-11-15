import type { Tab } from "../shell/types";
import { createStoreContext } from "./create-store-context";

export type WorkspaceSection = "Files" | "Changes" | "Worktrees" | "Terminal";

export interface PendingLocation {
  directory: string;
  sessionID: string;
}

// Holds the selected location. Step 5 moves `tab`, `visited` and
// `workspaceSection` to routes and deletes them from this store.
export interface SessionLocationState {
  betaHome: boolean;
  betaHomeProject: { directory: string; revision: number } | undefined;
  creatingSession: boolean;
  directory: string;
  openingSession: string | null;
  pendingLocation: PendingLocation | null;
  selectionRevision: number;
  sessionID: string | null;
  settingsCanGoBack: boolean;
  tab: Tab;
  visited: Partial<Record<Tab, boolean>>;
  workspaceSection: WorkspaceSection;
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
  settingsCanGoBack: false,
  tab: "sessions",
  visited: { sessions: true },
  workspaceSection: "Changes",
}));
