import React, { memo, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { AgentActivity } from '../lib/activity';
import { MessageActionsContext, MessageDisclosureContext } from '../lib/messageActions';
import { type ThemeColors, useTheme, useThemedStyles } from '../lib/theme';
import { Label } from './ui';
import { WorkingIndicator } from './motion';

export const AgentActivityBar = memo(function AgentActivityBar({ activity, connected, sending, stopping, animate, onReview }: {
  activity: AgentActivity; connected: boolean; sending: boolean; stopping: boolean; animate: boolean; onReview: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const retry = connected && !stopping ? activity.retry : undefined;
  const [now, setNow] = useState(Date.now);
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    setShowError(false);
    if (!retry || !animate) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retry?.at, retry?.attempt, animate]);
  const blocked = connected && !stopping && (activity.kind === 'approval' || activity.kind === 'question');
  const seconds = retry ? Math.max(0, Math.ceil((retry.at - now) / 1000)) : 0;
  const label = !connected ? 'Reconnecting' : stopping ? 'Stopping' : retry ? `${seconds ? `Retrying in ${seconds}s` : 'Retrying now'} · Attempt ${retry.attempt}` : sending && activity.kind === 'idle' ? 'Sending' : activity.label;
  const announcement = !connected ? 'Reconnecting' : stopping ? 'Stopping' : retry ? 'Waiting to retry' : sending && activity.kind === 'idle' ? 'Sending' : activity.label;
  const lastAnnouncement = useRef(announcement);
  useEffect(() => {
    if (lastAnnouncement.current === announcement) return;
    lastAnnouncement.current = announcement;
    if (animate && Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(announcement || 'Agent is ready');
  }, [announcement, animate]);
  const busy = !!label && connected && !blocked;
  return <View style={styles.lane}>
    <View style={styles.bar}>
      <View style={styles.summary} accessibilityLiveRegion="polite" aria-live="polite" accessibilityLabel={label || undefined}>
        {!!label && (busy ? <WorkingIndicator active={animate} color={colors.muted} size={14} /> : <Svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden><Path d={blocked ? 'M8 2 14 13H2L8 2ZM8 6v3m0 2v.1' : 'M3 3l10 10M13 3 3 13'} stroke={colors.muted} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" /></Svg>)}
        <Label muted numberOfLines={1} style={styles.label}>{label}</Label>
      </View>
      {blocked && <Pressable accessibilityRole="button" accessibilityLabel="Review pending requests" onPress={onReview} style={styles.action}><Label style={styles.actionText}>Review ↓</Label></Pressable>}
      {retry && <Pressable accessibilityRole="button" accessibilityLabel="Retry details" accessibilityState={{ expanded: showError }} onPress={() => setShowError(value => !value)} style={styles.action}><Label muted style={styles.actionText}>{showError ? 'Less' : 'Details'}</Label></Pressable>}
    </View>
    {retry && showError && <Label style={styles.retryError}>{retry.message}</Label>}
  </View>;
});

export function ActivityDisclosure({ detailsKey, title, detail, busy, animate, failed, complete = true, children }: {
  detailsKey: string; title: string; detail?: string; busy?: boolean; animate?: boolean; failed?: boolean; complete?: boolean; children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const actions = useContext(MessageActionsContext);
  const disclosures = useContext(MessageDisclosureContext);
  const [open, setOpen] = useState(() => disclosures?.isOpen(detailsKey) ?? false);
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}${detail ? `, ${detail}` : ''}`} accessibilityState={{ expanded: open }} aria-expanded={open}
      onPress={() => setOpen(disclosures ? disclosures.toggle(detailsKey) : !open)} onLongPress={Platform.OS === 'web' ? undefined : actions}
      style={({ pressed }) => [styles.disclosureHeader, pressed && { backgroundColor: colors.raised }]}>
      {busy ? <WorkingIndicator active={!!animate} color={colors.muted} size={14} /> : <Svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden><Path d={failed ? 'm4 4 8 8m0-8-8 8' : complete ? 'm3.5 8 3 3 6-6' : 'M5 4v8m6-8v8'} stroke={failed ? colors.danger : colors.muted} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" /></Svg>}
      <View style={styles.disclosureTitle}><Label muted style={styles.label}>{title}</Label>{!!detail && <Label muted numberOfLines={1} style={styles.detail}>{detail}</Label>}</View>
      <Svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden><Path d={open ? 'm4 6 4 4 4-4' : 'm6 4 4 4-4 4'} stroke={colors.faint} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" /></Svg>
    </Pressable>
    {open && <View style={styles.disclosureBody}>{children}</View>}
  </View>;
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  lane: { width: '100%', maxWidth: 736, minHeight: 44 },
  bar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  summary: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, lineHeight: 20, flexShrink: 1 },
  action: { minHeight: Platform.OS === 'android' ? 48 : 44, paddingHorizontal: 8, justifyContent: 'center' },
  actionText: { fontSize: 12, fontWeight: '500' },
  retryError: { color: colors.danger, fontSize: 12, lineHeight: 18, paddingHorizontal: 6, paddingBottom: 10 },
  disclosureHeader: { minHeight: Platform.OS === 'android' ? 48 : 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 6 },
  disclosureTitle: { flex: 1, minWidth: 0 },
  detail: { fontSize: 11, lineHeight: 16, fontFamily: 'IBMPlexMono' },
  disclosureBody: { marginLeft: 10, paddingLeft: 14, paddingVertical: 8, borderLeftWidth: 1, borderLeftColor: colors.border, gap: 10 },
}); }
