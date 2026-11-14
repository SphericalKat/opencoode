import type {
  SessionMessageAssistant,
  SessionMessageInfo,
} from "@opencode/client";
import React, { memo, useCallback, useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useContextMenu, useMenuAnchor } from "../../components/anchored-menu";
import { AssistantActivityPart as AssistantPart } from "../../components/assistant-turn";
import { ResponseFooter } from "../../components/response-footer";
import {
  AssistantErrorContext,
  AssistantErrorNotice,
  SessionErrorNotice,
} from "../../components/session-error";
import type { AssistantErrorContextValue } from "../../components/session-error";
import { Button, Disclosure, BodyText, mono } from "../../components/ui";
import { UserMessageBubble } from "../../components/user-message-bubble";
import type { AgentActivity } from "../../lib/activity";
import type { Client } from "../../lib/client";
import { playHaptic } from "../../lib/haptics";
import type { Rect } from "../../lib/menu-position";
import { MessageActionsContext } from "../../lib/message-actions";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { agentSwitchLabel, modelSwitchLabel } from "../../lib/transcript";
import { CodeBlock, MessageText } from "./controls";
import { messageMenuEntries, messageMenuInput } from "./message-menu-entries";
import type { MessageMenuContext } from "./message-menu-entries";
import { capitalizeFirst } from "./model-label";
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

export const messageText = (
  message: SessionMessageInfo,
  modelName?: string
): string => {
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
    return agentSwitchLabel(message.agent);
  }
  if (message.type === "model-switched") {
    return modelSwitchLabel(message, modelName).label;
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

const separatorStyles = StyleSheet.create({
  center: { alignItems: "center", flexDirection: "row", flexShrink: 1, gap: 6 },
  dot: { borderRadius: 1.125, height: 2.25, width: 2.25 },
  dotBox: {
    alignItems: "center",
    height: 6,
    justifyContent: "center",
    width: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "400",
    letterSpacing: -0.04,
    lineHeight: 16,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 16,
    paddingVertical: 4,
  },
});

const SwitchSeparator = ({
  label,
  variant,
}: {
  label: string;
  variant?: string;
}) => {
  const { colors } = useTheme();
  const labelStyle = [separatorStyles.label, { color: colors.faint }];
  return (
    <View style={separatorStyles.row}>
      <View
        style={[separatorStyles.line, { backgroundColor: colors.border }]}
      />
      <View style={separatorStyles.center}>
        <Text numberOfLines={1} style={[labelStyle, { flexShrink: 1 }]}>
          {label}
        </Text>
        {variant && (
          <>
            <View style={separatorStyles.dotBox}>
              <View
                style={[separatorStyles.dot, { backgroundColor: colors.faint }]}
              />
            </View>
            <Text numberOfLines={1} style={[labelStyle, { flexShrink: 0 }]}>
              {capitalizeFirst(variant)}
            </Text>
          </>
        )}
      </View>
      <View
        style={[separatorStyles.line, { backgroundColor: colors.border }]}
      />
    </View>
  );
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
    {message.error && (
      <AssistantErrorNotice error={message.error} selectable={selectable} />
    )}
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
  modelName,
  selectable,
}: {
  message: SessionMessageInfo;
  live?: boolean;
  activityKind?: AgentActivity["kind"];
  animate?: boolean;
  client?: Client;
  directory: string;
  modelName?: string;
  selectable: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  if (message.type === "idle") {
    return message.error ? (
      <SessionErrorNotice
        message={message.error.message}
        selectable={selectable}
      />
    ) : null;
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
        {"error" in message && (
          <SessionErrorNotice
            message={message.error.message}
            selectable={selectable}
          />
        )}
      </Disclosure>
    );
  }
  if (message.type === "agent-switched") {
    return <SwitchSeparator label={agentSwitchLabel(message.agent)} />;
  }
  if (message.type === "model-switched") {
    return <SwitchSeparator {...modelSwitchLabel(message, modelName)} />;
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
  menu?: MessageMenuContext;
  onMenu?: (id: string, anchor: Rect) => void;
  onSelect?: (id: string) => void;
  selected?: boolean;
  selectionActive?: boolean;
  screenReader?: boolean;
  client?: Client;
  directory: string;
  modelName?: string;
  providerName?: string;
  errorActions?: AssistantErrorContextValue["errorActions"];
}
export const MessageRowBody = ({
  message,
  sourceKey,
  children,
  live,
  activityKind,
  animate,
  menu,
  onMenu,
  onSelect,
  selected,
  selectionActive,
  screenReader,
  client,
  directory,
  modelName,
  providerName,
  errorActions,
}: MessageRowProps) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const hasEntries = useCallback(
    () =>
      !!menu &&
      messageMenuEntries(
        messageMenuInput(message, messageText(message, modelName), menu)
      ).length > 0,
    [menu, message, modelName]
  );
  const contextMenu = useContextMenu({
    canOpen: hasEntries,
    onOpen: (anchor) => onMenu?.(message.id, anchor),
  });
  const { measure: measureRow, ref: rowRef } = useMenuAnchor();
  const { measure: measureButton, ref: buttonRef } = useMenuAnchor();
  const { onLongPress: openAtPress, openAt } = contextMenu;
  const moveSelection = useCallback(() => {
    playHaptic("select");
    onSelect?.(message.id);
  }, [onSelect, message.id]);
  const openFromRow = useCallback(async () => {
    const { x, y } = await measureRow();
    openAt({ height: 0, width: 0, x, y });
  }, [measureRow, openAt]);
  const openFromButton = useCallback(async () => {
    openAt(await measureButton());
  }, [measureButton, openAt]);
  const longPress = selectionActive ? moveSelection : openAtPress;
  const errorContext = useMemo(
    () => ({ errorActions, providerName }),
    [errorActions, providerName]
  );
  const separateContent = screenReader || Platform.OS === "web";
  if (message.type === "idle" && !message.error) {
    return null;
  }
  if (!onMenu) {
    return (
      <AssistantErrorContext.Provider value={errorContext}>
        {children ?? (
          <MessageContent
            message={message}
            client={client}
            directory={directory}
            modelName={modelName}
            selectable
          />
        )}
      </AssistantErrorContext.Provider>
    );
  }
  return (
    <Pressable
      nativeID={`chat-message-${encodeURIComponent(message.id)}${sourceKey ? `:${encodeURIComponent(sourceKey)}` : ""}`}
      accessible={!separateContent}
      accessibilityRole={separateContent ? undefined : "button"}
      accessibilityLabel={separateContent ? undefined : messagePreview(message)}
      accessibilityHint={
        separateContent ? undefined : "Long press for message actions."
      }
      accessibilityState={
        separateContent ? undefined : { selected: !!selected }
      }
      accessibilityActions={
        separateContent
          ? undefined
          : [
              { label: "Message actions", name: "activate" },
              { label: "Message actions", name: "longpress" },
            ]
      }
      onAccessibilityAction={
        separateContent
          ? undefined
          : () => {
              if (selectionActive) {
                moveSelection();
                return;
              }
              void openFromRow();
            }
      }
      focusable={!screenReader}
      ref={rowRef}
      collapsable={false}
      onLongPress={longPress}
      onPress={selectionActive ? moveSelection : undefined}
      android_ripple={
        message.type === "user"
          ? undefined
          : { alpha: 0.12, color: colors.text, foreground: true }
      }
      style={styles.selectableMessage}
    >
      {selected && (
        <View
          pointerEvents="none"
          aria-hidden
          style={[styles.selectionMarker, { backgroundColor: colors.muted }]}
        />
      )}
      <AssistantErrorContext.Provider value={errorContext}>
        <MessageActionsContext.Provider value={longPress}>
          {children ?? (
            <MessageContent
              message={message}
              live={live}
              activityKind={activityKind}
              animate={animate}
              client={client}
              directory={directory}
              modelName={modelName}
              selectable={false}
            />
          )}
        </MessageActionsContext.Provider>
      </AssistantErrorContext.Provider>
      {screenReader && (
        <View ref={buttonRef} collapsable={false}>
          <Button
            title="Message actions"
            size="compact"
            variant="ghost"
            accessibilityLabel={`Message actions: ${messagePreview(message)}`}
            onPress={() => {
              if (selectionActive) {
                moveSelection();
                return;
              }
              void openFromButton();
            }}
          />
        </View>
      )}
    </Pressable>
  );
};
export const MessageRow = memo(MessageRowBody);
