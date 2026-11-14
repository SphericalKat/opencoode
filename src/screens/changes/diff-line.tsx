import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GestureResponderEvent } from "react-native";

import { ShellIcon } from "../../components/shell-icon";
import {
  Button,
  mono,
  monoMedium,
  sans,
  usePressFeedback,
} from "../../components/ui";
import { unmodifiedLabel } from "../../lib/diff";
import type { DiffGap, DiffLine } from "../../lib/diff";
import type { Rect } from "../../lib/menu-position";
import type { SyntaxSegment } from "../../lib/syntax";
import { useTheme, useThemedStyles } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { CHANGED_LINE_LIMIT } from "./use-changes";

const MAX_HIGHLIGHT_LENGTH = 1000;
const TAB = /\t/gu;
const ROW_HEIGHT = 24;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    added: { backgroundColor: colors.diffAddedBackground },
    bar: { bottom: 0, left: 0, position: "absolute", top: 0, width: 2 },
    code: {
      color: colors.muted,
      flex: 1,
      fontFamily: mono,
      fontSize: 13,
      lineHeight: ROW_HEIGHT,
      paddingLeft: 16,
      paddingRight: 12,
    },
    gutter: {
      borderRightColor: colors.borderMuted,
      borderRightWidth: StyleSheet.hairlineWidth,
    },
    gap: {
      alignItems: "center",
      backgroundColor: colors.diffSeparatorBackground,
      flexDirection: "row",
      height: ROW_HEIGHT,
    },
    gapIcon: { alignItems: "center", justifyContent: "center" },
    gapText: {
      color: colors.faint,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: ROW_HEIGHT,
      paddingLeft: 16,
    },
    gateMeta: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 20,
    },
    gateTitle: {
      color: colors.text,
      fontFamily: sans,
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 20,
      marginBottom: 4,
    },
    gateWrap: {
      alignItems: "flex-start",
      backgroundColor: colors.bg,
      padding: 12,
    },
    note: {
      backgroundColor: colors.bg,
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 20,
      padding: 12,
    },
    number: {
      fontFamily: mono,
      fontSize: 13,
      lineHeight: ROW_HEIGHT,
      textAlign: "right",
    },
    removed: { backgroundColor: colors.diffRemovedBackground },
    row: {
      backgroundColor: colors.codeBackground,
      flexDirection: "row",
      minHeight: ROW_HEIGHT,
    },
  });

const lineNumber = (line: DiffLine) =>
  line.type === "removed" ? line.oldNumber : line.newNumber;

const numberColor = (line: DiffLine, colors: ThemeColors) => {
  if (line.type === "added") {
    return colors.diffAddedAccent;
  }
  return line.type === "removed" ? colors.diffRemovedAccent : colors.faint;
};

const CodeText = ({
  text,
  segments,
}: {
  text: string;
  segments?: SyntaxSegment[];
}) => {
  const styles = useThemedStyles(createStyles);
  if (!segments || text.length > MAX_HIGHLIGHT_LENGTH) {
    return <Text style={styles.code}>{text.replaceAll(TAB, "  ") || " "}</Text>;
  }
  return (
    <Text style={styles.code}>
      {segments.map((segment, index) => (
        <Text
          key={`${index}:${segment.text}`}
          style={{
            color: segment.color,
            fontFamily: segment.bold ? monoMedium : undefined,
          }}
        >
          {segment.text.replaceAll(TAB, "  ")}
        </Text>
      ))}
    </Text>
  );
};

export const DiffLineRow = ({
  line,
  segments,
  gutterWidth,
  onLongPress,
  onMenuRequest,
}: {
  line: DiffLine;
  segments?: SyntaxSegment[];
  gutterWidth: number;
  onLongPress?: (event: GestureResponderEvent) => void;
  onMenuRequest?: (anchor: Rect) => void;
}) => {
  const { colors } = useTheme();
  const ref = useRef<React.ComponentRef<typeof Pressable>>(null);
  const styles = useThemedStyles(createStyles);
  const tint = {
    added: styles.added,
    context: undefined,
    removed: styles.removed,
  }[line.type];
  const accent =
    line.type === "added" ? colors.diffAddedAccent : colors.diffRemovedAccent;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityActions={
        onMenuRequest
          ? [{ label: "Line actions", name: "longpress" }]
          : undefined
      }
      onAccessibilityAction={() =>
        ref.current?.measureInWindow((x, y, width, height) =>
          onMenuRequest?.({ height, width, x, y })
        )
      }
      accessibilityLabel={`${line.type} line ${lineNumber(line)}: ${line.text}`}
      onLongPress={onLongPress}
      style={[styles.row, tint]}
    >
      {line.type !== "context" && (
        <View style={[styles.bar, { backgroundColor: accent }]} />
      )}
      <View style={[styles.gutter, { width: gutterWidth }]}>
        <Text style={[styles.number, { color: numberColor(line, colors) }]}>
          {lineNumber(line)}
        </Text>
      </View>
      <CodeText text={line.text} segments={segments} />
    </Pressable>
  );
};

const gapIcons = {
  leading: "chevron-up",
  middle: "chevron-grabber-vertical",
  trailing: "chevron-down",
} as const;

export const DiffGapRow = ({
  gap,
  gutterWidth,
  onExpand,
}: {
  gap: DiffGap;
  gutterWidth: number;
  onExpand: () => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const feedback = usePressFeedback();
  const label = unmodifiedLabel(gap.count);
  const content = (
    <>
      <View style={[styles.gapIcon, { width: gutterWidth }]}>
        <ShellIcon
          name={gapIcons[gap.position]}
          color={colors.faint}
          size={16}
        />
      </View>
      <Text style={styles.gapText}>{label}</Text>
    </>
  );
  if (gap.hidden.length === 0) {
    return <View style={styles.gap}>{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Show ${label}`}
      android_ripple={feedback.android_ripple}
      onPress={onExpand}
      style={({ pressed }) => [styles.gap, pressed && feedback.pressedStyle]}
    >
      {content}
    </Pressable>
  );
};

export const DiffGate = ({
  changed,
  onRender,
}: {
  changed: number;
  onRender: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.gateWrap}>
      <Text style={styles.gateTitle}>Diff too large to render</Text>
      <Text style={styles.gateMeta}>
        {`Limit: ${CHANGED_LINE_LIMIT.toLocaleString()} changed lines. Current: ${changed.toLocaleString()} changed lines.`}
      </Text>
      <View style={{ marginTop: 10 }}>
        <Button
          title="Render anyway"
          size="small"
          variant="secondary"
          onPress={onRender}
        />
      </View>
    </View>
  );
};

export const TruncatedNote = () => {
  const styles = useThemedStyles(createStyles);
  return <Text style={styles.note}>The server truncated this diff.</Text>;
};
