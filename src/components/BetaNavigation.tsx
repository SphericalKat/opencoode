import React, { useMemo } from 'react';
import { ActivityIndicator, PanResponder, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { Label, Sheet } from './ui';
import { ShellIcon } from './ShellIcon';
import { NavIcon } from './Icons';
import { useTheme, useThemedStyles, type ThemeColors } from '../lib/theme';

export type OpenSessionTab = { id: string; title: string; directory: string };
export type SessionPane = 'Session' | 'Changes' | 'Files' | 'Terminal' | 'Worktrees';

export function SessionSurface({ framed, style, children }: { framed: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.surface, style, framed && styles.framedSurface]}>{children}</View>;
}

function HomeIcon({ color }: { color: string }) {
  return <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden><Rect x={2} y={2} width={4} height={4} stroke={color} /><Rect x={10} y={2} width={4} height={4} stroke={color} /><Rect x={2} y={10} width={4} height={4} stroke={color} /><Path d="M12 9v6M9 12h6" stroke={color} /></Svg>;
}

function ProjectBadge({ directory }: { directory: string }) {
  const styles = useThemedStyles(createStyles);
  const name = directory.split(/[\\/]/).filter(Boolean).pop() || 'Project';
  return <View style={styles.badge}><Label style={styles.badgeText}>{name.slice(0, 1).toUpperCase()}</Label></View>;
}

export function BetaTabStrip({ current, count, busy, onOpen }: { current?: OpenSessionTab; count: number; busy?: boolean; onOpen: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Tabs. ${current?.title || 'Home'}. ${count} open ${count === 1 ? 'session' : 'sessions'}`} onPress={onOpen} style={({ pressed }) => [styles.strip, pressed && styles.pressed]}>
    {current ? <ProjectBadge directory={current.directory} /> : <HomeIcon color={colors.muted} />}
    <Label numberOfLines={1} style={styles.stripTitle}>{current?.title || 'Home'}</Label>
    {busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Label muted style={styles.count}>{count}</Label>}
  </Pressable>;
}

export function BetaSessionNavigation({ pane, directory, onSelect, onMore, onProject, changes = true }: { pane: SessionPane; directory: string; onSelect: (pane: 'Session' | 'Changes') => void; onMore: () => void; onProject?: () => void; changes?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <>
    <View accessibilityRole="tablist" accessibilityLabel="Session view" style={styles.sessionTabs}>
      {(['Session', 'Changes'] as const).filter(item => item === 'Session' || changes).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: pane === item }} onPress={() => onSelect(item)} style={({ pressed }) => [styles.sessionTab, pane === item && styles.selectedTab, pressed && styles.pressed]}><Label style={[styles.tabText, { color: pane === item ? colors.text : colors.muted }]}>{item}</Label></Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="More session views" onPress={onMore} style={({ pressed }) => [styles.sessionTab, pane !== 'Session' && pane !== 'Changes' && styles.selectedTab, pressed && styles.pressed]}><Label style={styles.tabText}>{pane !== 'Session' && pane !== 'Changes' ? pane : 'More…'}</Label></Pressable>
    </View>
    <Pressable accessibilityRole={onProject ? 'button' : undefined} accessibilityLabel={`Project: ${directory}${onProject ? '. Open project' : ''}`} disabled={!onProject} onPress={onProject} style={({ pressed }) => [styles.project, pressed && styles.pressed]}><ProjectBadge directory={directory} /><Label muted numberOfLines={1} style={styles.projectName}>{directory.split(/[\\/]/).filter(Boolean).pop() || directory}</Label></Pressable>
  </>;
}

export function SheetGrip({ onClose }: { onClose: () => void }) {
  const styles = useThemedStyles(createStyles);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, state) => state.dy > 8 && state.dy > Math.abs(state.dx),
    onPanResponderRelease: (_, state) => { if (state.dy > 40 || state.vy > 0.5) onClose(); },
  }), [onClose]);
  return <View accessible={false} style={styles.gripTarget} {...pan.panHandlers}><View style={styles.grip} /></View>;
}

export function BetaTabsSheet({ visible, tabs, recent = [], selectedID, onClose, onDismiss, onSelect, onCloseTab, onNew, onHome, onSettings, onHelp }: {
  visible: boolean; tabs: OpenSessionTab[]; selectedID?: string; onClose: () => void; onDismiss: () => void;
  recent?: OpenSessionTab[];
  onSelect: (id: string) => void; onCloseTab?: (id: string) => void; onNew: () => void; onHome?: () => void; onSettings: () => void; onHelp: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <Sheet visible={visible} title="Tabs" fitContent showHeader={false} onClose={onClose} onDismiss={onDismiss} contentStyle={styles.sheetContent}>
    <SheetGrip onClose={onClose} />
    {tabs.map(item => <View key={item.id} style={[styles.openTab, selectedID === item.id && styles.activeTab]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} accessibilityState={{ selected: selectedID === item.id }} onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.openTabMain, pressed && styles.pressed]}><ProjectBadge directory={item.directory} /><Label numberOfLines={1} style={styles.openTabTitle}>{item.title}</Label></Pressable>
      {onCloseTab && <Pressable accessibilityRole="button" accessibilityLabel={`Close tab ${item.title}`} onPress={() => onCloseTab(item.id)} style={({ pressed }) => [styles.closeTab, pressed && styles.pressed]}><ShellIcon name="close" size={14} color={colors.faint} /></Pressable>}
    </View>)}
    {recent.some(item => !tabs.some(tab => tab.id === item.id)) && <><Label muted style={styles.recentTitle}>Recent sessions</Label>{recent.filter(item => !tabs.some(tab => tab.id === item.id)).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => onSelect(item.id)} style={({ pressed }) => [styles.openTabMain, pressed && styles.pressed]}><ProjectBadge directory={item.directory} /><Label numberOfLines={1} style={styles.openTabTitle}>{item.title}</Label></Pressable>)}</>}
    <Pressable accessibilityRole="button" onPress={onNew} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}><ShellIcon name="compose" size={16} color={colors.muted} /><Label style={styles.menuText}>New session</Label></Pressable>
    <View style={styles.divider} />
    {onHome && <Pressable accessibilityRole="button" onPress={onHome} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}><HomeIcon color={colors.muted} /><Label style={styles.menuText}>Home</Label></Pressable>}
    <View style={styles.footer}>
      <Pressable accessibilityRole="button" onPress={onSettings} style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}><NavIcon name="settings" color={colors.muted} size={16} /><Label style={styles.menuText}>Settings</Label></Pressable>
      <Pressable accessibilityRole="button" onPress={onHelp} style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}><Label muted style={styles.menuText}>ⓘ</Label><Label style={styles.menuText}>Help</Label></Pressable>
    </View>
  </Sheet>;
}

export function BetaMoreSheet({ visible, pane = 'Session', onClose, onDismiss, onView, onUsage, onDetails }: {
  visible: boolean; pane?: SessionPane; onClose: () => void; onDismiss: () => void;
  onView?: (pane: 'Files' | 'Terminal' | 'Worktrees') => void; onUsage?: () => void; onDetails?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <Sheet visible={visible} title="More options" fitContent showHeader={false} contentStyle={styles.sheetContent} onClose={onClose} onDismiss={onDismiss}>
    <SheetGrip onClose={onClose} />
    {onView && (['Files', 'Terminal', 'Worktrees'] as const).map(view => <Pressable key={view} accessibilityRole="button" onPress={() => onView(view)} style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}><Label style={styles.moreText}>{view}</Label><Label muted>{pane === view ? '✓' : ''}</Label></Pressable>)}
    {onUsage && <Pressable accessibilityRole="button" onPress={onUsage} style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}><Label style={styles.moreText}>Usage</Label></Pressable>}
    {onDetails && <Pressable accessibilityRole="button" onPress={onDetails} style={({ pressed }) => [styles.moreRow, pressed && styles.pressed]}><Label style={styles.moreText}>Session details</Label><ShellIcon name="chevron" size={14} color={colors.muted} /></Pressable>}
  </Sheet>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  surface: { flex: 1, minHeight: 0, minWidth: 0 }, framedSurface: { flexDirection: 'column', borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.bg, overflow: 'hidden' }, recentTitle: { fontSize: 11, lineHeight: 16, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 4 },
  strip: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  stripTitle: { flex: 1, fontSize: 13, lineHeight: 18 }, count: { fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
  badge: { width: 16, height: 16, borderRadius: 3, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, badgeText: { fontSize: 11, lineHeight: 14, color: colors.bg },
  sessionTabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  sessionTab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: 'transparent' },
  selectedTab: { borderBottomColor: colors.text }, tabText: { fontSize: 13, lineHeight: 18 },
  project: { flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 14, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, projectName: { fontSize: 13, lineHeight: 18, flex: 1 },
  sheetContent: { padding: 12, paddingTop: 0, paddingBottom: 4, gap: 0 },
  gripTarget: { height: 28, justifyContent: 'center', alignItems: 'center' }, grip: { width: 32, height: 4, borderRadius: 2, backgroundColor: colors.faint, opacity: 0.5 },
  openTab: { flexDirection: 'row', alignItems: 'center', borderRadius: 6 }, activeTab: { backgroundColor: colors.selected },
  openTabMain: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, gap: 8 }, openTabTitle: { flex: 1, fontSize: 13, lineHeight: 18 },
  closeTab: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  menuRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 8 }, menuText: { fontSize: 13, lineHeight: 18, color: colors.muted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, footerButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 8 },
  moreRow: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, moreText: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.6 },
});
