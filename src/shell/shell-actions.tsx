import type { SessionInfo } from "@opencode/client";
import { createContext, useContext } from "react";

import type { SessionPane } from "../components/beta-navigation";
import type { ChatBackend } from "../lib/chat-backend";
import type { Connection } from "../lib/client";
import type { ServerClient } from "./types";

// The shell layout owns the navigation hooks. Route screens read their
// callbacks and the connected client from this context.
export interface ShellActions {
  active: Connection;
  chatBackend: ChatBackend | null;
  client: ServerClient;
  onAttachFile: (path: string, contextText?: string) => Promise<boolean>;
  onChangeDirectory: (directory: string) => void;
  onChooseDirectory: () => void;
  onCreateSession: (directory: string) => void;
  onOpenNavigation: () => void;
  onOpenSession: (id: string) => void;
  onOpenSessionFromList: (id: string) => Promise<boolean>;
  onOpenSettings: (section: "Models" | "Accounts") => void;
  onSelectPane: (pane: SessionPane) => void;
  onSessionChanged: () => void;
  onSessionInfo: (session: SessionInfo) => void;
  onShowHome: () => void;
}

const ShellActionsContext = createContext<ShellActions | null>(null);

export const ShellActionsProvider = ShellActionsContext.Provider;

export const useShellActions = (): ShellActions => {
  const actions = useContext(ShellActionsContext);
  if (!actions) {
    throw new Error("Shell actions are available only inside the shell layout");
  }
  return actions;
};
