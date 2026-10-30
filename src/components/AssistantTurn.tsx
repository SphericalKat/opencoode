import React, { memo, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { SessionMessageAssistant, SessionMessageInfo } from '@opencode/client';
import type { Client } from '../lib/client';
import type { AgentActivity } from '../lib/activity';
import { MessageActionsContext, MessageDisclosureContext } from '../lib/messageActions';
import { type ThemeColors, useTheme, useThemedStyles } from '../lib/theme';
import { useBetaLayout } from '../lib/betaLayout';
import { ErrorNotice, Label, mono } from './ui';
import { Markdown } from './Markdown';
import { ResponseFooter } from './ResponseFooter';
import { MotionDisclosureBody, MotionDisclosureChevron, WorkingIndicator } from './motion';
import { ToolCallDetails, toolDetail, toolDisplayName } from './ToolCallDetails';

export type TranscriptItem = { type: 'message'; id: string; message: SessionMessageInfo } | { type: 'assistant-turn'; id: string; messages: SessionMessageAssistant[] };
type Turn = Extract<TranscriptItem, { type: 'assistant-turn' }>;
type Part = SessionMessageAssistant['content'][number];
type Entry = { key: string; message: SessionMessageAssistant; index: number; part?: Part; error?: string };
type SourceRenderer = (message: SessionMessageAssistant, key: string, content: React.ReactNode) => React.ReactNode;

export function groupTranscriptMessages(messages: SessionMessageInfo[], previous: TranscriptItem[]): TranscriptItem[] {
  const previousItems = new Map(previous.map(item => [item.id, item]));
  const previousTurns = new Map<string, Turn>();
  for (const item of previous) if (item.type === 'assistant-turn') for (const message of item.messages) previousTurns.set(message.id, item);
  const items: TranscriptItem[] = [];
  const usedIDs = new Set<string>();
  let assistants: SessionMessageAssistant[] = [];
  const flush = () => {
    if (!assistants.length) return;
    const existing = assistants.map(message => previousTurns.get(message.id)).find(item => item !== undefined && !usedIDs.has(item.id));
    const unchanged = existing && existing.messages.length === assistants.length && existing.messages.every((message, index) => message === assistants[index]);
    const item: Turn = unchanged ? existing : { type: 'assistant-turn', id: existing?.id ?? assistants[0].id, messages: assistants };
    usedIDs.add(item.id);
    items.push(item);
    assistants = [];
  };
  for (const message of messages) {
    if (message.type === 'idle' && !message.error) continue;
    if (message.type === 'assistant') { assistants.push(message); continue; }
    flush();
    const existing = previousItems.get(message.id);
    items.push(existing?.type === 'message' && existing.message === message ? existing : { type: 'message', id: message.id, message });
  }
  flush();
  return items;
}

function useDisclosure(key: string, revealChild = false) {
  const disclosures = useContext(MessageDisclosureContext);
  const collapsedKey = `${key}:collapsed`;
  const [open, setOpen] = useState(() => disclosures?.isOpen(key) || revealChild && !disclosures?.isOpen(collapsedKey));
  useLayoutEffect(() => {
    if (!revealChild || disclosures?.isOpen(collapsedKey)) return;
    disclosures?.setOpen(key, true);
    setOpen(true);
  }, [revealChild, disclosures, collapsedKey, key]);
  const toggle = () => {
    const next = disclosures ? disclosures.toggle(key) : !open;
    disclosures?.setOpen(collapsedKey, !next);
    setOpen(next);
  };
  return { open: !!open, toggle };
}

function Chevron({ open }: { open: boolean }) {
  const { colors } = useTheme();
  return <MotionDisclosureChevron open={open}><Svg width={12} height={12} viewBox="0 0 16 16" fill="none" aria-hidden><Path d="m6 4 4 4-4 4" stroke={colors.faint} strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" /></Svg></MotionDisclosureChevron>;
}

export const AssistantActivityPart = memo(function AssistantActivityPart({ part, detailsKey, live, activityKind, animate, client, directory, selectable }: {
  part: Part; detailsKey: string; live: boolean; activityKind?: AgentActivity['kind']; animate?: boolean; client?: Client; directory: string; selectable: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const actions = useContext(MessageActionsContext);
  const { open, toggle } = useDisclosure(detailsKey);
  if (part.type === 'text') return <Markdown text={part.text} selectable={selectable} />;
  const waiting = activityKind === 'approval' || activityKind === 'question' || activityKind === 'retry';
  const busy = live && !waiting && (part.type === 'reasoning' ? part.time?.completed === undefined : part.state.status === 'streaming' || part.state.status === 'running');
  const title = part.type === 'reasoning' ? busy ? 'Thinking' : 'Thought' : toolDisplayName(part.name);
  const duration = part.type === 'reasoning' && part.time?.completed !== undefined ? `${Math.max(1, Math.round((part.time.completed - part.time.created) / 1000))}s` : undefined;
  const detail = part.type === 'tool' ? toolDetail(part) : undefined;
  return <View style={styles.activity}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}${duration ? ` ${duration}` : ''}${detail && !open ? `, ${detail}` : ''}`} accessibilityState={{ expanded: open, busy }} aria-expanded={open}
      onPress={event => { event.stopPropagation(); toggle(); }} onLongPress={Platform.OS === 'web' ? undefined : actions}
      style={({ pressed }) => [styles.activityHeader, pressed && { backgroundColor: colors.raised }]}>
      <Label style={styles.activityTitle}>{title}</Label>
      {duration && <Label muted style={styles.duration}>{duration}</Label>}
      <Chevron open={open} />
      {busy && <WorkingIndicator active={!!animate} color={colors.muted} size={12} />}
      {!open && detail && <Label muted numberOfLines={1} style={styles.preview}>{detail}</Label>}
    </Pressable>
    <MotionDisclosureBody open={open} style={part.type === 'reasoning' ? styles.thoughtBody : styles.toolBody}>
      {part.type === 'reasoning' ? <Markdown text={part.text} muted selectable={selectable} /> : <ToolCallDetails tool={part} client={client} directory={directory} selectable={selectable} />}
    </MotionDisclosureBody>
    {!open && part.type === 'tool' && part.state.status === 'error' && <ErrorNotice error={part.state.error.message || 'The tool failed'} />}
  </View>;
});

function entryKey(message: SessionMessageAssistant, part: Part, index: number) {
  return `${message.id}:${part.type === 'tool' ? part.id : index}`;
}

export const AssistantTurn = memo(function AssistantTurn({ turn, liveMessageID, activityKind, animate, client, directory, renderSource }: {
  turn: Turn; liveMessageID?: string; activityKind?: AgentActivity['kind']; animate: boolean; client?: Client; directory: string; renderSource: SourceRenderer;
}) {
  const styles = useThemedStyles(createStyles);
  const betaLayout = useBetaLayout();
  const entries = useMemo<Entry[]>(() => turn.messages.flatMap(message => [
    ...message.content.map((part, index) => ({ message, part, index, key: entryKey(message, part, index) })),
    ...(message.error ? [{ message, error: message.error.message, index: message.content.length, key: `${message.id}:error` }] : []),
  ]), [turn.messages]);
  const active = turn.messages.some(message => message.id === liveMessageID);
  const isLive = (entry: Entry) => {
    const part = entry.part;
    return active && !!part && (part.type === 'tool' ? part.state.status === 'running' || part.state.status === 'streaming' : part.type === 'reasoning' && entry.message.id === liveMessageID && entry.index === entry.message.content.length - 1 && part.time?.completed === undefined);
  };
  const firstLive = entries.findIndex(isLive);
  const completedActivities = entries.filter((entry, index) => entry.part && entry.part.type !== 'text' && (firstLive < 0 || index < firstLive));
  const first = completedActivities[0];
  const last = completedActivities[completedActivities.length - 1];
  const start = first ? entries.indexOf(first) : -1;
  const end = last ? entries.indexOf(last) : -1;
  const renderEntry = (entry: Entry) => renderSource(entry.message, entry.key, entry.part ? <AssistantActivityPart part={entry.part} detailsKey={entry.key} live={isLive(entry)} activityKind={activityKind} animate={animate} client={client} directory={directory} selectable={false} /> : <ErrorNotice error={entry.error || 'The assistant reported an error'} />);
  const finalText = entries.findLast(entry => entry.part?.type === 'text' && !!entry.part.text.trim());
  return <View style={styles.turn}>
    {entries.slice(0, start < 0 ? entries.length : start).map(entry => <React.Fragment key={entry.key}>{renderEntry(entry)}</React.Fragment>)}
    {first && <TurnActivities key={turn.id} turnID={turn.id} entries={entries.slice(start, end + 1)} activities={completedActivities} renderEntry={renderEntry} renderSource={renderSource} />}
    {start >= 0 && entries.slice(end + 1).map(entry => <React.Fragment key={entry.key}>{renderEntry(entry)}</React.Fragment>)}
    {betaLayout && !active && finalText && <ResponseFooter text={turn.messages.flatMap(message => message.content.flatMap(part => part.type === 'text' ? [part.text] : [])).join('\n\n')} elapsedSeconds={finalText.message.time.completed === undefined ? undefined : Math.max(0, Math.round((finalText.message.time.completed - turn.messages[0].time.created) / 1000))} />}
  </View>;
});

function TurnActivities({ turnID, entries, activities, renderEntry, renderSource }: {
  turnID: string; entries: Entry[]; activities: Entry[]; renderEntry: (entry: Entry) => React.ReactNode; renderSource: SourceRenderer;
}) {
  const styles = useThemedStyles(createStyles);
  const disclosures = useContext(MessageDisclosureContext);
  const childOpen = activities.some(entry => disclosures?.isOpen(entry.key));
  const { open, toggle } = useDisclosure(`turn:${turnID}:activities`, childOpen);
  const counts = new Map<string, number>();
  for (const entry of activities) if (entry.part?.type === 'tool') { const name = toolDisplayName(entry.part.name); counts.set(name, (counts.get(name) ?? 0) + 1); }
  if (!counts.size) counts.set('Thought', activities.filter(entry => entry.part?.type === 'reasoning').length);
  const labels = [...counts].map(([name, count]) => `${count} ${name}`).join(', ');
  return <View>
    {renderSource(activities[0].message, `turn:${turnID}:summary`, <ActivityGroupHeader labels={labels} open={open} onToggle={toggle} />)}
    <MotionDisclosureBody open={open} style={styles.groupBody}>{entries.map(entry => <React.Fragment key={entry.key}>{renderEntry(entry)}</React.Fragment>)}</MotionDisclosureBody>
    {!open && entries.map(entry => <React.Fragment key={entry.key}>{entry.error !== undefined && renderEntry(entry)}{entry.part?.type === 'tool' && entry.part.state.status === 'error' && renderSource(entry.message, `${entry.key}:error`, <ErrorNotice error={entry.part.state.error.message || 'The tool failed'} />)}</React.Fragment>)}
  </View>;
}

function ActivityGroupHeader({ labels, open, onToggle }: { labels: string; open: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const actions = useContext(MessageActionsContext);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Used ${labels}`} accessibilityState={{ expanded: open }} aria-expanded={open} onPress={event => { event.stopPropagation(); onToggle(); }} onLongPress={Platform.OS === 'web' ? undefined : actions}
    style={({ pressed }) => [styles.groupHeader, pressed && { backgroundColor: colors.raised }]}><Label muted style={styles.groupTitle}>Used <Text style={{ color: colors.text }}>{labels}</Text></Label><Chevron open={open} /></Pressable>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  turn: { gap: 6 }, activity: { minWidth: 0 },
  groupHeader: { minHeight: Platform.OS === 'android' ? 48 : 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6 },
  groupTitle: { fontSize: 13, lineHeight: 20, flexShrink: 1 }, groupBody: { paddingLeft: 12 },
  activityHeader: { minHeight: Platform.OS === 'android' ? 48 : 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6 },
  activityTitle: { fontSize: 13, lineHeight: 20, flexShrink: 0 }, duration: { fontSize: 12, lineHeight: 18 },
  preview: { fontFamily: mono, fontSize: 12, lineHeight: 18, flex: 1, minWidth: 0 },
  thoughtBody: { paddingLeft: 12, paddingBottom: 8 }, toolBody: { paddingBottom: 8 },
});
