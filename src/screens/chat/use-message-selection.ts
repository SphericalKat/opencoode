import type { SessionMessageInfo } from "@opencode/client";
import { useEffect, useState } from "react";
import { BackHandler, Platform } from "react-native";

import { copyText } from "../../lib/clipboard";
import { useChatUiStoreApi } from "../../stores/chat-ui-store";
import { messageText } from "./message-rows";
import type { Panel, Alive, SetPanel } from "./types";

interface UseMessageSelectionOptions {
  alive: Alive;
  messages: SessionMessageInfo[];
  panel: Panel;
  setPanel: SetPanel;
  showError: (reason: unknown) => void;
  visible: boolean;
}

export const useMessageSelection = ({
  alive,
  messages,
  panel,
  setPanel,
  showError,
  visible,
}: UseMessageSelectionOptions) => {
  const chatUi = useChatUiStoreApi();
  const [selectedMessageID, setSelectedMessageID] = useState<string | null>(
    null
  );
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
    setPanel((current) => (current === "selectText" ? null : current));
  }
  useEffect(() => {
    chatUi.setState({ messageSelected: visible && !!selectedMessageID });
    return () => chatUi.setState({ messageSelected: false });
  }, [visible, selectedMessageID, chatUi]);
  const actionMessage = selectedMessageID
    ? messages.find((message) => message.id === selectedMessageID)
    : undefined;
  const copySelected = () => {
    if (actionMessage) {
      const messageID = actionMessage.id;
      const text = messageText(actionMessage);
      if (text) {
        void copyText(text)
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
    copySelected,
    selectedMessageID,
    setSelectedMessageID,
  };
};
