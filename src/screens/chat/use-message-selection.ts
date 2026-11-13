import type { SessionMessageInfo } from "@opencode/client";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";

import { messageText } from "./message-rows";
import type { Panel, Alive, SetPanel } from "./types";

interface UseMessageSelectionOptions {
  alive: Alive;
  messages: SessionMessageInfo[];
  onSelectionChange: ((selected: boolean) => void) | undefined;
  panel: Panel;
  setPanel: SetPanel;
  showError: (reason: unknown) => void;
  visible: boolean;
}

export const useMessageSelection = ({
  alive,
  messages,
  onSelectionChange,
  panel,
  setPanel,
  showError,
  visible,
}: UseMessageSelectionOptions) => {
  const [selectedMessageID, setSelectedMessageID] = useState<string | null>(
    null
  );
  const [textSelectionMessage, setTextSelectionMessage] =
    useState<SessionMessageInfo | null>(null);
  useEffect(() => {
    if (Platform.OS !== "android" || !visible || !selectedMessageID) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setSelectedMessageID(null);
        return true;
      }
    );
    return () => subscription.remove();
  }, [visible, selectedMessageID]);
  useEffect(() => {
    if (Platform.OS !== "web" || !visible || !selectedMessageID || panel) {
      return;
    }
    const closeSelection = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      setSelectedMessageID(null);
    };
    document.addEventListener("keydown", closeSelection);
    return () => document.removeEventListener("keydown", closeSelection);
  }, [visible, selectedMessageID, panel]);
  if (
    selectedMessageID &&
    !messages.some((message) => message.id === selectedMessageID)
  ) {
    setSelectedMessageID(null);
    setPanel((current) =>
      current === "message" || current === "selectText" ? null : current
    );
  }
  useEffect(() => {
    onSelectionChange?.(visible && !!selectedMessageID);
    return () => onSelectionChange?.(false);
  }, [visible, selectedMessageID, onSelectionChange]);
  const actionMessage = selectedMessageID
    ? messages.find((message) => message.id === selectedMessageID)
    : undefined;
  const canCopySelected =
    actionMessage?.type === "assistant"
      ? actionMessage.content.some(
          (part) => part.type === "text" && !!part.text
        )
      : !!actionMessage;
  const copySelected = () => {
    if (actionMessage) {
      const messageID = actionMessage.id;
      const text = messageText(actionMessage);
      if (text) {
        void Clipboard.setStringAsync(text)
          .then((copied) => {
            if (alive.current) {
              setSelectedMessageID((current) =>
                current === messageID ? null : current
              );
            }
            return copied;
          })
          .catch(showError);
      }
    }
  };

  return {
    actionMessage,
    canCopySelected,
    copySelected,
    selectedMessageID,
    setSelectedMessageID,
    setTextSelectionMessage,
    textSelectionMessage,
  };
};
