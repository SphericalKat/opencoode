import type {
  SessionMessageAssistant,
  SessionMessageInfo,
  SessionMessageAssistantTool,
  ToolContent,
} from "@opencode/client";
import React, {
  memo,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { AgentActivity } from "../lib/activity";
import type { Client } from "../lib/client";
import {
  MessageActionsContext,
  MessageDisclosureContext,
} from "../lib/message-actions";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { toolRow, visibleTranscriptMessages } from "../lib/transcript";
import type { ToolRow } from "../lib/transcript";
import { ArtifactContent, isImageArtifact } from "./artifact-content";
import { Markdown } from "./markdown";
import {
  MotionDisclosureBody,
  MotionDisclosureChevron,
  WorkingIndicator,
} from "./motion";
import { ResponseFooter } from "./response-footer";
import { SessionErrorNotice } from "./session-error";
import { ToolCallDetails, toolDisplayName } from "./tool-call-details";
import { BodyText, sans, usePressFeedback } from "./ui";

export type TranscriptItem =
  | { type: "message"; id: string; message: SessionMessageInfo }
  | { type: "assistant-turn"; id: string; messages: SessionMessageAssistant[] };
type Turn = Extract<TranscriptItem, { type: "assistant-turn" }>;
type Part = SessionMessageAssistant["content"][number];
interface Entry {
  key: string;
  message: SessionMessageAssistant;
  index: number;
  part?: Part;
  error?: string;
}
type SourceRenderer = (
  message: SessionMessageAssistant,
  key: string,
  content: React.ReactNode
) => React.ReactNode;

export const groupTranscriptMessages = (
  messages: SessionMessageInfo[],
  previous: TranscriptItem[]
): TranscriptItem[] => {
  const previousItems = new Map(previous.map((item) => [item.id, item]));
  const previousTurns = new Map<string, Turn>();
  for (const item of previous) {
    if (item.type === "assistant-turn") {
      for (const message of item.messages) {
        previousTurns.set(message.id, item);
      }
    }
  }
  const items: TranscriptItem[] = [];
  const usedIDs = new Set<string>();
  let assistants: SessionMessageAssistant[] = [];
  const flush = () => {
    if (!assistants.length) {
      return;
    }
    const existing = assistants
      .map((message) => previousTurns.get(message.id))
      .find((item) => item !== undefined && !usedIDs.has(item.id));
    const unchanged =
      existing &&
      existing.messages.length === assistants.length &&
      existing.messages.every(
        (message, index) => message === assistants[index]
      );
    const item: Turn = unchanged
      ? existing
      : {
          id: existing?.id ?? assistants[0].id,
          messages: assistants,
          type: "assistant-turn",
        };
    usedIDs.add(item.id);
    items.push(item);
    assistants = [];
  };
  for (const message of visibleTranscriptMessages(messages)) {
    if (message.type === "assistant") {
      assistants.push(message);
      continue;
    }
    flush();
    const existing = previousItems.get(message.id);
    items.push(
      existing?.type === "message" && existing.message === message
        ? existing
        : { id: message.id, message, type: "message" }
    );
  }
  flush();
  return items;
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    activity: { minWidth: 0 },
    groupBody: { marginLeft: 12, paddingLeft: 12, position: "relative" },
    groupHeader: {
      alignItems: "center",
      borderRadius: 6,
      flexDirection: "row",
      gap: 4,
      minHeight: 36,
      overflow: "hidden",
    },
    groupText: {
      color: colors.muted,
      flexShrink: 1,
      fontFamily: sans,
      fontSize: 13,
      fontWeight: "400",
      letterSpacing: -0.04,
      lineHeight: 16,
    },
    groupTextLabels: { color: colors.text, fontVariant: ["tabular-nums"] },
    groupedText: { paddingVertical: 6 },
    imageLabel: { fontSize: 13, lineHeight: 19, paddingTop: 8 },
    images: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      minWidth: 0,
      paddingVertical: 8,
    },
    matchDot: {
      backgroundColor: colors.faint,
      borderRadius: 1.125,
      height: 2.25,
      width: 2.25,
    },
    matchDotBox: {
      alignItems: "center",
      height: 6,
      justifyContent: "center",
      width: 6,
    },
    matches: {
      color: colors.faint,
      flexShrink: 0,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 16,
    },
    rail: {
      backgroundColor: colors.border,
      bottom: 6,
      left: 0,
      position: "absolute",
      top: 6,
      width: StyleSheet.hairlineWidth,
    },
    readName: {
      color: colors.faint,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 16,
      paddingVertical: 4,
    },
    row: {
      alignItems: "center",
      borderRadius: 6,
      flexDirection: "row",
      gap: 6,
      minHeight: 36,
      overflow: "hidden",
    },
    rowDuration: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 16,
    },
    rowError: { marginBottom: 6, marginTop: 2 },
    rowSubtitle: {
      color: colors.faint,
      flexShrink: 1,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 16,
      minWidth: 0,
    },
    rowTitle: {
      color: colors.text,
      flexShrink: 0,
      fontFamily: sans,
      fontSize: 13,
      fontWeight: "400",
      letterSpacing: -0.04,
      lineHeight: 16,
    },
    thoughtBody: {
      marginLeft: 2,
      paddingBottom: 8,
      paddingLeft: 12,
      position: "relative",
    },
    toolBody: { paddingBottom: 8 },
    turn: { gap: 6 },
  });

const useDisclosure = (key: string, revealChild = false) => {
  const disclosures = useContext(MessageDisclosureContext);
  const collapsedKey = `${key}:collapsed`;
  const [open, setOpen] = useState(
    () =>
      disclosures?.isOpen(key) ||
      (revealChild && !disclosures?.isOpen(collapsedKey))
  );
  const reveals = revealChild && !disclosures?.isOpen(collapsedKey);
  if (reveals && !open) {
    setOpen(true);
  }
  useLayoutEffect(() => {
    if (reveals) {
      disclosures?.setOpen(key, true);
    }
  }, [reveals, disclosures, key]);
  const toggle = () => {
    const next = disclosures ? disclosures.toggle(key) : !open;
    disclosures?.setOpen(collapsedKey, !next);
    setOpen(next);
  };
  return { open: !!open, toggle };
};

const ToolResultImages = ({
  tool,
  client,
  directory,
  label,
}: {
  tool: SessionMessageAssistantTool;
  client?: Client;
  directory: string;
  label?: string;
}) => {
  const styles = useThemedStyles(createStyles);
  const content: ToolContent[] =
    "content" in tool.state ? (tool.state.content ?? []) : [];
  const images = content
    .filter((item) => item.type === "file")
    .filter(isImageArtifact);
  if (!images.length) {
    return null;
  }
  return (
    <View>
      {label && (
        <BodyText muted numberOfLines={2} style={styles.imageLabel}>
          {label}
        </BodyText>
      )}
      <View style={styles.images}>
        {images.map((image, index) => (
          <ArtifactContent
            key={`${index}:${image.uri}`}
            content={image}
            client={client}
            directory={directory}
            thumbnail
          />
        ))}
      </View>
    </View>
  );
};

const Rail = () => {
  const styles = useThemedStyles(createStyles);
  return <View pointerEvents="none" style={styles.rail} />;
};

const Triangle = ({ open }: { open: boolean }) => {
  const { colors } = useTheme();
  return (
    <MotionDisclosureChevron open={open}>
      <Svg width={8} height={8} viewBox="0 0 8 8" aria-hidden>
        <Path d="M2 1.5 6 4 2 6.5Z" fill={colors.faint} />
      </Svg>
    </MotionDisclosureChevron>
  );
};

const ActivityGroupHeader = ({
  labels,
  open,
  onToggle,
}: {
  labels: { name: string; count: number }[];
  open: boolean;
  onToggle: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  const actions = useContext(MessageActionsContext);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const text = labels.map(({ count, name }) => `${count} ${name}`).join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Used ${text}`}
      accessibilityState={{ expanded: open }}
      android_ripple={android_ripple}
      aria-expanded={open}
      hitSlop={{ bottom: 6, top: 6 }}
      onPress={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onLongPress={Platform.OS === "web" ? undefined : actions}
      style={({ pressed }) => [styles.groupHeader, pressed && pressedStyle]}
    >
      <Text numberOfLines={1} style={styles.groupText}>
        Used <Text style={styles.groupTextLabels}>{text}</Text>
      </Text>
      {open && <Triangle open={open} />}
    </Pressable>
  );
};

const entryKey = (
  message: SessionMessageAssistant,
  part: Part,
  index: number
) => `${message.id}:${part.type === "tool" ? part.id : index}`;

type ActivityPart = Exclude<Part, { type: "text" }>;

const isPartBusy = (part: ActivityPart, live: boolean, waiting: boolean) => {
  if (!live || waiting) {
    return false;
  }
  if (part.type === "reasoning") {
    return part.time?.completed === undefined;
  }
  return part.state.status === "streaming" || part.state.status === "running";
};

const partTitle = (part: ActivityPart, busy: boolean) => {
  if (part.type !== "reasoning") {
    return toolDisplayName(part.name);
  }
  return busy ? "Thinking" : "Thought";
};

const partDuration = (part: ActivityPart) =>
  part.type === "reasoning" && part.time?.completed !== undefined
    ? `${Math.max(1, Math.round((part.time.completed - part.time.created) / 1000))}s`
    : undefined;

const rowLabel = ({ title, subtitle, args, matches }: ToolRow) =>
  `${title}${subtitle ? `, ${subtitle}` : ""}${args.length ? `, ${args.join(", ")}` : ""}${matches ? `, ${matches}` : ""}`;

const RowShell = ({
  expandable,
  open,
  busy,
  label,
  onToggle,
  children,
}: {
  expandable: boolean;
  open: boolean;
  busy: boolean;
  label: string;
  onToggle: () => void;
  children: React.ReactNode;
}) => {
  const styles = useThemedStyles(createStyles);
  const actions = useContext(MessageActionsContext);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const longPress = Platform.OS === "web" ? undefined : actions;
  if (!expandable) {
    return (
      <Pressable
        accessibilityLabel={label}
        accessibilityState={{ busy }}
        onLongPress={longPress}
        style={styles.row}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, expanded: open }}
      android_ripple={android_ripple}
      aria-expanded={open}
      onPress={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onLongPress={longPress}
      style={({ pressed }) => [styles.row, pressed && pressedStyle]}
    >
      {children}
    </Pressable>
  );
};

const Matches = ({ text }: { text: string }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <View style={styles.matchDotBox}>
        <View style={styles.matchDot} />
      </View>
      <Text style={styles.matches}>{text}</Text>
    </>
  );
};

const ThoughtRow = ({
  part,
  detailsKey,
  busy,
  animate,
  selectable,
}: {
  part: Extract<Part, { type: "reasoning" }>;
  detailsKey: string;
  busy: boolean;
  animate?: boolean;
  selectable: boolean;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { open, toggle } = useDisclosure(detailsKey);
  const title = partTitle(part, busy);
  const duration = partDuration(part);
  return (
    <View style={styles.activity}>
      <RowShell
        expandable
        open={open}
        busy={busy}
        label={`${title}${duration ? ` ${duration}` : ""}`}
        onToggle={toggle}
      >
        <Text style={styles.rowTitle}>{title}</Text>
        {duration && <Text style={styles.rowDuration}>{duration}</Text>}
        {busy && (
          <WorkingIndicator active={!!animate} color={colors.muted} size={12} />
        )}
      </RowShell>
      <MotionDisclosureBody open={open} style={styles.thoughtBody}>
        <Rail />
        <Markdown text={part.text} muted selectable={selectable} />
      </MotionDisclosureBody>
    </View>
  );
};

const ToolPartRow = ({
  part,
  detailsKey,
  busy,
  animate,
  client,
  directory,
  selectable,
}: {
  part: SessionMessageAssistantTool;
  detailsKey: string;
  busy: boolean;
  animate?: boolean;
  client?: Client;
  directory: string;
  selectable: boolean;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { open, toggle } = useDisclosure(detailsKey);
  const row = toolRow(part, directory);
  const subtitle = [row.subtitle, ...row.args].filter(Boolean).join(" ");
  const failed = part.state.status === "error";
  return (
    <View style={styles.activity}>
      <RowShell
        expandable={row.expandable}
        open={open}
        busy={busy}
        label={rowLabel(row)}
        onToggle={toggle}
      >
        <Text style={styles.rowTitle}>{row.title}</Text>
        {busy && (
          <WorkingIndicator active={!!animate} color={colors.muted} size={12} />
        )}
        {subtitle ? (
          <Text numberOfLines={1} style={styles.rowSubtitle}>
            {subtitle}
          </Text>
        ) : null}
        {row.matches && <Matches text={row.matches} />}
      </RowShell>
      {row.expandable && (
        <MotionDisclosureBody open={open} style={styles.toolBody}>
          <ToolCallDetails
            tool={part}
            client={client}
            directory={directory}
            selectable={selectable}
          />
        </MotionDisclosureBody>
      )}
      <ToolResultImages tool={part} client={client} directory={directory} />
      {failed && !(open && row.expandable) && (
        <View style={styles.rowError}>
          <SessionErrorNotice
            message={
              part.state.status === "error"
                ? part.state.error.message || "The tool failed"
                : "The tool failed"
            }
            selectable
          />
        </View>
      )}
    </View>
  );
};

const AssistantActivityPartView = ({
  part,
  detailsKey,
  live,
  activityKind,
  animate,
  client,
  directory,
  grouped,
  selectable,
}: {
  part: Part;
  detailsKey: string;
  live: boolean;
  activityKind?: AgentActivity["kind"];
  animate?: boolean;
  client?: Client;
  directory: string;
  grouped?: boolean;
  selectable: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  if (part.type === "text") {
    const markdown = (
      <Markdown text={part.text} selectable={selectable} streaming={live} />
    );
    return grouped ? (
      <View style={styles.groupedText}>{markdown}</View>
    ) : (
      markdown
    );
  }
  const waiting =
    activityKind === "approval" ||
    activityKind === "question" ||
    activityKind === "retry";
  const busy = isPartBusy(part, live, waiting);
  if (part.type === "reasoning") {
    return (
      <ThoughtRow
        part={part}
        detailsKey={detailsKey}
        busy={busy}
        animate={animate}
        selectable={selectable}
      />
    );
  }
  return (
    <ToolPartRow
      part={part}
      detailsKey={detailsKey}
      busy={busy}
      animate={animate}
      client={client}
      directory={directory}
      selectable={selectable}
    />
  );
};

const readPath = (tool: SessionMessageAssistantTool): string | undefined => {
  if (tool.state.status === "streaming") {
    return;
  }
  const { input } = tool.state;
  for (const key of ["filePath", "file_path", "path"]) {
    const value = input[key];
    if (typeof value === "string" && value.length) {
      return value;
    }
  }
};

const readSubtitle = (
  tools: SessionMessageAssistantTool[],
  directory: string
) => {
  const counts = new Map<string, number>();
  for (const tool of tools) {
    const path = readPath(tool) ?? tool.id;
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  const seen = new Set<string>();
  const names: string[] = [];
  for (const tool of tools) {
    const path = readPath(tool) ?? tool.id;
    if (seen.has(path)) {
      continue;
    }
    seen.add(path);
    const row = toolRow(tool, directory);
    const args = counts.get(path) === 1 ? row.args : [];
    names.push([row.subtitle, ...args].filter(Boolean).join(" "));
  }
  return names.filter(Boolean).join(", ");
};

const ReadGroupRow = ({
  entries,
  client,
  directory,
  selectable,
}: {
  entries: Entry[];
  client?: Client;
  directory: string;
  selectable: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  const { open, toggle } = useDisclosure(entries[0].key);
  const tools = entries.flatMap((entry) =>
    entry.part?.type === "tool" ? [entry.part] : []
  );
  const subtitle = readSubtitle(tools, directory);
  return (
    <View style={styles.activity}>
      <RowShell
        expandable
        open={open}
        busy={false}
        label={`Read${subtitle ? `, ${subtitle}` : ""}`}
        onToggle={toggle}
      >
        <Text style={styles.rowTitle}>Read</Text>
        <Text numberOfLines={1} style={styles.rowSubtitle}>
          {subtitle}
        </Text>
      </RowShell>
      <MotionDisclosureBody open={open} style={styles.toolBody}>
        {tools.map((tool) => {
          const row = toolRow(tool, directory);
          return (
            <View key={tool.id}>
              <Text style={styles.readName}>
                {[row.subtitle, ...row.args].filter(Boolean).join(" ")}
              </Text>
              {row.expandable && (
                <ToolCallDetails
                  tool={tool}
                  client={client}
                  directory={directory}
                  selectable={selectable}
                />
              )}
              {tool.state.status === "error" && (
                <View style={styles.rowError}>
                  <SessionErrorNotice
                    message={tool.state.error.message || "The tool failed"}
                    selectable
                  />
                </View>
              )}
            </View>
          );
        })}
      </MotionDisclosureBody>
    </View>
  );
};

type GroupItem = { entry: Entry } | { reads: Entry[] };

const isReadEntry = (entry: Entry, directory: string) =>
  entry.part?.type === "tool" && toolRow(entry.part, directory).kind === "read";

const groupReads = (entries: Entry[], directory: string): GroupItem[] => {
  const items: GroupItem[] = [];
  let run: Entry[] = [];
  const flush = () => {
    if (run.length === 1) {
      items.push({ entry: run[0] });
    } else if (run.length > 1) {
      items.push({ reads: run });
    }
    run = [];
  };
  for (const entry of entries) {
    if (isReadEntry(entry, directory)) {
      run.push(entry);
      continue;
    }
    flush();
    items.push({ entry });
  }
  flush();
  return items;
};

export const AssistantActivityPart = memo(AssistantActivityPartView);

const imageLabel = (tool: SessionMessageAssistantTool, directory: string) => {
  const { title, subtitle } = toolRow(tool, directory);
  return `${title}${subtitle ? ` · ${subtitle}` : ""}`;
};

const TurnActivities = ({
  turnID,
  entries,
  activities,
  renderEntry,
  renderSource,
  client,
  directory,
}: {
  client?: Client;
  directory: string;
  turnID: string;
  entries: Entry[];
  activities: Entry[];
  renderEntry: (entry: Entry, grouped?: boolean) => React.ReactNode;
  renderSource: SourceRenderer;
}) => {
  const styles = useThemedStyles(createStyles);
  const disclosures = useContext(MessageDisclosureContext);
  const childOpen = activities.some((entry) => disclosures?.isOpen(entry.key));
  const { open, toggle } = useDisclosure(
    `turn:${turnID}:activities`,
    childOpen
  );
  const counts = new Map<string, number>();
  for (const entry of activities) {
    if (entry.part?.type === "tool") {
      const name = toolDisplayName(entry.part.name);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  if (!counts.size) {
    counts.set(
      "Thought",
      activities.filter((entry) => entry.part?.type === "reasoning").length
    );
  }
  const labels = [...counts].map(([name, count]) => ({ count, name }));
  const items = groupReads(entries, directory);
  return (
    <View>
      {renderSource(
        activities[0].message,
        `turn:${turnID}:summary`,
        <ActivityGroupHeader labels={labels} open={open} onToggle={toggle} />
      )}
      <MotionDisclosureBody open={open} style={styles.groupBody}>
        <Rail />
        {items.map((item) =>
          "reads" in item ? (
            <React.Fragment key={item.reads[0].key}>
              {renderSource(
                item.reads[0].message,
                item.reads[0].key,
                <ReadGroupRow
                  entries={item.reads}
                  client={client}
                  directory={directory}
                  selectable={false}
                />
              )}
            </React.Fragment>
          ) : (
            <React.Fragment key={item.entry.key}>
              {renderEntry(item.entry, true)}
            </React.Fragment>
          )
        )}
      </MotionDisclosureBody>
      {!open &&
        entries.map((entry) => (
          <React.Fragment key={entry.key}>
            {entry.error !== undefined && renderEntry(entry)}
            {entry.part?.type === "tool" &&
              renderSource(
                entry.message,
                `${entry.key}:images`,
                <ToolResultImages
                  tool={entry.part}
                  client={client}
                  directory={directory}
                  label={
                    activities.length > 1
                      ? imageLabel(entry.part, directory)
                      : undefined
                  }
                />
              )}
            {entry.part?.type === "tool" &&
              entry.part.state.status === "error" &&
              renderSource(
                entry.message,
                `${entry.key}:error`,
                <View style={styles.rowError}>
                  <SessionErrorNotice
                    message={
                      entry.part.state.error.message || "The tool failed"
                    }
                    selectable
                  />
                </View>
              )}
          </React.Fragment>
        ))}
    </View>
  );
};

const AssistantTurnView = ({
  turn,
  liveMessageID,
  activityKind,
  animate,
  client,
  directory,
  renderSource,
}: {
  turn: Turn;
  liveMessageID?: string;
  activityKind?: AgentActivity["kind"];
  animate: boolean;
  client?: Client;
  directory: string;
  renderSource: SourceRenderer;
}) => {
  const styles = useThemedStyles(createStyles);
  const entries = useMemo<Entry[]>(
    () =>
      turn.messages.flatMap((message) => [
        ...message.content.map((part, index) => ({
          index,
          key: entryKey(message, part, index),
          message,
          part,
        })),
        ...(message.error
          ? [
              {
                error: message.error.message,
                index: message.content.length,
                key: `${message.id}:error`,
                message,
              },
            ]
          : []),
      ]),
    [turn.messages]
  );
  const active = turn.messages.some((message) => message.id === liveMessageID);
  const isLive = (entry: Entry) => {
    const { part } = entry;
    if (!(active && part)) {
      return false;
    }
    if (part.type === "tool") {
      return (
        part.state.status === "running" || part.state.status === "streaming"
      );
    }
    const isLastPart =
      entry.message.id === liveMessageID &&
      entry.index === entry.message.content.length - 1;
    return (
      isLastPart && (part.type === "text" || part.time?.completed === undefined)
    );
  };
  const firstLive = entries.findIndex(isLive);
  const groupLimit = firstLive === -1 ? entries.length : firstLive;
  const segments: { start: number; end: number; activities: Entry[] }[] = [];
  let current: (typeof segments)[number] | undefined;
  for (const [index, entry] of entries.slice(0, groupLimit).entries()) {
    const { part } = entry;
    if (part && part.type !== "text") {
      if (!current) {
        current = { activities: [], end: index, start: index };
        segments.push(current);
      }
      current.activities.push(entry);
      current.end = index;
    } else if (part?.type === "text" && part.text.trim()) {
      current = undefined;
    }
  }
  const renderEntry = (entry: Entry, grouped?: boolean) =>
    renderSource(
      entry.message,
      entry.key,
      entry.part ? (
        <AssistantActivityPart
          part={entry.part}
          detailsKey={entry.key}
          live={isLive(entry)}
          activityKind={activityKind}
          animate={animate}
          client={client}
          directory={directory}
          grouped={grouped}
          selectable={false}
        />
      ) : (
        <SessionErrorNotice
          message={entry.error || "The assistant reported an error"}
          selectable={false}
        />
      )
    );
  const finalText = entries.findLast(
    (entry) => entry.part?.type === "text" && !!entry.part.text.trim()
  );
  return (
    <View style={styles.turn}>
      {segments.map((segment, segmentIndex) => {
        const before = segments[segmentIndex - 1]?.end ?? -1;
        return (
          <React.Fragment key={segment.activities[0].key}>
            {entries.slice(before + 1, segment.start).map((entry) => (
              <React.Fragment key={entry.key}>
                {renderEntry(entry)}
              </React.Fragment>
            ))}
            <TurnActivities
              turnID={`${turn.id}:${segment.activities[0].key}`}
              entries={entries.slice(segment.start, segment.end + 1)}
              activities={segment.activities}
              renderEntry={renderEntry}
              renderSource={renderSource}
              client={client}
              directory={directory}
            />
          </React.Fragment>
        );
      })}
      {entries.slice((segments.at(-1)?.end ?? -1) + 1).map((entry) => (
        <React.Fragment key={entry.key}>{renderEntry(entry)}</React.Fragment>
      ))}
      {!active && finalText && (
        <ResponseFooter
          text={turn.messages
            .flatMap((message) =>
              message.content.flatMap((part) =>
                part.type === "text" ? [part.text] : []
              )
            )
            .join("\n\n")}
          elapsedSeconds={
            finalText.message.time.completed === undefined
              ? undefined
              : Math.max(
                  0,
                  Math.round(
                    (finalText.message.time.completed -
                      turn.messages[0].time.created) /
                      1000
                  )
                )
          }
        />
      )}
    </View>
  );
};

export const AssistantTurn = memo(AssistantTurnView);
