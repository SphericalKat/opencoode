import React, { useMemo } from "react";
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { NavIcon } from "./Icons";
import { ShellIcon } from "./ShellIcon";
import { Label, Sheet } from "./ui";

export interface OpenSessionTab {
  id: string;
  title: string;
  directory: string;
}
export type SessionPane =
  | "Session"
  | "Changes"
  | "Files"
  | "Terminal"
  | "Worktrees";

export function SessionSurface({
  framed,
  style,
  children,
}: {
  framed: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.surface, style, framed && styles.framedSurface]}>
      {children}
    </View>
  );
}

function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>
      <Rect x={2} y={2} width={4} height={4} stroke={color} />
      <Rect x={10} y={2} width={4} height={4} stroke={color} />
      <Rect x={2} y={10} width={4} height={4} stroke={color} />
      <Path d="M12 9v6M9 12h6" stroke={color} />
    </Svg>
  );
}

function ProjectBadge({ directory }: { directory: string }) {
  const styles = useThemedStyles(createStyles);
  const name = directory.split(/[\\/]/).filter(Boolean).pop() || "Project";
  return (
    <View style={styles.badge}>
      <Label style={styles.badgeText}>{name.slice(0, 1).toUpperCase()}</Label>
    </View>
  );
}

export function BetaTabStrip({
  current,
  count,
  busy,
  onOpen,
}: {
  current?: OpenSessionTab;
  count: number;
  busy?: boolean;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tabs. ${current?.title || "Home"}. ${count} open ${count === 1 ? "session" : "sessions"}`}
      onPress={onOpen}
      style={({ pressed }) => [styles.strip, pressed && styles.pressed]}
    >
      {current ? (
        <ProjectBadge directory={current.directory} />
      ) : (
        <HomeIcon color={colors.muted} />
      )}
      <Label numberOfLines={1} style={styles.stripTitle}>
        {current?.title || "Home"}
      </Label>
      {busy ? (
        <ActivityIndicator size="small" color={colors.muted} />
      ) : (
        <Label muted style={styles.count}>
          {count}
        </Label>
      )}
    </Pressable>
  );
}

export function BetaSessionNavigation({
  pane,
  directory,
  onSelect,
  onMore,
  onProject,
  changes = true,
}: {
  pane: SessionPane;
  directory: string;
  onSelect: (pane: "Session" | "Changes") => void;
  onMore: () => void;
  onProject?: () => void;
  changes?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Session view"
        style={styles.sessionTabs}
      >
        {(["Session", "Changes"] as const)
          .filter((item) => item === "Session" || changes)
          .map((item) => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: pane === item }}
              onPress={() => onSelect(item)}
              style={({ pressed }) => [
                styles.sessionTab,
                pane === item && styles.selectedTab,
                pressed && styles.pressed,
              ]}
            >
              <Label
                style={[
                  styles.tabText,
                  { color: pane === item ? colors.text : colors.muted },
                ]}
              >
                {item}
              </Label>
            </Pressable>
          ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More session views"
          onPress={onMore}
          style={({ pressed }) => [
            styles.sessionTab,
            pane !== "Session" && pane !== "Changes" && styles.selectedTab,
            pressed && styles.pressed,
          ]}
        >
          <Label style={styles.tabText}>
            {pane !== "Session" && pane !== "Changes" ? pane : "More…"}
          </Label>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole={onProject ? "button" : undefined}
        accessibilityLabel={`Project: ${directory}${onProject ? ". Open project" : ""}`}
        disabled={!onProject}
        onPress={onProject}
        style={({ pressed }) => [styles.project, pressed && styles.pressed]}
      >
        <ProjectBadge directory={directory} />
        <Label muted numberOfLines={1} style={styles.projectName}>
          {directory.split(/[\\/]/).filter(Boolean).pop() || directory}
        </Label>
      </Pressable>
    </>
  );
}

export function SheetGrip({ onClose }: { onClose: () => void }) {
  const styles = useThemedStyles(createStyles);
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, state) =>
          state.dy > 8 && state.dy > Math.abs(state.dx),
        onPanResponderRelease: (_, state) => {
          if (state.dy > 40 || state.vy > 0.5) {
            onClose();
          }
        },
      }),
    [onClose]
  );
  return (
    <View accessible={false} style={styles.gripTarget} {...pan.panHandlers}>
      <View style={styles.grip} />
    </View>
  );
}

export function BetaTabsSheet({
  visible,
  tabs,
  recent = [],
  selectedID,
  serverLabel,
  onServer,
  onClose,
  onDismiss,
  onSelect,
  onCloseTab,
  onNew,
  onHome,
  onSettings,
  onHelp,
}: {
  visible: boolean;
  tabs: OpenSessionTab[];
  selectedID?: string;
  onClose: () => void;
  onDismiss: () => void;
  serverLabel: string;
  onServer: () => void;
  recent?: OpenSessionTab[];
  onSelect: (id: string) => void;
  onCloseTab?: (id: string) => void;
  onNew: () => void;
  onHome?: () => void;
  onSettings: () => void;
  onHelp: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Sheet
      visible={visible}
      title="Tabs"
      fitContent
      showHeader={false}
      onClose={onClose}
      onDismiss={onDismiss}
      contentStyle={styles.sheetContent}
    >
      <SheetGrip onClose={onClose} />
      {tabs.map((item) => (
        <View
          key={item.id}
          style={[styles.openTab, selectedID === item.id && styles.activeTab]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title}`}
            accessibilityState={{ selected: selectedID === item.id }}
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [
              styles.openTabMain,
              pressed && styles.pressed,
            ]}
          >
            <ProjectBadge directory={item.directory} />
            <Label numberOfLines={1} style={styles.openTabTitle}>
              {item.title}
            </Label>
          </Pressable>
          {onCloseTab && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close tab ${item.title}`}
              onPress={() => onCloseTab(item.id)}
              style={({ pressed }) => [
                styles.closeTab,
                pressed && styles.pressed,
              ]}
            >
              <ShellIcon name="close" size={14} color={colors.faint} />
            </Pressable>
          )}
        </View>
      ))}
      {recent.some((item) => !tabs.some((tab) => tab.id === item.id)) && (
        <>
          <Label muted style={styles.recentTitle}>
            Recent sessions
          </Label>
          {recent
            .filter((item) => !tabs.some((tab) => tab.id === item.id))
            .map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.title}`}
                onPress={() => onSelect(item.id)}
                style={({ pressed }) => [
                  styles.openTabMain,
                  pressed && styles.pressed,
                ]}
              >
                <ProjectBadge directory={item.directory} />
                <Label numberOfLines={1} style={styles.openTabTitle}>
                  {item.title}
                </Label>
              </Pressable>
            ))}
        </>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onNew}
        style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
      >
        <ShellIcon name="compose" size={16} color={colors.muted} />
        <Label style={styles.menuText}>New session</Label>
      </Pressable>
      <View style={styles.divider} />
      {onHome && (
        <Pressable
          accessibilityRole="button"
          onPress={onHome}
          style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
        >
          <HomeIcon color={colors.muted} />
          <Label style={styles.menuText}>Home</Label>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Switch server. Current server: ${serverLabel}`}
        onPress={onServer}
        style={({ pressed }) => [styles.serverRow, pressed && styles.pressed]}
      >
        <ShellIcon name="server" size={16} color={colors.muted} />
        <View style={styles.serverText}>
          <Label numberOfLines={1} style={styles.serverName}>
            {serverLabel}
          </Label>
          <Label muted style={styles.serverDetail}>
            Current server
          </Label>
        </View>
        <ShellIcon name="chevron" size={14} color={colors.muted} />
      </Pressable>
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={onSettings}
          style={({ pressed }) => [
            styles.footerButton,
            pressed && styles.pressed,
          ]}
        >
          <NavIcon name="settings" color={colors.muted} size={16} />
          <Label style={styles.menuText}>Settings</Label>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onHelp}
          style={({ pressed }) => [
            styles.footerButton,
            pressed && styles.pressed,
          ]}
        >
          <Label muted style={styles.menuText}>
            ⓘ
          </Label>
          <Label style={styles.menuText}>Help</Label>
        </Pressable>
      </View>
    </Sheet>
  );
}

export function BetaMoreSheet({
  visible,
  pane = "Session",
  onClose,
  onDismiss,
  onView,
  onUsage,
  onDetails,
}: {
  visible: boolean;
  pane?: SessionPane;
  onClose: () => void;
  onDismiss: () => void;
  onView?: (pane: "Files" | "Terminal" | "Worktrees") => void;
  onUsage?: () => void;
  onDetails?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Sheet
      visible={visible}
      title="More options"
      fitContent
      showHeader={false}
      contentStyle={styles.sheetContent}
      onClose={onClose}
      onDismiss={onDismiss}
    >
      <SheetGrip onClose={onClose} />
      {onView &&
        (["Files", "Terminal", "Worktrees"] as const).map((view) => (
          <Pressable
            key={view}
            accessibilityRole="button"
            onPress={() => onView(view)}
            style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
          >
            <Label style={styles.moreText}>{view}</Label>
            <Label muted>{pane === view ? "✓" : ""}</Label>
          </Pressable>
        ))}
      {onUsage && (
        <Pressable
          accessibilityRole="button"
          onPress={onUsage}
          style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
        >
          <Label style={styles.moreText}>Usage</Label>
        </Pressable>
      )}
      {onDetails && (
        <Pressable
          accessibilityRole="button"
          onPress={onDetails}
          style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}
        >
          <Label style={styles.moreText}>Session details</Label>
          <ShellIcon name="chevron" size={14} color={colors.muted} />
        </Pressable>
      )}
    </Sheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    activeTab: { backgroundColor: colors.selected },
    badge: {
      alignItems: "center",
      backgroundColor: colors.muted,
      borderRadius: 3,
      flexShrink: 0,
      justifyContent: "center",
      minHeight: 16,
      minWidth: 16,
    },
    badgeText: { color: colors.bg, fontSize: 12, lineHeight: 15 },
    closeTab: {
      alignItems: "center",
      height: 48,
      justifyContent: "center",
      width: 48,
    },
    count: { fontSize: 14, lineHeight: 19, paddingHorizontal: 4 },
    divider: {
      backgroundColor: colors.border,
      height: StyleSheet.hairlineWidth,
    },
    footer: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    footerButton: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 8,
    },
    framedSurface: {
      backgroundColor: colors.bg,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: "column",
      overflow: "hidden",
    },
    grip: {
      backgroundColor: colors.faint,
      borderRadius: 2,
      height: 4,
      opacity: 0.5,
      width: 32,
    },
    gripTarget: { alignItems: "center", height: 28, justifyContent: "center" },
    menuRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 8,
    },
    menuText: { color: colors.muted, fontSize: 14, lineHeight: 19 },
    moreRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 48,
      paddingHorizontal: 12,
    },
    moreText: { fontSize: 14, lineHeight: 19 },
    openTab: { alignItems: "center", borderRadius: 6, flexDirection: "row" },
    openTabMain: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      minWidth: 0,
      paddingLeft: 8,
    },
    openTabTitle: { flex: 1, fontSize: 14, lineHeight: 19 },
    pressed: { opacity: 0.6 },
    project: {
      alignItems: "center",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
      gap: 8,
      minHeight: 40,
      paddingHorizontal: 14,
    },
    projectName: { flex: 1, fontSize: 14, lineHeight: 19 },
    recentTitle: {
      fontSize: 12,
      lineHeight: 17,
      paddingBottom: 4,
      paddingHorizontal: 8,
      paddingTop: 12,
    },
    selectedTab: { borderBottomColor: colors.text },
    serverDetail: { fontSize: 12, lineHeight: 17 },
    serverName: { fontSize: 14, lineHeight: 19 },
    serverRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 56,
      paddingHorizontal: 8,
    },
    serverText: { flex: 1, minWidth: 0 },
    sessionTab: {
      alignItems: "center",
      borderBottomColor: "transparent",
      borderBottomWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 48,
    },
    sessionTabs: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      flexDirection: "row",
    },
    sheetContent: { gap: 0, padding: 12, paddingBottom: 4, paddingTop: 0 },
    strip: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      paddingHorizontal: 16,
    },
    stripTitle: { flex: 1, fontSize: 14, lineHeight: 19 },
    surface: { flex: 1, minHeight: 0, minWidth: 0 },
    tabText: { fontSize: 14, lineHeight: 19 },
  });
