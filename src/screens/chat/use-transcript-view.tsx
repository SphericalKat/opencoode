import type {
  SessionMessageAssistant,
  SessionMessageInfo,
} from "@opencode/client";
import React, { useCallback, useMemo } from "react";

import {
  AssistantTurn,
  groupTranscriptMessages,
} from "../../components/assistant-turn";
import type { TranscriptItem } from "../../components/assistant-turn";
import { sessionActivity } from "../../lib/activity";
import type { AgentActivity } from "../../lib/activity";
import { MessageRow } from "./message-rows";
import type { OpenCodeClient } from "./session-sync";
import type { SessionState } from "./use-session-state";

const createTranscriptGrouper = () => {
  const previous = { items: [] as TranscriptItem[] };
  return (messages: SessionMessageInfo[]) => {
    previous.items = groupTranscriptMessages(messages, previous.items);
    return previous.items;
  };
};

interface UseTranscriptViewOptions {
  awayFromLatest: boolean;
  followingLatest: boolean;
  foreground: boolean;
  opencodeClient: OpenCodeClient;
  screenReader: boolean;
  selectMessage: (id: string) => void;
  selectedMessageID: string | null;
  sessionID: string;
  stopping: boolean;
  visible: boolean;
  sync: SessionState;
}

export const useTranscriptView = ({
  awayFromLatest,
  followingLatest,
  foreground,
  opencodeClient,
  screenReader,
  selectMessage,
  selectedMessageID,
  sessionID,
  stopping,
  visible,
  sync,
}: UseTranscriptViewOptions) => {
  const {
    session,
    messages,
    forms,
    permissions,
    active,
    sessionStatus,
    streamStatus,
    backendWaiting,
  } = sync;
  const activity = useMemo<AgentActivity>(
    () =>
      backendWaiting
        ? { kind: backendWaiting.kind, label: backendWaiting.title }
        : sessionActivity(
            messages,
            active,
            sessionStatus,
            permissions.filter(
              (permission) => permission.sessionID === sessionID
            ).length,
            forms.filter((form) => form.sessionID === sessionID).length
          ),
    [
      messages,
      active,
      sessionStatus,
      permissions,
      forms,
      sessionID,
      backendWaiting,
    ]
  );
  const showActivityBar =
    streamStatus !== "Live" ||
    stopping ||
    ["retry", "approval", "question", "error"].includes(activity.kind);
  const showLatestControl =
    !followingLatest &&
    awayFromLatest &&
    !["approval", "question"].includes(activity.kind);
  const latestStep = messages.findLast((message) =>
    ["assistant", "idle", "user", "shell", "compaction"].includes(message.type)
  );
  const liveMessageID =
    active &&
    latestStep?.type === "assistant" &&
    latestStep.time.completed === undefined &&
    !latestStep.error
      ? latestStep.id
      : undefined;
  const messageDirectory = session?.location.directory || "";
  const groupTranscript = useMemo(() => createTranscriptGrouper(), []);
  const transcriptMessages = useMemo(
    () => groupTranscript(messages),
    [groupTranscript, messages]
  );
  const renderSource = useCallback(
    (
      message: SessionMessageAssistant,
      sourceKey: string,
      content: React.ReactNode
    ) => (
      <MessageRow
        key={sourceKey}
        sourceKey={sourceKey}
        message={message}
        onSelect={selectMessage}
        selected={message.id === selectedMessageID}
        selectionActive={!!selectedMessageID}
        screenReader={screenReader}
        client={opencodeClient}
        directory={messageDirectory}
      >
        {content}
      </MessageRow>
    ),
    [
      selectMessage,
      selectedMessageID,
      screenReader,
      opencodeClient,
      messageDirectory,
    ]
  );
  const renderMessage = useCallback(
    ({ item }: { item: TranscriptItem }) =>
      item.type === "assistant-turn" ? (
        <AssistantTurn
          key={item.id}
          turn={item}
          liveMessageID={liveMessageID}
          activityKind={activity.kind}
          animate={visible && foreground && streamStatus === "Live"}
          client={opencodeClient}
          directory={messageDirectory}
          renderSource={renderSource}
        />
      ) : (
        <MessageRow
          message={item.message}
          animate={visible && foreground && streamStatus === "Live"}
          onSelect={selectMessage}
          selected={item.id === selectedMessageID}
          selectionActive={!!selectedMessageID}
          screenReader={screenReader}
          client={opencodeClient}
          directory={messageDirectory}
        />
      ),
    [
      renderSource,
      selectMessage,
      selectedMessageID,
      screenReader,
      opencodeClient,
      messageDirectory,
      liveMessageID,
      activity.kind,
      visible,
      foreground,
      streamStatus,
    ]
  );
  return {
    activity,
    renderMessage,
    showActivityBar,
    showLatestControl,
    transcriptMessages,
  };
};
