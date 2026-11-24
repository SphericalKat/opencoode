import type { SessionInfo, SessionMessageInfo } from "@opencode/client";
import React, { useState } from "react";

import { AnchoredMenu } from "../../components/anchored-menu";
import type { AnchoredMenuItem, Rect } from "../../components/anchored-menu";
import { confirmAction } from "../../components/dialog";
import { copyText } from "../../lib/clipboard";
import { messageMenuEntries, messageMenuInput } from "./message-menu-entries";
import type { MessageMenuEntry } from "./message-menu-entries";
import { messageText } from "./message-rows";
import type { ChatController } from "./use-chat-controller";

export interface MessageMenuTarget {
  anchor: Rect;
  message: SessionMessageInfo;
}

type MessageMenuProps = Pick<
  ChatController,
  | "client"
  | "closeMessageMenu"
  | "editMessage"
  | "menuContext"
  | "messageMenuTarget"
  | "messages"
  | "onOpenSession"
  | "opencodeClient"
  | "actions"
  | "sessionID"
  | "setBackgroundDirectory"
  | "setBackgroundShellID"
  | "setPanel"
  | "setSelectedMessageID"
  | "setTextSelectionMessage"
  | "showError"
> & { session: SessionInfo };

const REVERT_MESSAGE =
  "The server will stage a revert of later messages and file changes. You can restore the staged changes.";

export const MessageMenu = ({
  closeMessageMenu,
  editMessage,
  menuContext,
  messageMenuTarget,
  messages,
  actions: chatActions,
  session,
  setBackgroundDirectory,
  setBackgroundShellID,
  setPanel,
  setSelectedMessageID,
  setTextSelectionMessage,
  showError,
}: MessageMenuProps) => {
  // The menu keeps showing the last target while it plays its exit animation.
  const [shown, setShown] = useState(messageMenuTarget);
  if (messageMenuTarget && messageMenuTarget !== shown) {
    setShown(messageMenuTarget);
  }
  const [afterClose, setAfterClose] = useState<(() => void) | null>(null);
  const items: AnchoredMenuItem[] = [];
  if (shown) {
    const { message } = shown;
    const text = messageText(message);
    const newestUser = messages.findLast((item) => item.type === "user");
    const queue = (action: () => void) => setAfterClose(() => action);
    const actions: Record<
      MessageMenuEntry,
      Omit<Extract<AnchoredMenuItem, { onSelect: unknown }>, "key">
    > = {
      commandOutput: {
        label: "Full command output",
        onSelect: () => {
          if (message.type !== "shell") {
            return;
          }
          const index = messages.findIndex((item) => item.id === message.id);
          const nextMove = messages
            .slice(index + 1)
            .find(
              (
                item
              ): item is Extract<
                SessionMessageInfo,
                { type: "location-switched" }
              > => item.type === "location-switched"
            );
          setBackgroundShellID(message.shellID);
          setBackgroundDirectory(
            nextMove?.previous?.location.directory ?? session.location.directory
          );
          queue(() => setPanel("background"));
        },
      },
      copy: {
        icon: "copy",
        label: "Copy",
        onSelect: () => {
          copyText(text).catch(showError);
        },
      },
      edit: {
        label: "Edit message",
        onSelect: () => {
          if (message.type === "user") {
            void editMessage(message);
          }
        },
      },
      fork: {
        label: "Fork from here",
        onSelect: () => {
          void chatActions.fork(message.id);
        },
      },
      revert: {
        destructive: true,
        label: newestUser?.id === message.id ? "Undo" : "Revert to here",
        onSelect: () => {
          void (async () => {
            const confirmed = await confirmAction(
              "Undo from this message?",
              REVERT_MESSAGE,
              { confirmLabel: "Revert", destructive: true }
            );
            if (confirmed) {
              await chatActions.stageRevert(message.id);
            }
          })();
        },
      },
      select: {
        label: "Select",
        onSelect: () => queue(() => setSelectedMessageID(message.id)),
      },
      selectText: {
        label: "Select text",
        onSelect: () => {
          setTextSelectionMessage(message);
          queue(() => setPanel("selectText"));
        },
      },
    };
    for (const entry of messageMenuEntries(
      messageMenuInput(message, text, menuContext)
    )) {
      if (entry === "revert") {
        items.push({ key: "revert-separator", type: "separator" });
      }
      items.push({ key: entry, ...actions[entry] });
    }
  }
  return (
    <AnchoredMenu
      visible={messageMenuTarget !== null}
      anchor={shown?.anchor ?? null}
      onClose={closeMessageMenu}
      onClosed={() => {
        setAfterClose(null);
        afterClose?.();
      }}
      accessibilityLabel="Message actions"
      items={items}
      placement="bottom-start"
    />
  );
};
