import type {
  SessionMessageAssistant,
  SessionMessageInfo,
} from "@opencode/client";
import { useCallback, useRef, useState } from "react";

import { noop } from "../../lib/async";
import type { ChatBackend } from "../../lib/chat-backend";
import type { SessionData } from "./use-session-data";

// Holds the chat state that has no query yet: the message list, which a later
// step moves into the query cache, and live stream status.
export const useSessionState = (backend: ChatBackend) => {
  const [messages, setMessages] = useState<SessionMessageInfo[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [streamFailure, setStreamFailure] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState("Connecting");
  const [activityNotice, setActivityNotice] = useState(backend.activityNotice);
  const [backendWaiting, setBackendWaiting] = useState<{
    kind: "approval" | "question";
    title: string;
  }>();
  const flushStreamRef = useRef<() => void>(noop);
  const liveMessagesRef = useRef(new Map<string, SessionMessageAssistant>());
  const historyEpochRef = useRef(1);
  const resetHistory = useCallback(() => {
    historyEpochRef.current += 1;
    liveMessagesRef.current.clear();
  }, []);
  return {
    activityNotice,
    backendWaiting,
    cursor,
    flushStreamRef,
    historyEpochRef,
    liveMessagesRef,
    messages,
    resetHistory,
    setActivityNotice,
    setBackendWaiting,
    setCursor,
    setMessages,
    setStreamFailure,
    setStreamStatus,
    streamFailure,
    streamStatus,
  };
};

export type MessageState = ReturnType<typeof useSessionState>;
export type SessionState = MessageState & SessionData;
