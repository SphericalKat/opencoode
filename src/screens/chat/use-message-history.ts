import type { SessionMessageInfo } from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { mergeMessages } from "../../lib/chat";
import type { ChatBackend } from "../../lib/chat-backend";
import { sessionMessagesOptions } from "../../lib/queries/messages";
import { useServerScope } from "../../lib/server-scope";
import { nextCursor } from "./session-sync";
import type { MessageState } from "./use-session-state";

interface UseMessageHistoryOptions {
  backend: ChatBackend;
  sessionID: string;
  state: MessageState;
}

// Loads the newest page of messages through the query cache and merges it into
// the message list. A later step moves the list itself into the cache.
export const useMessageHistory = ({
  backend,
  sessionID,
  state,
}: UseMessageHistoryOptions) => {
  const scope = useServerScope();
  const { flushStreamRef, historyEpochRef, liveMessagesRef, setCursor } = state;
  const { setMessages } = state;
  const appliedEpochRef = useRef(0);
  const page = useQuery(
    sessionMessagesOptions(scope, backend.core, sessionID, flushStreamRef)
  );
  const applyMessageSnapshot = useCallback(
    (snapshot: SessionMessageInfo[], reset = false) => {
      setMessages((current) => {
        for (const message of snapshot) {
          const live = liveMessagesRef.current.get(message.id);
          if (
            message.type === "assistant" &&
            live?.time.completed &&
            message.time.completed &&
            message.time.completed >= live.time.completed
          ) {
            liveMessagesRef.current.delete(message.id);
          }
        }
        return mergeMessages(reset ? [] : current, snapshot, [
          ...liveMessagesRef.current.values(),
        ]);
      });
    },
    [liveMessagesRef, setMessages]
  );
  const { data } = page;
  useEffect(() => {
    if (!data) {
      return;
    }
    const reset = historyEpochRef.current !== appliedEpochRef.current;
    applyMessageSnapshot(data.data, reset);
    if (reset) {
      setCursor(nextCursor(data));
      appliedEpochRef.current = historyEpochRef.current;
    }
  }, [applyMessageSnapshot, data, historyEpochRef, setCursor]);
  return {
    applyMessageSnapshot,
    messagesError: page.error,
    messagesPending: page.isPending,
  };
};
