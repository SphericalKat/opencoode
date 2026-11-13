import type { SessionInfo, SessionPromptInput } from "@opencode/client";
import type React from "react";

import type { ChatBackend } from "../../lib/chat-backend";

export interface Props {
  backend: ChatBackend;
  onConnectionLost?: (error: unknown) => void;
  sessionID: string;
  onSessionChanged: () => void;
  onOpenSession: (id: string) => void;
  attachmentPath?: string;
  attachmentContext?: string;
  onAttachmentConsumed?: () => void;
  draftKey?: string;
  visible?: boolean;
  onOpenNavigation?: () => void;
  serverID?: string;
  onSelectionChange?: (selected: boolean) => void;
  onSessionInfo?: (session: SessionInfo) => void;
  sessionPanelRequest?: {
    id: number;
    sessionID: string;
    panel: "stats" | "actions";
  };
}
export type Attachment = NonNullable<SessionPromptInput["files"]>[number];
export type Panel =
  | "actions"
  | "variants"
  | "models"
  | "agents"
  | "commands"
  | "mentions"
  | "tools"
  | "message"
  | "selectText"
  | "diff"
  | "context"
  | "instructions"
  | "schedules"
  | "background"
  | "children"
  | "stats"
  | "btw"
  | "resources"
  | null;
export type SyncScope = "metadata" | "history" | "inbox" | "requests";

export type Alive = React.RefObject<boolean>;
export type SetPanel = React.Dispatch<React.SetStateAction<Panel>>;
