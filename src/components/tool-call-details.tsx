import type {
  JsonValue,
  SessionMessageAssistantTool,
  ToolContent,
} from "@opencode/client";
import React, {
  memo,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { copyText } from "../lib/clipboard";
import { withAlpha } from "../lib/color";
import { MessageActionsContext } from "../lib/message-actions";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { ArtifactContent, isImageArtifact } from "./artifact-content";
import { IconButton } from "./icon-button";
import { SessionErrorNotice } from "./session-error";
import { BodyText, mono, touchTarget } from "./ui";

type Arguments = Record<string, JsonValue>;
interface Section {
  copy: string;
  diff?: boolean;
  display: string;
  text: string;
}
type LineKind = "added" | "removed";
const textPageSize = 24_000;
const sectionMaxHeight = 240;
const sectionPadding = 12;
const copiedMs = 2000;
const copyBackgroundAlpha = 0.92;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    added: { backgroundColor: colors.successBackground, color: colors.success },
    body: { gap: 10, minWidth: 0 },
    card: {
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: 8,
      marginTop: 2,
      overflow: "hidden",
    },
    content: { padding: sectionPadding },
    copy: { position: "absolute", right: 4, top: 4 },
    copyError: {
      color: colors.danger,
      fontSize: 12,
      lineHeight: 17,
      padding: 8,
    },
    inputSection: { backgroundColor: colors.bg },
    inputText: {
      color: colors.text,
      fontFamily: mono,
      fontSize: 13,
      lineHeight: 20,
    },
    more: { justifyContent: "center", minHeight: touchTarget },
    outputSection: {
      backgroundColor: colors.panel,
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    outputText: {
      color: colors.muted,
      fontFamily: mono,
      fontSize: 13,
      lineHeight: 20,
    },
    pending: {
      color: colors.faint,
      fontSize: 13,
      lineHeight: 16,
      padding: sectionPadding,
    },
    removed: { backgroundColor: colors.dangerBackground, color: colors.danger },
    viewport: { maxHeight: sectionMaxHeight },
  });

const nameOf = (name: string): string =>
  name
    .replace(/^.*[.:]/u, "")
    .replaceAll(/[_-]/gu, "")
    .toLowerCase();

const toolNames: Record<string, string> = {
  applypatch: "Patch",
  bash: "Shell",
  edit: "Edit",
  editfile: "Edit",
  execute: "Execute",
  fetch: "Web fetch",
  glob: "Glob",
  grep: "Grep",
  list: "List",
  ls: "List",
  patch: "Patch",
  read: "Read",
  readfile: "Read",
  shell: "Shell",
  subagent: "Agent",
  task: "Task",
  webfetch: "Web fetch",
  websearch: "Web search",
  write: "Write",
  writefile: "Write",
};

export const toolDisplayName = (name: string): string =>
  toolNames[nameOf(name)] ??
  name.replace(/^.*[.:]/u, "").replaceAll(/[_-]/gu, " ");

const text = (
  input: Arguments | undefined,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = input?.[key];
    if (typeof value === "string" && value.length) {
      return value;
    }
  }
};

const optionalString = (
  input: Arguments,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string") {
      return value;
    }
  }
};

export const toolDetail = (
  tool: SessionMessageAssistantTool
): string | undefined => {
  if (tool.state.status === "streaming") {
    return;
  }
  return text(
    tool.state.input,
    "description",
    "command",
    "filePath",
    "file_path",
    "path",
    "pattern",
    "url",
    "query"
  );
};

const lineKind = (line: string): LineKind | undefined => {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return "added";
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return "removed";
  }
};

const prefixLines = (value: string, prefix: string): string =>
  value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");

const editInput = (
  input: Arguments,
  metadata?: Arguments
): string | undefined => {
  const diff =
    text(metadata, "diff", "patch") ??
    text(input, "diff", "patch", "patchText");
  if (diff) {
    return diff;
  }
  const before = optionalString(
    input,
    "oldText",
    "old_text",
    "oldString",
    "old_string"
  );
  const after = optionalString(
    input,
    "newText",
    "new_text",
    "newString",
    "new_string"
  );
  const parts = [
    ...(before === undefined ? [] : [prefixLines(before, "-")]),
    ...(after === undefined ? [] : [prefixLines(after, "+")]),
  ];
  return parts.length ? parts.join("\n") : undefined;
};

const webFetchInput = (input: Arguments): string | undefined => {
  const url = text(input, "url");
  const prompt = text(input, "prompt");
  if (url && prompt) {
    return `${url}\n\n${prompt}`;
  }
  return url ?? prompt;
};

const noInputTools = new Set(["Read", "List", "Glob", "Grep"]);

const plain = (value: string | undefined): Section | undefined =>
  value === undefined
    ? undefined
    : { copy: "Copy input", display: value, text: value };

const inputSection = (
  name: string,
  input: Arguments,
  metadata?: Arguments
): Section | undefined => {
  const tool = toolNames[nameOf(name)];
  if (tool && noInputTools.has(tool)) {
    return;
  }
  switch (tool) {
    case "Shell": {
      const command = text(input, "command", "cmd");
      return command
        ? {
            copy: "Copy command",
            display: `$ ${command}`,
            text: command,
          }
        : undefined;
    }
    case "Edit":
    case "Patch": {
      const edit = editInput(input, metadata);
      return edit === undefined
        ? undefined
        : { copy: "Copy input", diff: true, display: edit, text: edit };
    }
    case "Write": {
      return plain(optionalString(input, "content", "text"));
    }
    case "Web fetch": {
      return plain(webFetchInput(input));
    }
    case "Web search": {
      return plain(text(input, "query"));
    }
    case "Execute": {
      return plain(text(input, "code", "command"));
    }
    case "Agent":
    case "Task": {
      return plain(text(input, "prompt", "task", "description"));
    }
    default: {
      return plain(JSON.stringify(input, null, 2));
    }
  }
};

const CopyControl = ({
  value,
  label,
  background,
}: {
  value: string;
  label: string;
  background: string;
}) => {
  const styles = useThemedStyles(createStyles);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <View style={styles.copy}>
      <IconButton
        accessibilityLabel={copied ? "Copied" : label}
        icon={copied ? "check" : "copy"}
        onPress={() => {
          void copyText(value)
            .then(() => {
              setCopied(true);
              setError(undefined);
              clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopied(false), copiedMs);
              return null;
            })
            .catch((error_) => setError(errorMessage(error_)));
        }}
        size={24}
        style={{ backgroundColor: withAlpha(background, copyBackgroundAlpha) }}
      />
      {error && (
        <BodyText accessibilityRole="alert" style={styles.copyError}>
          {error}
        </BodyText>
      )}
    </View>
  );
};

const lineStyle = (line: string, styles: ReturnType<typeof createStyles>) => {
  const kind = lineKind(line);
  if (kind === "added") {
    return styles.added;
  }
  if (kind === "removed") {
    return styles.removed;
  }
};

const CodeSection = ({
  section,
  output,
  selectable,
  background,
}: {
  section: Section;
  output?: boolean;
  selectable: boolean;
  background: string;
}) => {
  const styles = useThemedStyles(createStyles);
  const actions = useContext(MessageActionsContext);
  const [limit, setLimit] = useState(textPageSize);
  const shown = section.display.slice(0, limit);
  const lines = useMemo(
    () => (section.diff ? shown.split("\n") : undefined),
    [section.diff, shown]
  );
  return (
    <View style={output ? styles.outputSection : styles.inputSection}>
      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.viewport}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text
          selectable={selectable}
          onLongPress={
            !selectable && Platform.OS !== "web" ? actions : undefined
          }
          style={output ? styles.outputText : styles.inputText}
        >
          {lines
            ? lines.map((line, index) => (
                <Text key={index} style={lineStyle(line, styles)}>
                  {line}
                  {index < lines.length - 1 ? "\n" : ""}
                </Text>
              ))
            : shown}
        </Text>
        {section.display.length > limit && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Show more text"
            onPress={(event) => {
              event.stopPropagation();
              setLimit((current) => current + textPageSize);
            }}
            style={styles.more}
          >
            <BodyText muted>
              Show more text (
              {(section.display.length - limit).toLocaleString()} characters
              left)
            </BodyText>
          </Pressable>
        )}
      </ScrollView>
      <CopyControl
        background={background}
        label={section.copy}
        value={section.text}
      />
    </View>
  );
};

const ToolCallDetailsView = ({
  tool,
  client,
  directory,
  selectable,
}: {
  tool: SessionMessageAssistantTool;
  client?: Client;
  directory: string;
  selectable: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { state } = tool;
  const input = state.status === "streaming" ? undefined : state.input;
  const metadata = "metadata" in state ? state.metadata : undefined;
  const section = useMemo(
    () => (input ? inputSection(tool.name, input, metadata) : undefined),
    [tool.name, input, metadata]
  );
  const content: ToolContent[] =
    "content" in state ? (state.content ?? []) : [];
  const outputs = content
    .filter((item) => item.type === "text")
    .map((item) => item.text);
  if (state.status === "running" && typeof state.metadata.output === "string") {
    outputs.push(state.metadata.output);
  }
  const output = outputs.join("\n\n");
  const files = content
    .filter((item) => item.type === "file")
    .filter((item) => !isImageArtifact(item));
  const streaming = state.status === "streaming";
  const showCard = !!section || !!output || streaming;
  return (
    <View style={styles.body}>
      {showCard && (
        <View style={styles.card}>
          {section && (
            <CodeSection
              background={colors.bg}
              section={section}
              selectable={selectable}
            />
          )}
          {streaming && (
            <BodyText style={styles.pending}>Receiving tool arguments</BodyText>
          )}
          {!!output && (
            <CodeSection
              background={colors.panel}
              section={{ copy: "Copy output", display: output, text: output }}
              output
              selectable={selectable}
            />
          )}
        </View>
      )}
      {files.map((file, index) => (
        <ArtifactContent
          key={`${file.uri}:${index}`}
          content={file}
          client={client}
          directory={directory}
        />
      ))}
      {state.status === "error" && (
        <SessionErrorNotice message={state.error.message} selectable />
      )}
    </View>
  );
};

export const ToolCallDetails = memo(ToolCallDetailsView);
