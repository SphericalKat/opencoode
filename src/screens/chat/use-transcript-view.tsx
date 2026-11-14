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
import { withoutReverted } from "../../lib/chat";
import type { Rect } from "../../lib/menu-position";
import type { MessageMenuContext } from "./message-menu-entries";
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
  menu: MessageMenuContext;
  openMessageMenu: (id: string, anchor: Rect) => void;
  opencodeClient: OpenCodeClient;
  screenReader: boolean;
  selectedMessageID: string | null;
  setSelectedMessageID: (id: string) => void;
  sessionID: string;
  stopping: boolean;
  visible: boolean;
  sync: SessionState;
}

export const useTranscriptView = ({
  awayFromLatest,
  followingLatest,
  foreground,
  menu,
  openMessageMenu,
  opencodeClient,
  screenReader,
  selectedMessageID,
  sessionID,
  setSelectedMessageID,
  stopping,
  visible,
  sync,
}: UseTranscriptViewOptions) => {
  const {
    session,
    messages: loadedMessages,
    forms,
    permissions,
    active,
    sessionStatus,
    streamStatus,
    backendWaiting,
  } = sync;
  const revertMessageID = session?.revert?.messageID;
  const messages = useMemo(
    () => withoutReverted(loadedMessages, revertMessageID),
    [loadedMessages, revertMessageID]
  );
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
        menu={menu}
        onMenu={openMessageMenu}
        onSelect={setSelectedMessageID}
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
      menu,
      openMessageMenu,
      setSelectedMessageID,
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
          menu={menu}
          onMenu={openMessageMenu}
          onSelect={setSelectedMessageID}
          selected={item.id === selectedMessageID}
          selectionActive={!!selectedMessageID}
          screenReader={screenReader}
          client={opencodeClient}
          directory={messageDirectory}
        />
      ),
    [
      renderSource,
      menu,
      openMessageMenu,
      setSelectedMessageID,
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
