import type {
  SessionInfo,
  SessionMessageInfo,
  SessionPromptInput,
} from "@opencode/client";
import type React from "react";

import type { ChatBackend } from "../../lib/chat-backend";
import type { SessionData } from "./use-session-data";

export type CoreClient = ChatBackend["core"];
export type OpenCodeClient = ChatBackend["opencodeClient"];
export type Capabilities = ChatBackend["capabilities"];

// The session data queries plus the transcript and the live notices.
export type SessionState = SessionData & {
  activityNotice: string | undefined;
  backendWaiting: { kind: "approval" | "question"; title: string } | undefined;
  messages: SessionMessageInfo[];
  streamStatus: string;
};

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
  onOpenSettings?: (section: "Models" | "Accounts") => void;
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
  | "commands"
  | "mentions"
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
  | "raw"
  | null;

export type Alive = React.RefObject<boolean>;
export type SetPanel = React.Dispatch<React.SetStateAction<Panel>>;
