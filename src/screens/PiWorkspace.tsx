import React, { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, BackHandler, Image, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Svg, { Path, Rect } from 'react-native-svg';
import type { PiCommand, PiEventBatch, PiMessage, PiModel, PiSessionSummary, PiSnapshot, PiToolActivity } from '../../packages/pi-mobile/protocol';
import { type Connection, errorMessage } from '../lib/client';
import { createPiClient, PiConnectionError } from '../lib/piClient';
import { loadDraft, saveDraft } from '../lib/drafts';
import { useNativePresentation } from '../lib/sheets';
import { createStreamBatch } from '../lib/streamBatch';
import { MessageActionsContext, MessageDisclosureContext } from '../lib/messageActions';
import { useTheme, useThemedStyles, type ThemeColors } from '../lib/theme';
import { ActivityDisclosure } from '../components/AgentActivity';
import { BetaTabStrip, SheetGrip } from '../components/BetaNavigation';
import { Markdown } from '../components/Markdown';
import { ShellIcon } from '../components/ShellIcon';
import { WorkingIndicator } from '../components/motion';
import { Button, Busy, Empty, ErrorNotice, Field, Label, Sheet, confirmAction, mono } from '../components/ui';

type Props = { connection: Connection; onManageServers: () => void; onConnectionLost: (error: unknown) => void; foreground: boolean };
type Panel = 'sessions' | 'models' | 'thinking' | 'more' | 'delivery' | null;
type Attachment = { uri: string; name?: string; mimeType: string };
type Draft = { key: string; text: string; delivery: 'steer' | 'followUp'; files: Attachment[] };
const imageLimit = 3_000_000;
const bodyLimit = 5_000_000;
const messageKey = (message: PiMessage) => message.id;
const messageType = (message: PiMessage) => message.role;
const separator = () => <View style={{ height: 24 }} />;
const textOf = (message: PiMessage) => message.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('\n\n');

function applyBatches(previous: PiSnapshot, batches: PiEventBatch[]): PiSnapshot {
  const messages = new Map(previous.messages.map(message => [message.id, message]));
  const tools = new Map(previous.tools.map(tool => [tool.id, tool]));
  let session = previous.session;
  let waiting = previous.waiting;
  for (const batch of batches) {
    for (const event of batch.events) {
      if (event.type === 'message') messages.set(event.message.id, event.message);
      if (event.type === 'tool') tools.set(event.tool.id, event.tool);
      if (event.type === 'session') session = event.session;
      if (event.type === 'waiting') waiting = event.waiting;
    }
  }
  return { ...previous, cursor: batches[batches.length - 1].cursor, messages: [...messages.values()], tools: [...tools.values()], session, waiting };
}

export function PiWorkspace(props: Props) {
  return <PiWorkspaceSession key={`${props.connection.id}:${props.connection.url}`} {...props} />;
}

function PiWorkspaceSession({ connection, onManageServers, onConnectionLost, foreground }: Props) {
  const { colors, appearance, setAppearance } = useTheme();
  const styles = useThemedStyles(createStyles);
  const withNativePresentation = useNativePresentation();
  const client = useMemo(() => createPiClient(connection), [connection]);
  const [snapshot, setSnapshot] = useState<PiSnapshot | null>(null);
  const [status, setStatus] = useState('Connecting');
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [models, setModels] = useState<PiModel[]>([]);
  const [sessions, setSessions] = useState<PiSessionSummary[]>([]);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [screenReader, setScreenReader] = useState(false);
  const [draft, setDraft] = useState<Draft>({ key: '', text: '', delivery: 'steer', files: [] });
  const [composerHeight, setComposerHeight] = useState(44);
  const [following, setFollowing] = useState(true);
  const list = useRef<FlashListRef<PiMessage>>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const alive = useRef(true);
  const submitting = useRef(false);
  const preparing = useRef(false);
  const pickerActive = useRef(false);
  const followingRef = useRef(true);
  const dragging = useRef(false);
  const nearEnd = useRef(true);
  const followFrame = useRef<number | undefined>(undefined);
  const recoveryRef = useRef(onConnectionLost);
  recoveryRef.current = onConnectionLost;
  const expanded = useRef(new Set<string>());
  const stableTools = useRef(new Map<string, PiToolActivity>());
  const session = snapshot?.session;
  const draftKey = session ? `pi:${connection.id}:${session.id}` : '';
  const draftReady = !!draftKey && draft.key === draftKey;
  const ready = status === 'Live' && foreground && !!session;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const busy = !!session && !session.idle;
  const canManage = ready && !busy && !snapshot?.waiting && !pending && !attachmentBusy;
  const hasPrompt = !!draft.text.trim() || !!draft.files.length;

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(value => { if (current) setScreenReader(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => { current = false; subscription.remove(); };
  }, []);

  const detach = useCallback(() => {
    followingRef.current = false;
    setFollowing(false);
  }, []);
  const followContent = useCallback(() => {
    if (!followingRef.current || dragging.current || followFrame.current !== undefined) return;
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = undefined;
      if (alive.current && followingRef.current && !dragging.current) list.current?.getNativeScrollRef()?.scrollToEnd({ animated: false });
    });
  }, []);
  const jumpToLatest = useCallback(() => {
    dragging.current = false;
    nearEnd.current = true;
    followingRef.current = true;
    setFollowing(true);
    setSelected(null);
    list.current?.scrollToEnd({ animated: false });
  }, []);
  useEffect(() => () => { if (followFrame.current !== undefined) cancelAnimationFrame(followFrame.current); }, []);
  const updateScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    nearEnd.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 48;
  }, []);
  const finishScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    updateScroll(event);
    dragging.current = false;
    followingRef.current = nearEnd.current;
    setFollowing(nearEnd.current);
  }, [updateScroll]);
  const selectMessage = useCallback((id: string) => { detach(); Keyboard.dismiss(); setSelected(id); }, [detach]);
  const disclosures = useMemo(() => ({
    isOpen: (key: string) => expanded.current.has(key),
    toggle: (key: string) => {
      detach();
      const open = !expanded.current.has(key);
      if (open) expanded.current.add(key); else expanded.current.delete(key);
      return open;
    },
  }), [detach]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !selected) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setSelected(null); return true; });
    return () => subscription.remove();
  }, [selected]);

  useEffect(() => {
    if (!draftKey) return;
    let current = true;
    void loadDraft(draftKey).then(saved => {
      if (current) setDraft({ key: draftKey, text: saved?.text ?? '', delivery: saved?.delivery === 'queue' ? 'followUp' : 'steer', files: (saved?.files ?? []).map(file => ({ ...file, mimeType: attachmentMime(file) })) });
    }).catch(reason => {
      if (current) {
        setDraft({ key: draftKey, text: '', delivery: 'steer', files: [] });
        setError(`The saved draft did not load. ${errorMessage(reason)}`);
      }
    });
    return () => {
      current = false;
      const value = draftRef.current;
      if (value.key === draftKey) void persistDraft(value).catch(() => {});
    };
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady) return;
    const timer = setTimeout(() => {
      void persistDraft(draft).catch(reason => { if (alive.current) setError(`The draft did not save. ${errorMessage(reason)}`); });
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, draftReady]);

  useEffect(() => {
    if (!foreground && draftRef.current.key) void persistDraft(draftRef.current).catch(reason => {
      if (alive.current) setError(`The draft did not save. ${errorMessage(reason)}`);
    });
  }, [foreground]);

  useEffect(() => {
    if (!foreground) { setStatus('Paused'); return; }
    const controller = new AbortController();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const batcher = createStreamBatch<PiEventBatch>(batches => {
      if (!controller.signal.aborted) setSnapshot(previous => previous ? applyBatches(previous, batches) : previous);
    }, { delayMs: 50 });
    void (async () => {
      let failures = 0;
      while (!controller.signal.aborted) {
        try {
          setStatus(failures ? 'Reconnecting' : 'Connecting');
          const next = await client.snapshot(controller.signal);
          if (controller.signal.aborted) return;
          const changed = snapshotRef.current?.session.id !== next.session.id || snapshotRef.current?.instanceID !== next.instanceID;
          if (changed) {
            setSelected(null);
            expanded.current.clear();
            dragging.current = false;
            nearEnd.current = true;
            followingRef.current = true;
            setFollowing(true);
          }
          snapshotRef.current = next;
          setSnapshot(next);
          setStatus('Live');
          for await (const batch of client.events(next.cursor, next.instanceID, controller.signal)) {
            if (controller.signal.aborted) return;
            if (batch.reset || batch.instanceID !== next.instanceID || batch.events.some(event => event.type === 'reset')) {
              batcher.clear();
              break;
            }
            failures = 0;
            batcher.push(batch);
          }
          batcher.flush();
        } catch (reason) {
          batcher.flush();
          if (controller.signal.aborted) return;
          failures++;
          if (failures >= 2 || reason instanceof PiConnectionError && (reason.status === 401 || reason.status === 403)) {
            setStatus('Disconnected');
            recoveryRef.current(reason);
            return;
          }
          setStatus('Reconnecting');
          await new Promise<void>(resolve => {
            retryTimer = setTimeout(resolve, 900);
            controller.signal.addEventListener('abort', () => { clearTimeout(retryTimer); resolve(); }, { once: true });
          });
        }
      }
    })();
    return () => { controller.abort(); clearTimeout(retryTimer); batcher.clear(); };
  }, [client, foreground, revision]);

  useEffect(() => {
    if (!foreground || panel !== 'models' && panel !== 'sessions') return;
    const controller = new AbortController();
    setCatalogBusy(true);
    setCatalogError(null);
    void (panel === 'models' ? client.models(controller.signal).then(setModels) : client.sessions(controller.signal).then(setSessions))
      .catch(reason => {
        if (controller.signal.aborted) return;
        if (reason instanceof PiConnectionError && (reason.status === 401 || reason.status === 403)) recoveryRef.current(reason);
        else setCatalogError(errorMessage(reason));
      }).finally(() => { if (!controller.signal.aborted) setCatalogBusy(false); });
    return () => controller.abort();
  }, [client, panel, foreground, catalogRevision]);

  const run = useCallback(async (command: PiCommand, close = true): Promise<boolean> => {
    if (submitting.current || !readyRef.current || !alive.current) return false;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      await client.command(command);
      if (!alive.current) return true;
      if (close) setPanel(null);
      if (command.type === 'fork' || command.type === 'new' || command.type === 'switch') setSelected(null);
      setRevision(value => value + 1);
      return true;
    } catch (reason) {
      if (alive.current) {
        setError(errorMessage(reason));
        if (reason instanceof PiConnectionError && (reason.status === 401 || reason.status === 403)) recoveryRef.current(reason);
      }
      return false;
    } finally {
      submitting.current = false;
      if (alive.current) setPending(false);
    }
  }, [client]);
  const changeSession = async (command: Extract<PiCommand, { type: 'new' | 'switch' | 'fork' }>) => {
    if (!canManage) return;
    if (!await confirmAction('Change the terminal session?', 'This also changes the active session in the Pi terminal.', { confirmLabel: 'Continue', destructive: false })) return;
    if (draftReady) {
      try { await persistDraft(draft); }
      catch (reason) { setError(`The draft did not save. ${errorMessage(reason)}`); return; }
    }
    await run(command);
  };
  const attachImages = async () => {
    if (!draftReady || pickerActive.current || pending || attachmentBusy) return;
    pickerActive.current = true;
    const key = draft.key;
    Keyboard.dismiss();
    try {
      const result = await withNativePresentation(() => DocumentPicker.getDocumentAsync({ type: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], multiple: true, copyToCacheDirectory: true }));
      if (result.canceled || !alive.current) return;
      setAttachmentBusy(true);
      const files: Attachment[] = [];
      for (const asset of result.assets) {
        if (asset.size !== undefined && asset.size > imageLimit) throw new Error(`${asset.name} exceeds the 3 MB image limit`);
        const mimeType = asset.mimeType || attachmentMime(asset);
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(mimeType)) throw new Error('Attach a PNG, JPEG, WebP, or GIF image');
        let uri = asset.uri;
        if (Platform.OS === 'web' && asset.file) {
          uri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error(`Cannot read ${asset.name}`));
            reader.onload = () => resolve(String(reader.result));
            reader.readAsDataURL(asset.file!);
          });
        }
        const attachment = { uri, name: asset.name, mimeType };
        await readImage(attachment);
        files.push(attachment);
      }
      const latest = draftRef.current;
      if (!alive.current) return;
      if (latest.key !== key) throw new Error('The session changed. Attach the images again.');
      const next = { ...latest, files: [...latest.files, ...files] };
      await promptCommand(next);
      if (!alive.current) return;
      if (draftRef.current.key !== key || snapshotRef.current?.session.id !== session?.id) throw new Error('The session changed. Attach the images again.');
      setDraft(next);
    } catch (reason) { if (alive.current) setError(errorMessage(reason)); }
    finally { pickerActive.current = false; if (alive.current) setAttachmentBusy(false); }
  };
  const send = async () => {
    if (!draftReady || !hasPrompt || !ready || snapshot?.waiting || preparing.current || submitting.current) return;
    preparing.current = true;
    setAttachmentBusy(true);
    const sent = draft;
    try {
      const command = await promptCommand(sent, busy ? sent.delivery : undefined);
      if (!alive.current) return;
      if (draftRef.current.key !== sent.key || snapshotRef.current?.session.id !== session?.id) throw new Error('The session changed. Send the message again.');
      if (await run(command, false)) {
        const latest = draftRef.current;
        const next = latest.key === sent.key ? { ...latest, text: latest.text === sent.text ? '' : latest.text, files: latest.files.filter(file => !sent.files.includes(file)) } : { ...sent, text: '', files: [] };
        if (alive.current) {
          if (next.key === latest.key) setDraft(next);
          jumpToLatest();
        }
        await persistDraft(next).catch(reason => { if (alive.current) setError(`Message sent. The draft did not save. ${errorMessage(reason)}`); });
      }
    } catch (reason) { if (alive.current) setError(errorMessage(reason)); }
    finally { preparing.current = false; if (alive.current) setAttachmentBusy(false); }
  };
  const actionMessage = snapshot?.messages.find(message => message.id === selected);
  const tools = useMemo(() => {
    const values = new Map(snapshot?.tools.map(tool => [tool.id, tool]) ?? []);
    const inputs = new Map(snapshot?.messages.flatMap(message => message.content.flatMap(part => part.type === 'toolCall' ? [[part.id, part.arguments] as const] : [])) ?? []);
    for (const message of snapshot?.messages ?? []) {
      if (message.role !== 'toolResult' || !message.toolCallId) continue;
      const current = values.get(message.toolCallId);
      if (!current || current.output === undefined) values.set(message.toolCallId, {
        id: message.toolCallId, name: current?.name ?? message.toolName ?? 'Tool', input: current?.input ?? inputs.get(message.toolCallId) ?? {},
        output: textOf(message), status: message.isError ? 'error' : 'completed',
      });
    }
    const previous = stableTools.current;
    if (previous.size === values.size && [...values].every(([id, value]) => {
      const old = previous.get(id);
      return !!old && old.name === value.name && old.status === value.status && old.output === value.output && old.input === value.input;
    })) return previous;
    stableTools.current = values;
    return values;
  }, [snapshot?.tools, snapshot?.messages]);
  const toolCalls = useMemo(() => new Set(snapshot?.messages.flatMap(message => message.content.flatMap(part => part.type === 'toolCall' ? [part.id] : [])) ?? []), [snapshot?.messages]);
  const messages = useMemo(() => snapshot?.messages.filter(message => message.role !== 'toolResult' || !message.toolCallId || !toolCalls.has(message.toolCallId)) ?? [], [snapshot?.messages, toolCalls]);
  const activeTool = snapshot?.tools.find(tool => tool.status === 'running');
  const lastMessage = snapshot?.messages[snapshot.messages.length - 1];
  const thinking = busy && lastMessage?.role === 'assistant' && lastMessage.content[lastMessage.content.length - 1]?.type === 'thinking';
  const activity = !foreground ? 'Paused' : status !== 'Live' ? status : snapshot?.waiting ? 'Action required in terminal' : pending ? 'Sending' : busy ? activeTool ? activeTool.name : thinking ? 'Thinking' : 'Working' : '';
  const renderMessage = useCallback(({ item }: { item: PiMessage }) => <PiMessageRow message={item} tools={tools} active={!session?.idle && item.id === lastMessage?.id} idle={session?.idle ?? true} screenReader={screenReader} animate={foreground && status === 'Live'} selected={item.id === selected} selectionActive={!!selected} onSelect={selectMessage} />, [tools, session?.idle, lastMessage?.id, screenReader, foreground, status, selected, selectMessage]);
  const copy = () => {
    if (!actionMessage) return;
    void Clipboard.setStringAsync(textOf(actionMessage)).then(() => { if (alive.current) setSelected(null); }).catch(reason => setError(errorMessage(reason)));
  };
  const modelMatches = models.filter(model => `${model.provider} ${model.name} ${model.id}`.toLowerCase().includes(search.toLowerCase()));

  return <KeyboardAvoidingView style={styles.container} behavior="padding" automaticOffset>
    {actionMessage ? <View style={styles.selectionHeader}><IconButton name="close" label="Close message selection" onPress={() => setSelected(null)} /><Label style={styles.selectionCount}>1 selected</Label><Button title="Copy" variant="ghost" compact disabled={!textOf(actionMessage)} onPress={copy} /><Button title="Fork" variant="ghost" compact disabled={!canManage || actionMessage.role !== 'user'} onPress={() => { void changeSession({ type: 'fork', entryID: actionMessage.id }); }} /></View> : <View style={styles.topbar}><View style={styles.tab}><BetaTabStrip current={session ? { id: session.id, title: session.name || 'New session', directory: session.cwd } : undefined} count={1} busy={!ready} onOpen={() => setPanel('sessions')} /></View><IconButton name="more" label="Session actions" onPress={() => { setName(session?.name ?? ''); setPanel('more'); }} /></View>}
    {session && <View style={styles.project}><Label muted numberOfLines={1} style={styles.projectText}>{session.cwd}</Label><Label muted style={styles.connectionLabel}>Pi</Label></View>}
    {error && <View style={styles.error}><ErrorNotice error={error} /><Button title="Dismiss" compact variant="ghost" onPress={() => setError(null)} /></View>}
    <MessageDisclosureContext.Provider value={disclosures}><View style={styles.transcriptFrame}>
      {!snapshot ? <View style={styles.loading}><Busy /><Label muted>{status === 'Paused' ? 'The connection will resume with the app' : `${status} to Pi…`}</Label></View> : <FlashList key={`${snapshot.instanceID}:${snapshot.session.id}`} ref={list} data={messages} keyExtractor={messageKey} getItemType={messageType} renderItem={renderMessage} ItemSeparatorComponent={separator} style={styles.transcript} contentContainerStyle={styles.messages}
        maintainVisibleContentPosition={{ disabled: following }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onLoad={followContent} onContentSizeChange={followContent} onLayout={followContent} onScroll={updateScroll} scrollEventThrottle={16}
        onScrollBeginDrag={() => { dragging.current = true; detach(); }} onScrollEndDrag={finishScroll} onMomentumScrollBegin={() => { dragging.current = true; detach(); }} onMomentumScrollEnd={finishScroll}
        ListEmptyComponent={<Empty title="What do you want to work on?" detail="Continue with the Pi session from your terminal." />}
      />}
      {!following && <View style={styles.latest}><ActionButton kind="down" label="Jump to latest" onPress={jumpToLatest} /></View>}
    </View></MessageDisclosureContext.Provider>
    {snapshot?.waiting && <View accessibilityRole="alert" style={styles.waiting}><Label style={styles.waitingTitle}>{snapshot.waiting.title || 'Pi needs your input'}</Label><Label muted style={styles.waitingText}>Answer this {snapshot.waiting.kind || 'dialog'} in the Pi terminal. This app cannot answer terminal dialogs.</Label></View>}
    <View style={styles.composerDock}>
      {!!activity && <View style={styles.activity}><WorkingIndicator size={14} color={colors.muted} active={foreground && status === 'Live' && busy && !snapshot?.waiting} /><Label muted numberOfLines={1} accessibilityLiveRegion="polite" style={styles.activityLabel}>{activity}</Label></View>}
      <View style={styles.composer}>
        {draftReady && !!draft.files.length && <ScrollView horizontal contentContainerStyle={styles.attachments} keyboardShouldPersistTaps="handled">{draft.files.map((file, index) => <View key={`${file.uri}:${index}`} style={styles.attachment}><Image source={{ uri: file.uri }} accessibilityLabel={file.name || 'Attached image'} style={styles.attachmentImage} /><Label numberOfLines={1} style={styles.attachmentName}>{file.name || 'Image'}</Label><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${file.name || 'image'}`} disabled={pending || attachmentBusy} onPress={() => setDraft(current => ({ ...current, files: current.files.filter((_, fileIndex) => fileIndex !== index) }))} style={styles.iconTarget}><ShellIcon name="close" color={colors.muted} size={16} /></Pressable></View>)}</ScrollView>}
        <Field accessibilityLabel="Message Pi" placeholder="Ask anything…" multiline editable={draftReady && !pending && !attachmentBusy} value={draftReady ? draft.text : ''} onChangeText={text => setDraft(current => ({ ...current, text }))} onFocus={() => setSelected(null)} onContentSizeChange={event => setComposerHeight(Math.max(44, Math.min(132, event.nativeEvent.contentSize.height)))} style={[styles.composerInput, { height: draftReady && draft.text ? composerHeight : 44 }]} />
        <View style={styles.composerToolbar}>
          <Pressable accessibilityRole="button" accessibilityLabel="Attach images" accessibilityState={{ disabled: !draftReady || pending || attachmentBusy }} disabled={!draftReady || pending || attachmentBusy} onPress={() => { void attachImages(); }} style={styles.iconTarget}><Svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden><Path d="M8 3v10M3 8h10" stroke={colors.muted} strokeWidth={1.5} strokeLinecap="round" /></Svg></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Choose model, ${session?.model?.name || 'Pi default'}`} onPress={() => { setSearch(''); setPanel('models'); }} style={styles.modelTrigger}><Label muted numberOfLines={1} style={styles.modelText}>{session?.model?.name || 'Pi default'}</Label><Label muted style={styles.chevron}>⌄</Label></Pressable>
          {!!session?.model?.thinkingLevels.length && <Pressable accessibilityRole="button" accessibilityLabel={`Thinking level, ${session.thinkingLevel}`} onPress={() => setPanel('thinking')} style={styles.thinkingTrigger}><Label muted numberOfLines={1} style={styles.modelText}>{session.thinkingLevel}</Label><Label muted style={styles.chevron}>⌄</Label></Pressable>}
          {busy && hasPrompt && <Pressable accessibilityRole="button" accessibilityLabel="Message delivery" onPress={() => setPanel('delivery')} style={styles.deliveryTrigger}><Label muted style={styles.modelText}>{draft.delivery === 'steer' ? 'Steer' : 'Queue'}</Label></Pressable>}
          {busy && hasPrompt && <ActionButton kind="stop" label="Stop generation" disabled={!ready || pending || attachmentBusy} onPress={() => { void run({ type: 'abort' }, false); }} />}
          <ActionButton kind={busy && !hasPrompt ? 'stop' : 'up'} label={busy && !hasPrompt ? 'Stop generation' : busy ? draft.delivery === 'steer' ? 'Steer current work' : 'Queue message' : 'Send message'} busy={pending || attachmentBusy} disabled={!ready || (busy && !hasPrompt ? false : !draftReady || !hasPrompt || !!snapshot?.waiting)} onPress={() => { if (busy && !hasPrompt) void run({ type: 'abort' }, false); else void send(); }} />
        </View>
      </View>
    </View>
    <Sheet visible={panel === 'sessions'} title="Sessions" onClose={() => setPanel(null)} fitContent showHeader={false} contentStyle={styles.menu}>
      <SheetGrip onClose={() => setPanel(null)} />
      <Label accessibilityRole="header" style={styles.sheetTitle}>Sessions</Label>
      <ErrorNotice error={error} />
      <Label muted style={styles.sheetHint}>A session change also changes the active Pi terminal session.</Label>
      <Button title="New session" compact disabled={!canManage} onPress={() => { void changeSession({ type: 'new' }); }} />
      {busy && <Label muted style={styles.sheetHint}>Stop the current work before you change sessions.</Label>}
      <ErrorNotice error={catalogError} onRetry={() => setCatalogRevision(value => value + 1)} />
      {catalogBusy ? <Busy /> : <>{session && <SessionRow name={session.name || 'New session'} cwd={session.cwd} selected disabled onPress={() => setPanel(null)} />}{sessions.filter(item => item.id !== session?.id).map(item => <SessionRow key={item.id} name={item.name || 'Untitled session'} cwd={item.cwd} disabled={!canManage} onPress={() => { void changeSession({ type: 'switch', sessionID: item.id }); }} />)}</>}
      <View style={styles.divider} /><Button title="Manage servers" variant="ghost" compact onPress={() => { setPanel(null); onManageServers(); }} />
    </Sheet>
    <Sheet visible={panel === 'models'} title="Model" onClose={() => setPanel(null)}>
      <ErrorNotice error={error} />
      <Field accessibilityLabel="Search models" placeholder="Search models" value={search} onChangeText={setSearch} />
      <ErrorNotice error={catalogError} onRetry={() => setCatalogRevision(value => value + 1)} />
      {busy && <Label muted>Stop the current work before you change models.</Label>}
      {catalogBusy ? <Busy /> : modelMatches.map(model => <Pressable key={`${model.provider}:${model.id}`} accessibilityRole="radio" accessibilityState={{ checked: session?.model?.id === model.id && session.model.provider === model.provider, disabled: !canManage }} disabled={!canManage} onPress={() => { void run({ type: 'model', provider: model.provider, id: model.id }); }} style={styles.modelRow}><View style={styles.modelDetails}><Label>{model.name}</Label><Label muted style={styles.sheetHint}>{model.provider} · {Math.round(model.contextWindow / 1000)}k context</Label></View>{session?.model?.id === model.id && session.model.provider === model.provider && <Label muted>✓</Label>}</Pressable>)}
      {!catalogBusy && !catalogError && !modelMatches.length && <Empty title="No models found" />}
    </Sheet>
    <Sheet visible={panel === 'thinking'} title="Thinking level" onClose={() => setPanel(null)} fitContent>
      <ErrorNotice error={error} />
      <Label muted>Choose the amount of reasoning for this model.</Label>
      {session?.model?.thinkingLevels.map(level => <Button key={level} title={level} selected={session?.thinkingLevel === level} disabled={!canManage} onPress={() => { void run({ type: 'thinking', level }); }} />)}
      {busy && <Label muted>Stop the current work before you change the level.</Label>}
    </Sheet>
    <Sheet visible={panel === 'delivery'} title="Message delivery" onClose={() => setPanel(null)} fitContent>
      <Button title="Steer current work" selected={draft.delivery === 'steer'} onPress={() => { setDraft(current => ({ ...current, delivery: 'steer' })); setPanel(null); }} /><Label muted>Send the message at the next interruption point.</Label>
      <Button title="Queue after current work" selected={draft.delivery === 'followUp'} onPress={() => { setDraft(current => ({ ...current, delivery: 'followUp' })); setPanel(null); }} /><Label muted>Send the message after Pi finishes the current work.</Label>
    </Sheet>
    <Sheet visible={panel === 'more'} title="Session" onClose={() => setPanel(null)}>
      <ErrorNotice error={error} />
      <Field label="Session name" value={name} onChangeText={setName} /><Button title="Rename session" disabled={!canManage || !name.trim() || name.trim() === session?.name} busy={pending} onPress={() => { void run({ type: 'rename', name: name.trim() }); }} />
      <Button title="Compact context" disabled={!canManage} onPress={() => { void run({ type: 'compact' }); }} />
      {!!session?.context && <Label muted>{session.context.tokens === null ? 'Context usage is unavailable' : `${session.context.tokens.toLocaleString()} tokens`}{session.context.percent === null ? '' : ` · ${Math.round(session.context.percent)}% of context`}</Label>}
      {busy && <Label muted>Stop the current work before you change this session.</Label>}
      <View style={styles.divider} /><Label muted>Appearance</Label>
      {(['system', 'light', 'dark'] as const).map(value => <Button key={value} title={value.charAt(0).toUpperCase() + value.slice(1)} selected={appearance === value} onPress={() => { void setAppearance(value).catch(reason => setError(errorMessage(reason))); }} />)}
      <View style={styles.divider} /><Button title="Manage servers" variant="ghost" onPress={() => { setPanel(null); onManageServers(); }} />
    </Sheet>
  </KeyboardAvoidingView>;
}

function persistDraft(draft: Draft) {
  return saveDraft(draft.key, { text: draft.text, delivery: draft.delivery === 'followUp' ? 'queue' : 'steer', files: draft.files, skillIDs: [], agentIDs: [] });
}

function attachmentMime(file: { uri: string; name?: string }) {
  if ('mimeType' in file && typeof file.mimeType === 'string') return file.mimeType;
  const data = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(file.uri);
  if (data) return data[1];
  const extension = (file.name || file.uri).split('.').pop()?.toLowerCase();
  return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : extension === 'gif' ? 'image/gif' : '';
}
async function readImage(file: Attachment) {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mimeType)) throw new Error('Attach a PNG, JPEG, WebP, or GIF image');
  let data: string;
  if (file.uri.startsWith('data:')) data = file.uri.slice(file.uri.indexOf(',') + 1);
  else {
    const source = new File(file.uri);
    if (!source.exists) throw new Error(`${file.name || 'An attached image'} is no longer on this device. Remove it and attach it again.`);
    if (source.size > imageLimit) throw new Error(`${file.name || 'An image'} exceeds the 3 MB image limit`);
    data = await source.base64();
  }
  if (Math.ceil(data.length * 3 / 4) > imageLimit) throw new Error(`${file.name || 'An image'} exceeds the 3 MB image limit`);
  return { mimeType: file.mimeType, data };
}
async function promptCommand(draft: Draft, delivery?: 'steer' | 'followUp'): Promise<Extract<PiCommand, { type: 'prompt' }>> {
  const images = [];
  for (const file of draft.files) images.push(await readImage(file));
  const command = { type: 'prompt' as const, text: draft.text, delivery, ...(images.length ? { images } : {}) };
  if (new TextEncoder().encode(JSON.stringify(command)).byteLength > bodyLimit) throw new Error('The message exceeds the 5 MB limit. Remove an image or shorten the text.');
  return command;
}

const PiMessageRow = memo(function PiMessageRow({ message, tools, active, idle, screenReader, animate, selected, selectionActive, onSelect }: { message: PiMessage; tools: Map<string, PiToolActivity>; active: boolean; idle: boolean; screenReader: boolean; animate: boolean; selected: boolean; selectionActive: boolean; onSelect: (id: string) => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const select = useCallback(() => onSelect(message.id), [onSelect, message.id]);
  const label = textOf(message).slice(0, 240) || message.toolName || 'Pi message';
  return <Pressable accessible={!screenReader && Platform.OS !== 'web'} accessibilityRole={screenReader ? undefined : 'button'} accessibilityLabel={label} accessibilityHint="Long press to select. Copy and fork actions appear in the header." accessibilityState={{ selected }} accessibilityActions={[{ name: 'longpress', label: 'Select message' }]} onAccessibilityAction={select} onLongPress={select} onPress={selectionActive ? select : undefined} style={[styles.message, selected && { backgroundColor: colors.selected }]}>
    <MessageActionsContext.Provider value={select}>
      {message.role === 'user' && <Label muted style={styles.role}>You</Label>}
      {message.role === 'toolResult' ? <ActivityDisclosure detailsKey={message.id} title={message.toolName || 'Tool result'} failed={message.isError}><RawText text={textOf(message)} />{message.errorMessage && <ErrorNotice error={message.errorMessage} />}</ActivityDisclosure> : message.content.map((part, index) => {
        const key = `${message.id}:${index}`;
        if (part.type === 'text') return <Markdown key={key} text={part.text} selectable={Platform.OS === 'web'} />;
        if (part.type === 'image') return <Image key={key} source={{ uri: `data:${part.mimeType};base64,${part.data}` }} accessibilityLabel="Attached image" resizeMode="contain" style={styles.image} />;
        if (part.type === 'thinking') return <ActivityDisclosure key={key} detailsKey={key} title="Thinking" thought busy={active && index === message.content.length - 1} animate={animate}><Markdown text={part.thinking} muted selectable={Platform.OS === 'web'} /></ActivityDisclosure>;
        const tool = tools.get(part.id);
        const detail = typeof part.arguments.command === 'string' ? part.arguments.command : typeof part.arguments.path === 'string' ? part.arguments.path : undefined;
        return <ActivityDisclosure key={part.id} detailsKey={part.id} title={part.name} detail={detail} busy={!idle && tool?.status === 'running'} animate={animate} failed={tool?.status === 'error'} complete={tool?.status === 'completed'}><Label muted style={styles.role}>Input</Label><RawText text={formatInput(tool?.input ?? part.arguments)} />{tool?.output !== undefined && <><Label muted style={styles.role}>Output</Label><RawText text={tool.output || 'No output'} /></>}</ActivityDisclosure>;
      })}
      {message.errorMessage && message.role !== 'toolResult' && <ErrorNotice error={message.errorMessage} />}
    </MessageActionsContext.Provider>
    {screenReader && <Button title="Message actions" compact variant="ghost" onPress={select} />}
  </Pressable>;
});

function formatInput(input: Record<string, unknown>) {
  return Object.entries(input).map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`).join('\n');
}
function RawText({ text }: { text: string }) {
  const select = useContext(MessageActionsContext);
  const styles = useThemedStyles(createStyles);
  return <ScrollView horizontal><Text selectable={Platform.OS === 'web'} onLongPress={select} style={styles.raw}>{text}</Text></ScrollView>;
}
function SessionRow({ name, cwd, selected, disabled, onPress }: { name: string; cwd: string; selected?: boolean; disabled?: boolean; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: !!selected, disabled: !!disabled }} disabled={disabled} onPress={onPress} style={[styles.sessionRow, selected && styles.activeSession]}><View style={styles.modelDetails}><Label numberOfLines={1} style={styles.sessionName}>{name}</Label><Label muted numberOfLines={1} style={styles.sheetHint}>{cwd}</Label></View>{selected && <Label muted>Current</Label>}</Pressable>;
}
function IconButton({ name, label, onPress }: { name: 'close' | 'more'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed]}><ShellIcon name={name} color={colors.muted} size={20} /></Pressable>;
}
function ActionButton({ kind, label, onPress, disabled, busy }: { kind: 'up' | 'down' | 'stop'; label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.iconTarget, pressed && styles.pressed, (disabled || busy) && styles.disabled]}><View style={styles.sendFace}>{busy ? <ActivityIndicator size="small" color={colors.bg} /> : <Svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden>{kind === 'stop' ? <Rect x={4} y={4} width={8} height={8} fill={colors.bg} /> : <Path d={kind === 'up' ? 'M8 13V3M3 8l5-5 5 5' : 'M8 3v10m-5-5 5 5 5-5'} stroke={colors.bg} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}</Svg>}</View></Pressable>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  topbar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, tab: { flex: 1, minWidth: 0 },
  project: { minHeight: 36, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, projectText: { flex: 1, fontSize: 12, lineHeight: 18 }, connectionLabel: { fontSize: 11, lineHeight: 16 },
  selectionHeader: { minHeight: 49, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.panel, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, selectionCount: { flex: 1, fontSize: 13 },
  error: { paddingHorizontal: 12, paddingTop: 6 },
  transcriptFrame: { flex: 1, minHeight: 0 }, transcript: { flex: 1, minHeight: 0, width: '100%', maxWidth: 760, alignSelf: 'center' }, messages: { padding: 16, paddingBottom: 24, flexGrow: 1 }, message: { gap: 10, borderRadius: 6, minWidth: 0 }, role: { fontSize: 11, lineHeight: 16, fontFamily: mono },
  attachments: { gap: 8, paddingHorizontal: 8, paddingTop: 8 }, attachment: { maxWidth: 240, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingLeft: 6 }, attachmentImage: { width: 36, height: 36, borderRadius: 4 }, attachmentName: { flexShrink: 1, fontSize: 11, maxWidth: 120 },
  image: { width: '100%', height: 200, borderRadius: 8 }, raw: { fontFamily: mono, fontSize: 12, lineHeight: 19, color: colors.text },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, latest: { position: 'absolute', bottom: 8, right: 12, backgroundColor: colors.panel, borderRadius: 24, borderWidth: 1, borderColor: colors.border },
  waiting: { marginHorizontal: 12, marginTop: 4, padding: 12, gap: 5, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border }, waitingTitle: { fontSize: 13, fontWeight: '500' }, waitingText: { fontSize: 12, lineHeight: 18 },
  composerDock: { paddingHorizontal: 12, paddingBottom: 10, paddingTop: 4, alignItems: 'center' }, composer: { width: '100%', maxWidth: 736, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.panel, paddingHorizontal: 4, paddingVertical: 2 }, composerInput: { minHeight: 44, maxHeight: 132, borderWidth: 0, borderRadius: 0, boxShadow: [], backgroundColor: colors.panel, paddingHorizontal: 11, paddingVertical: 10, fontSize: 13, lineHeight: 22 }, composerToolbar: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  modelTrigger: { flex: 1, minWidth: 48, minHeight: 48, paddingHorizontal: 8, flexDirection: 'row', gap: 4, alignItems: 'center' }, modelText: { fontSize: 12, lineHeight: 18, flexShrink: 1 }, chevron: { fontSize: 14 }, thinkingTrigger: { maxWidth: 70, minHeight: 48, paddingHorizontal: 4, flexDirection: 'row', gap: 3, alignItems: 'center' }, deliveryTrigger: { minHeight: 48, paddingHorizontal: 6, justifyContent: 'center' },
  activity: { minHeight: 28, width: '100%', maxWidth: 736, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 8 }, activityLabel: { fontSize: 12, lineHeight: 20, flex: 1 },
  iconTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, sendFace: { width: 28, height: 28, borderRadius: 6, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.6 }, disabled: { opacity: 0.4 },
  menu: { padding: 12, paddingTop: 0, gap: 8 }, sheetTitle: { fontSize: 14, lineHeight: 20, fontWeight: '500', paddingHorizontal: 8 }, sheetHint: { fontSize: 12, lineHeight: 18 }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8 },
  sessionRow: { minHeight: 64, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 10 }, activeSession: { backgroundColor: colors.selected }, sessionName: { fontSize: 13, lineHeight: 18 }, modelRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 10 }, modelDetails: { flex: 1, minWidth: 0, gap: 4 },
});
