import type {
  SessionMessageAssistant,
  SessionMessageInfo,
} from "@opencode/client";
import React, { memo, useCallback } from "react";
import { Image, Platform, Pressable, View } from "react-native";

import { AssistantActivityPart as AssistantPart } from "../../components/assistant-turn";
import { ResponseFooter } from "../../components/response-footer";
import {
  Button,
  Disclosure,
  ErrorNotice,
  BodyText,
  mono,
} from "../../components/ui";
import { UserMessageBubble } from "../../components/user-message-bubble";
import type { AgentActivity } from "../../lib/activity";
import type { Client } from "../../lib/client";
import { playHaptic } from "../../lib/haptics";
import { MessageActionsContext } from "../../lib/message-actions";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { CodeBlock, MessageText } from "./controls";
import { createStyles } from "./styles";

export const CompletedAssistantFooter = ({
  message,
}: {
  message: SessionMessageAssistant;
}) => {
  const elapsed =
    message.time.completed === undefined
      ? undefined
      : Math.max(
          0,
          Math.round((message.time.completed - message.time.created) / 1000)
        );
  return (
    <ResponseFooter
      text={message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n\n")}
      elapsedSeconds={elapsed}
    />
  );
};

export const messageText = (message: SessionMessageInfo): string => {
  if ("text" in message) {
    return message.text;
  }
  if (message.type === "assistant") {
    return message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n");
  }
  if (message.type === "shell") {
    return `$ ${message.command}${message.output?.output ? `\n${message.output.output}` : ""}`;
  }
  if (message.type === "compaction") {
    if ("summary" in message) {
      return message.summary;
    }
    return "error" in message ? message.error.message : "Context compaction";
  }
  if (message.type === "agent-switched") {
    return `Agent: ${message.agent}`;
  }
  if (message.type === "model-switched") {
    return `Model: ${message.model.id}`;
  }
  if (message.type === "location-switched") {
    return `Directory: ${message.location.directory}`;
  }
  return message.error?.message || message.outcome;
};

export const messagePreview = (message: SessionMessageInfo): string => {
  if (message.type === "assistant") {
    const first = message.content.find((part) => part.type === "text");
    return first?.type === "text" && first.text
      ? first.text.slice(0, 240)
      : "Assistant message";
  }
  return messageText(message).slice(0, 240);
};

export const renderAssistantMessage = ({
  message,
  live,
  activityKind,
  animate,
  client,
  directory,
  selectable,
  styles,
}: {
  message: SessionMessageAssistant;
  live?: boolean;
  activityKind?: AgentActivity["kind"];
  animate?: boolean;
  client?: Client;
  directory: string;
  selectable: boolean;
  styles: ReturnType<typeof createStyles>;
}) => (
  <View style={styles.assistant}>
    {message.content.map((part, index) => (
      <AssistantPart
        key={`${message.id}:${part.type === "tool" ? part.id : index}`}
        detailsKey={`${message.id}:${part.type === "tool" ? part.id : index}`}
        part={part}
        live={
          !!live &&
          (part.type === "tool" || index === message.content.length - 1)
        }
        activityKind={activityKind}
        animate={animate}
        client={client}
        directory={directory}
        selectable={selectable}
      />
    ))}
    {message.error && <ErrorNotice error={message.error.message} />}
    {!live &&
      message.content.some(
        (part) => part.type === "text" && !!part.text.trim()
      ) && <CompletedAssistantFooter key={message.id} message={message} />}
  </View>
);

export const renderUserMessage = (
  message: Extract<SessionMessageInfo, { type: "user" }>,
  selectable: boolean
) => (
  <UserMessageBubble withAttachments={!!message.files?.length}>
    <MessageText text={message.text} selectable={selectable} />
    {message.files?.map((file, index) => (
      <View key={index} style={{ gap: 8 }}>
        <BodyText muted style={{ fontFamily: mono, fontSize: 13 }}>
          ↳ {file.name || file.mime}
        </BodyText>
        {file.mime.startsWith("image/") && (
          <Image
            source={{ uri: `data:${file.mime};base64,${file.data}` }}
            style={{ borderRadius: 10, height: 180, width: "100%" }}
            resizeMode="contain"
            accessibilityLabel={file.name || "Attached image"}
          />
        )}
      </View>
    ))}
    {message.skills?.map((skill) => (
      <BodyText key={skill.id} muted>
        Skill: {skill.name}
      </BodyText>
    ))}
  </UserMessageBubble>
);

export const MessageContentBody = ({
  message,
  live,
  activityKind,
  animate,
  client,
  directory,
  selectable,
}: {
  message: SessionMessageInfo;
  live?: boolean;
  activityKind?: AgentActivity["kind"];
  animate?: boolean;
  client?: Client;
  directory: string;
  selectable: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  if (message.type === "idle") {
    return message.error ? <ErrorNotice error={message.error.message} /> : null;
  }
  if (message.type === "assistant") {
    return renderAssistantMessage({
      activityKind,
      animate,
      client,
      directory,
      live,
      message,
      selectable,
      styles,
    });
  }
  if (message.type === "user") {
    return renderUserMessage(message, selectable);
  }
  if (message.type === "shell") {
    return (
      <Disclosure
        disclosureKey={message.id}
        title={`$ ${message.command} · ${message.status}`}
      >
        <CodeBlock
          code={message.output?.output || "No output"}
          selectable={selectable}
        />
        {message.output?.truncated && (
          <BodyText muted>Output truncated by the server</BodyText>
        )}
      </Disclosure>
    );
  }
  if (message.type === "compaction") {
    return (
      <Disclosure
        disclosureKey={message.id}
        title={`Context compaction · ${message.status}`}
      >
        {"summary" in message && (
          <MessageText text={message.summary} selectable={selectable} />
        )}
        {"error" in message && <ErrorNotice error={message.error.message} />}
      </Disclosure>
    );
  }
  if (message.type === "agent-switched") {
    return (
      <BodyText muted style={styles.notice}>
        Agent → {message.agent}
      </BodyText>
    );
  }
  if (message.type === "model-switched") {
    return (
      <BodyText muted style={styles.notice}>
        Model → {message.model.id}
        {message.model.variant ? ` · ${message.model.variant}` : ""}
      </BodyText>
    );
  }
  if (message.type === "location-switched") {
    return (
      <BodyText muted style={styles.notice}>
        Directory → {message.location.directory}
      </BodyText>
    );
  }
  if (message.type === "skill") {
    return (
      <Disclosure disclosureKey={message.id} title={`Skill · ${message.name}`}>
        <MessageText text={message.text} selectable={selectable} />
      </Disclosure>
    );
  }
  return (
    <Disclosure
      disclosureKey={message.id}
      title={message.description || message.type}
    >
      <MessageText text={message.text} selectable={selectable} />
    </Disclosure>
  );
};
export const MessageContent = memo(MessageContentBody);

export interface MessageRowProps {
  message: SessionMessageInfo;
  sourceKey?: string;
  children?: React.ReactNode;
  live?: boolean;
  activityKind?: AgentActivity["kind"];
  animate?: boolean;
  onSelect?: (id: string) => void;
  selected?: boolean;
  selectionActive?: boolean;
  screenReader?: boolean;
  client?: Client;
  directory: string;
}
export const MessageRowBody = ({
  message,
  sourceKey,
  children,
  live,
  activityKind,
  animate,
  onSelect,
  selected,
  selectionActive,
  screenReader,
  client,
  directory,
}: MessageRowProps) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const select = useCallback(() => {
    playHaptic("longPress");
    onSelect?.(message.id);
  }, [onSelect, message.id]);
  const separateContent = screenReader || Platform.OS === "web";
  if (message.type === "idle" && !message.error) {
    return null;
  }
  if (!onSelect) {
    return (
      children ?? (
        <MessageContent
          message={message}
          client={client}
          directory={directory}
          selectable
        />
      )
    );
  }
  return (
    <Pressable
      nativeID={`chat-message-${encodeURIComponent(message.id)}${sourceKey ? `:${encodeURIComponent(sourceKey)}` : ""}`}
      accessible={!separateContent}
      accessibilityRole={separateContent ? undefined : "button"}
      accessibilityLabel={separateContent ? undefined : messagePreview(message)}
      accessibilityHint={
        separateContent
          ? undefined
          : "Long press to select this message. Message actions appear in the header."
      }
      accessibilityState={
        separateContent ? undefined : { selected: !!selected }
      }
      accessibilityActions={
        separateContent
          ? undefined
          : [
              { label: "Select message", name: "activate" },
              { label: "Select message", name: "longpress" },
            ]
      }
      onAccessibilityAction={
        separateContent ? undefined : () => onSelect(message.id)
      }
      focusable={!screenReader}
      onLongPress={select}
      onPress={selectionActive ? () => onSelect(message.id) : undefined}
      android_ripple={{ alpha: 0.12, color: colors.text, foreground: true }}
      style={styles.selectableMessage}
    >
      {selected && (
        <View
          pointerEvents="none"
          aria-hidden
          style={[styles.selectionMarker, { backgroundColor: colors.muted }]}
        />
      )}
      <MessageActionsContext.Provider value={select}>
        {children ?? (
          <MessageContent
            message={message}
            live={live}
            activityKind={activityKind}
            animate={animate}
            client={client}
            directory={directory}
            selectable={false}
          />
        )}
      </MessageActionsContext.Provider>
      {screenReader && (
        <Button
          title="Message actions"
          compact
          variant="ghost"
          accessibilityLabel={`Message actions: ${messagePreview(message)}`}
          onPress={() => onSelect(message.id)}
        />
      )}
    </Pressable>
  );
};
export const MessageRow = memo(MessageRowBody);
