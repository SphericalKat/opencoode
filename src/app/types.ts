import type { ServerInfo } from "@opencode/client";

import type { Connection, connect, createClient } from "../lib/client";
import type { useSheetCoordinator } from "../lib/sheets";
import type { useUnsavedGuard } from "../lib/unsaved";

export type Tab = "sessions" | "workspace" | "settings";

export type ServerClient = NonNullable<ReturnType<typeof createClient>>;

export interface AppliedConnection {
  connected: Connection;
  connections: Connection[];
  directory: string;
  info: ServerInfo | null;
  preserveWorkspace: boolean;
  sessionID: string | undefined;
}

export type ConnectResult = Awaited<ReturnType<typeof connect>>;
export type WorkspaceSnapshot =
  | { directory?: string; sessionID?: string }
  | null
  | undefined;

export interface SessionPanelRequest {
  id: number;
  panel: "stats" | "actions";
  sessionID: string;
}

export type ConfirmNavigation = ReturnType<typeof useUnsavedGuard>;
export type SheetCoordinator = ReturnType<typeof useSheetCoordinator>;
