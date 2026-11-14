import type { SessionMessageInfo } from "@opencode/client";

export type MessageMenuEntry =
  | "copy"
  | "selectText"
  | "fork"
  | "edit"
  | "commandOutput"
  | "select"
  | "revert";

export interface MessageMenuInput {
  message: SessionMessageInfo;
  text: string;
  busy: boolean;
  draftLoaded: boolean;
  canFork: boolean;
  canRevert: boolean;
  canShowOutput: boolean;
}

export interface MessageMenuContext {
  busy: boolean;
  canFork: (message: SessionMessageInfo) => boolean;
  canRevert: boolean;
  canShowOutput: boolean;
  draftLoaded: boolean;
}

export const messageMenuInput = (
  message: SessionMessageInfo,
  text: string,
  context: MessageMenuContext
): MessageMenuInput => ({
  busy: context.busy,
  canFork: context.canFork(message),
  canRevert: context.canRevert,
  canShowOutput: context.canShowOutput,
  draftLoaded: context.draftLoaded,
  message,
  text,
});

export const messageMenuEntries = ({
  message,
  text,
  busy,
  draftLoaded,
  canFork,
  canRevert,
  canShowOutput,
}: MessageMenuInput): MessageMenuEntry[] => {
  const hasText = text.trim() !== "";
  const entries: MessageMenuEntry[] = [];
  if (hasText) {
    entries.push("copy", "selectText");
  }
  if (canFork && !busy) {
    entries.push("fork");
  }
  if (message.type === "user" && draftLoaded && !busy) {
    entries.push("edit");
  }
  if (message.type === "shell" && canShowOutput) {
    entries.push("commandOutput");
  }
  const hasBarAction = entries.some(
    (entry) => entry === "copy" || entry === "fork" || entry === "edit"
  );
  if (hasBarAction) {
    entries.push("select");
  }
  if (message.type === "user" && canRevert && !busy) {
    entries.push("revert");
  }
  return entries;
};
