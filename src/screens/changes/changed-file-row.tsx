import type { FileDiffInfo } from "@opencode/client";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GestureResponderEvent } from "react-native";

import { FileIcon } from "../../components/file-icon";
import { MotionDisclosureChevron } from "../../components/motion";
import { ShellIcon } from "../../components/shell-icon";
import { Button, mono, sans, usePressFeedback } from "../../components/ui";
import type { Rect } from "../../lib/menu-position";
import { useTheme, useThemedStyles } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { isRenderable } from "./use-changes";

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    counts: { flexDirection: "row", gap: 8 },
    dir: {
      color: colors.muted,
      flexShrink: 1,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 20,
    },
    label: { fontFamily: sans, fontSize: 13, lineHeight: 20 },
    name: {
      color: colors.text,
      flexShrink: 0,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 20,
      maxWidth: "100%",
    },
    names: { flex: 1, flexDirection: "row", minWidth: 0 },
    row: {
      alignItems: "center",
      backgroundColor: colors.bg,
      borderBottomColor: colors.border,
      flexDirection: "row",
      gap: 12,
      minHeight: 44,
      overflow: "hidden",
      paddingHorizontal: 12,
    },
    summary: {
      alignItems: "center",
      backgroundColor: colors.bg,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 12,
      minHeight: 48,
      paddingHorizontal: 12,
    },
    total: { fontFamily: mono, fontSize: 14, lineHeight: 21 },
    trailing: { alignItems: "center", flexDirection: "row", gap: 16 },
  });

export const DiffCounts = ({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.counts}>
      <Text style={[styles.total, { color: colors.success }]}>
        +{additions}
      </Text>
      <Text style={[styles.total, { color: colors.danger }]}>-{deletions}</Text>
    </View>
  );
};

const statusLabel = (file: FileDiffInfo) => {
  if (file.status === "added") {
    return "Added";
  }
  return file.status === "deleted" ? "Removed" : "Modified";
};

const statusColor = (file: FileDiffInfo, colors: ThemeColors) => {
  if (file.status === "added") {
    return colors.success;
  }
  return file.status === "deleted" ? colors.danger : colors.muted;
};

export const ChangedFileRow = ({
  file,
  open,
  last,
  onToggle,
  onLongPress,
  onMenuRequest,
}: {
  file: FileDiffInfo;
  open: boolean;
  last: boolean;
  onToggle: () => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  onMenuRequest?: (anchor: Rect) => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const feedback = usePressFeedback();
  const ref = useRef<React.ComponentRef<typeof Pressable>>(null);
  const renderable = isRenderable(file);
  const slash = file.file.lastIndexOf("/");
  const directory = slash === -1 ? "" : file.file.slice(0, slash + 1);
  const name = file.file.slice(slash + 1);
  const border = last && !open ? 0 : StyleSheet.hairlineWidth;
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={`${file.file}, ${file.additions} added, ${file.deletions} removed`}
      accessibilityState={{ disabled: !renderable, expanded: open }}
      accessibilityActions={
        onMenuRequest
          ? [{ label: "File actions", name: "longpress" }]
          : undefined
      }
      onAccessibilityAction={() =>
        ref.current?.measureInWindow((x, y, width, height) =>
          onMenuRequest?.({ height, width, x, y })
        )
      }
      android_ripple={renderable ? feedback.android_ripple : undefined}
      disabled={!renderable && !onLongPress}
      onLongPress={onLongPress}
      onPress={renderable ? onToggle : undefined}
      style={({ pressed }) => [
        styles.row,
        { borderBottomWidth: border },
        pressed && renderable && feedback.pressedStyle,
      ]}
    >
      <FileIcon path={file.file} size={16} />
      <View style={styles.names}>
        {directory ? (
          <Text numberOfLines={1} ellipsizeMode="head" style={styles.dir}>
            {directory}
          </Text>
        ) : null}
        <Text numberOfLines={1} ellipsizeMode="middle" style={styles.name}>
          {name}
        </Text>
      </View>
      <View style={styles.trailing}>
        {renderable ? (
          <MotionDisclosureChevron open={open}>
            <ShellIcon name="chevron" size={14} color={colors.faint} />
          </MotionDisclosureChevron>
        ) : (
          <Text style={[styles.label, { color: statusColor(file, colors) }]}>
            {statusLabel(file)}
          </Text>
        )}
      </View>
    </Pressable>
  );
};

export const FileSummary = ({
  file,
  onOpenFile,
}: {
  file: FileDiffInfo;
  onOpenFile?: () => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  let status: string | null = null;
  if (file.status === "added") {
    status = "Added";
  } else if (file.status === "deleted") {
    status = "Removed";
  }
  return (
    <View style={styles.summary}>
      {status && (
        <Text style={[styles.label, { color: statusColor(file, colors) }]}>
          {status}
        </Text>
      )}
      <DiffCounts additions={file.additions} deletions={file.deletions} />
      {onOpenFile && file.status !== "deleted" && (
        <View style={{ marginLeft: "auto" }}>
          <Button
            title="Open file"
            size="small"
            variant="ghost"
            icon="open-file"
            onPress={onOpenFile}
          />
        </View>
      )}
    </View>
  );
};
