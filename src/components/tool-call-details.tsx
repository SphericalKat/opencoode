import type {
  JsonValue,
  SessionMessageAssistantTool,
  ToolContent,
} from "@opencode/client";
import * as Clipboard from "expo-clipboard";
import React, { memo, useContext, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { MessageActionsContext } from "../lib/message-actions";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { ArtifactContent, isImageArtifact } from "./artifact-content";
import { Disclosure, ErrorNotice, BodyText, mono, touchTarget } from "./ui";

type Arguments = Record<string, JsonValue>;
interface Section {
  label?: string;
  text: string;
  diff?: boolean;
}
const textPageSize = 24_000;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    added: { backgroundColor: colors.successBackground, color: colors.success },
    body: { gap: 10, minWidth: 0 },
    code: {
      color: colors.text,
      fontFamily: mono,
      fontSize: 13,
      lineHeight: 20,
    },
    codeContent: { gap: 8, padding: 12, paddingTop: 8 },
    codeRow: { alignItems: "flex-start", flexDirection: "row" },
    copyAction: { flexShrink: 0, maxWidth: 160 },
    copyError: {
      color: colors.danger,
      fontSize: 12,
      lineHeight: 17,
      padding: 8,
    },
    copyTarget: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: touchTarget,
      width: touchTarget,
    },
    divider: { borderTopColor: colors.border, borderTopWidth: 1 },
    more: { justifyContent: "center", minHeight: touchTarget },
    output: { backgroundColor: colors.bg },
    panel: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      overflow: "hidden",
    },
    pending: { fontSize: 13, lineHeight: 19, padding: 12 },
    removed: { backgroundColor: colors.dangerBackground, color: colors.danger },
    sectionHeader: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: touchTarget,
      paddingLeft: 12,
    },
    sectionLabel: { fontSize: 12, lineHeight: 17 },
    viewport: { flex: 1, maxHeight: 200 },
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

const editSections = (
  file: Section[],
  input: Arguments,
  metadata?: Arguments
): Section[] => {
  const diff =
    text(metadata, "diff", "patch") ??
    text(input, "diff", "patch", "patchText");
  if (diff) {
    return [...file, { diff: true, label: "Diff", text: diff }];
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
  return [
    ...file,
    ...(before === undefined ? [] : [{ label: "Before", text: before }]),
    ...(after === undefined ? [] : [{ label: "After", text: after }]),
  ];
};

const writeSections = (file: Section[], input: Arguments): Section[] => {
  const content = optionalString(input, "content", "text");
  return [
    ...file,
    ...(content === undefined ? [] : [{ label: "Content", text: content }]),
  ];
};

const searchSections = (input: Arguments, path?: string): Section[] => {
  const pattern = text(input, "pattern", "query");
  return [
    ...(pattern ? [{ label: "Pattern", text: pattern }] : []),
    ...(path ? [{ label: "Directory", text: path }] : []),
  ];
};

const webFetchSections = (input: Arguments): Section[] => {
  const url = text(input, "url");
  const prompt = text(input, "prompt");
  return [
    ...(url ? [{ label: "URL", text: url }] : []),
    ...(prompt ? [{ label: "Request", text: prompt }] : []),
  ];
};

const inputSections = (
  name: string,
  input: Arguments,
  metadata?: Arguments
): Section[] => {
  const path = text(input, "filePath", "file_path", "path");
  const file = path ? [{ label: "File", text: path }] : [];
  switch (toolNames[nameOf(name)]) {
    case "Shell": {
      const command = text(input, "command", "cmd");
      return command ? [{ text: command }] : [];
    }
    case "Read":
    case "List": {
      return file;
    }
    case "Edit":
    case "Patch": {
      return editSections(file, input, metadata);
    }
    case "Write": {
      return writeSections(file, input);
    }
    case "Glob":
    case "Grep": {
      return searchSections(input, path);
    }
    case "Web fetch": {
      return webFetchSections(input);
    }
    case "Web search": {
      const query = text(input, "query");
      return query ? [{ label: "Search", text: query }] : [];
    }
    case "Execute": {
      const code = text(input, "code", "command");
      return code ? [{ label: "Code", text: code }] : [];
    }
    case "Agent":
    case "Task": {
      const prompt = text(input, "prompt", "task", "description");
      return prompt ? [{ label: "Task", text: prompt }] : [];
    }
    default: {
      return [];
    }
  }
};

const CopyAction = ({ value, label }: { value: string; label: string }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [copiedFor, setCopiedFor] = useState(value);
  if (copiedFor !== value) {
    setCopiedFor(value);
    setCopied(false);
    setError(undefined);
  }
  return (
    <View style={styles.copyAction}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copied ? "Copied" : label}
        onPress={(event) => {
          event.stopPropagation();
          void Clipboard.setStringAsync(value)
            .then(() => {
              setCopied(true);
              setError(undefined);
              return null;
            })
            .catch((error_) => setError(errorMessage(error_)));
        }}
        onLongPress={(event) => event.stopPropagation()}
        style={({ pressed }) => [
          styles.copyTarget,
          pressed && { opacity: 0.6 },
        ]}
      >
        <Svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
          {copied ? (
            <Path
              d="m3 8 3 3 7-7"
              stroke={colors.muted}
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <>
              <Rect
                x={2}
                y={5}
                width={9}
                height={9}
                rx={1.5}
                stroke={colors.muted}
              />
              <Path
                d="M5 5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-2"
                stroke={colors.muted}
              />
            </>
          )}
        </Svg>
      </Pressable>
      {error && (
        <BodyText accessibilityRole="alert" style={styles.copyError}>
          {error}
        </BodyText>
      )}
    </View>
  );
};

const diffLineStyle = (
  line: string,
  styles: ReturnType<typeof createStyles>
) => {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return styles.added;
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return styles.removed;
  }
};

const CodeSection = ({
  section,
  output,
  divided,
  selectable,
}: {
  section: Section;
  output?: boolean;
  divided?: boolean;
  selectable: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  const actions = useContext(MessageActionsContext);
  const [limit, setLimit] = useState(textPageSize);
  const shown = section.text.slice(0, limit);
  const lines = useMemo(
    () => (section.diff ? shown.split("\n") : undefined),
    [section.diff, shown]
  );
  return (
    <View style={[output && styles.output, divided && styles.divider]}>
      {section.label ? (
        <View style={styles.sectionHeader}>
          <BodyText muted style={styles.sectionLabel}>
            {section.label}
          </BodyText>
          <CopyAction
            value={section.text}
            label={
              output ? "Copy output" : `Copy ${section.label.toLowerCase()}`
            }
          />
        </View>
      ) : null}
      <View style={styles.codeRow}>
        <ScrollView
          nestedScrollEnabled
          style={styles.viewport}
          contentContainerStyle={styles.codeContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            selectable={selectable}
            onLongPress={
              !selectable && Platform.OS !== "web" ? actions : undefined
            }
            style={styles.code}
          >
            {lines
              ? lines.map((line, index) => (
                  <Text key={index} style={diffLineStyle(line, styles)}>
                    {line}
                    {index < lines.length - 1 ? "\n" : ""}
                  </Text>
                ))
              : shown}
          </Text>
          {section.text.length > limit && (
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
                Show more text ({(section.text.length - limit).toLocaleString()}{" "}
                characters left)
              </BodyText>
            </Pressable>
          )}
        </ScrollView>
        {!section.label && (
          <CopyAction value={section.text} label="Copy command" />
        )}
      </View>
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
  const { state } = tool;
  const input = state.status === "streaming" ? undefined : state.input;
  const metadata = "metadata" in state ? state.metadata : undefined;
  const sections = useMemo(
    () => (input ? inputSections(tool.name, input, metadata) : []),
    [tool.name, input, metadata]
  );
  const argumentsText = useMemo(
    () =>
      state.status === "streaming"
        ? state.input
        : JSON.stringify(state.input, null, 2),
    [state.input, state.status]
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
  const fallback = !!input && !sections.length;
  return (
    <View style={styles.body}>
      <View style={styles.panel}>
        {sections.map((section, index) => (
          <CodeSection
            key={`${tool.id}:${index}`}
            section={section}
            divided={index > 0}
            selectable={selectable}
          />
        ))}
        {fallback && (
          <CodeSection
            section={{ label: "Arguments", text: argumentsText }}
            selectable={selectable}
          />
        )}
        {state.status === "streaming" && (
          <BodyText muted style={styles.pending}>
            Receiving tool arguments
          </BodyText>
        )}
        {!!output && (
          <CodeSection
            section={{ label: "Output", text: output }}
            output
            divided={sections.length > 0 || fallback}
            selectable={selectable}
          />
        )}
        {!output && !content.length && state.status === "completed" && (
          <BodyText muted style={[styles.pending, styles.divider]}>
            No output
          </BodyText>
        )}
      </View>
      {files.map((file, index) => (
        <ArtifactContent
          key={`${file.uri}:${index}`}
          content={file}
          client={client}
          directory={directory}
        />
      ))}
      {state.status === "error" && <ErrorNotice error={state.error.message} />}
      {!fallback && (
        <Disclosure disclosureKey={`${tool.id}:arguments`} title="Arguments">
          <View style={styles.panel}>
            <CodeSection
              section={{ label: "Arguments", text: argumentsText }}
              selectable={selectable}
            />
          </View>
        </Disclosure>
      )}
    </View>
  );
};

export const ToolCallDetails = memo(ToolCallDetailsView);
