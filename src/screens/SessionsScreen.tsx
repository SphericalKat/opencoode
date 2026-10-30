import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, AppState, FlatList, Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { SessionInfo } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { useNativePresentation } from '../lib/sheets';
import { useTheme, useThemedStyles, type ThemeColors } from '../lib/theme';
import { Button, Busy, Card, Empty, ErrorNotice, Field, Label, Row, Sheet, confirmAction } from '../components/ui';
import { ShellIcon } from '../components/ShellIcon';

type Props = {
  client: Client;
  directory: string;
  onOpenSession: (id: string) => void;
  revision?: number;
  selectedSessionID?: string;
  compact?: boolean;
  onOpenNavigation?: () => void;
};

export function SessionsScreen({ client, directory, onOpenSession, revision, selectedSessionID, compact = false, onOpenNavigation }: Props) {
  const withNativePresentation = useNativePresentation();
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [width, setWidth] = useState(360);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [listUnavailable, setListUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [listError, setListError] = useState<string>();
  const [statusError, setStatusError] = useState<string>();
  const [streamError, setStreamError] = useState<string>();
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [actions, setActions] = useState<'menu' | 'filter' | 'create' | null>(null);
  const lastActions = useRef<'menu' | 'filter' | 'create'>('menu');
  if (actions) lastActions.current = actions;
  const displayedActions = actions ?? lastActions.current;
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<SessionInfo>();
  const [editTitle, setEditTitle] = useState('');
  const [moveDirectory, setMoveDirectory] = useState('');
  const [sheetError, setSheetError] = useState<string>();
  const generation = useRef(0);
  const refreshRequest = useRef<AbortController | null>(null);
  const quietRefreshPending = useRef(false);
  const mounted = useRef(true);
  const scope = useRef({ client, directory });
  if (scope.current.client !== client || scope.current.directory !== directory) scope.current = { client, directory };
  const paging = useRef(false);
  const operationPending = useRef(false);
  const pendingImport = useRef<(() => void) | null>(null);
  const loadedCount = useRef(40);
  const refreshRef = useRef<(quiet?: boolean, signal?: AbortSignal) => Promise<void>>(async () => {});
  const compactHeader = compact || width < 340;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; generation.current += 1; refreshRequest.current?.abort(); pendingImport.current = null; };
  }, []);

  const refresh = useCallback(async (cursor?: string, quiet = false, signal?: AbortSignal) => {
    if (quiet && refreshRequest.current) { quietRefreshPending.current = true; return; }
    quietRefreshPending.current = false;
    const request = ++generation.current;
    refreshRequest.current?.abort();
    const controller = new AbortController();
    refreshRequest.current = controller;
    let timedOut = false;
    const cancel = () => controller.abort();
    let rejectCancelled: (() => void) | undefined;
    const cancelled = new Promise<never>((_, reject) => {
      rejectCancelled = () => reject(new Error(timedOut
        ? 'The server did not respond within 15 seconds. Check your connection, then retry.'
        : 'Session refresh cancelled'));
      controller.signal.addEventListener('abort', rejectCancelled, { once: true });
    });
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
    if (!quiet) { setLoading(true); setListError(undefined); }
    try {
      const [page, running] = await Promise.race([
        Promise.allSettled([
          client.session.list({ directory, search: search.trim() || undefined, archived, limit: cursor ? 40 : loadedCount.current, cursor, order: 'desc' }, { signal: controller.signal }),
          client.session.active({ signal: controller.signal }),
        ]),
        cancelled,
      ]);
      if (!mounted.current || request !== generation.current || controller.signal.aborted) return;
      if (page.status === 'rejected') throw page.reason;
      setListUnavailable(false);
      setListError(undefined);
      setSessions(previous => {
        const next = cursor ? Array.from(new Map([...previous, ...page.value.data].map(item => [item.id, item])).values()) : page.value.data;
        loadedCount.current = Math.max(40, next.length);
        return next;
      });
      setNextCursor(page.value.cursor.next ?? undefined);
      if (running.status === 'fulfilled') {
        setActive(new Set(Object.keys(running.value)));
        setStatusError(undefined);
      } else {
        setActive(new Set());
        setStatusError(`Active status unavailable: ${errorMessage(running.reason)}`);
      }
    } catch (cause) {
      if (mounted.current && request === generation.current && (timedOut || !controller.signal.aborted)) {
        setListUnavailable(true);
        setListError(errorMessage(cause));
      }
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', cancel);
      if (rejectCancelled) controller.signal.removeEventListener('abort', rejectCancelled);
      if (refreshRequest.current === controller) refreshRequest.current = null;
      if (request === generation.current) {
        if (mounted.current) setLoading(false);
        paging.current = false;
        if (mounted.current && quietRefreshPending.current && !controller.signal.aborted) {
          quietRefreshPending.current = false;
          void refreshRef.current(true, signal);
        }
      }
    }
  }, [client, directory, search, archived]);
  refreshRef.current = (quiet, signal) => refresh(undefined, quiet, signal);

  useEffect(() => {
    generation.current += 1;
    loadedCount.current = 40;
    setSessions([]);
    setNextCursor(undefined);
    setLoading(true);
    const timer = setTimeout(() => { if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') void refresh(); }, 250);
    return () => { clearTimeout(timer); generation.current += 1; refreshRequest.current?.abort(); };
  }, [refresh, revision]);

  useEffect(() => {
    setSelected(undefined);
    setActions(null);
    setSheetError(undefined);
    pendingImport.current = null;
  }, [client, directory]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!foreground) { refreshRequest.current?.abort(); quietRefreshPending.current = false; return; }
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let releaseRetry: (() => void) | undefined;
    let attempts = 0;
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => { refreshTimer = undefined; if (!controller.signal.aborted) void refreshRef.current(true, controller.signal); }, 300);
    };
    void (async () => {
      void refreshRef.current(true, controller.signal);
      while (!controller.signal.aborted) {
        try {
          const attempt = new AbortController();
          const cancelAttempt = () => attempt.abort();
          controller.signal.addEventListener('abort', cancelAttempt, { once: true });
          let timedOut = false;
          let rejectCancelled: (() => void) | undefined;
          const cancelled = new Promise<never>((_, reject) => {
            rejectCancelled = () => reject(new Error(timedOut
              ? 'The live connection did not respond within 15 seconds. Check your server connection.'
              : 'Live connection cancelled'));
            attempt.signal.addEventListener('abort', rejectCancelled, { once: true });
          });
          if (controller.signal.aborted) cancelAttempt();
          const initialTimeout = setTimeout(() => { timedOut = true; attempt.abort(); }, 15_000);
          const iterator = client.event.subscribe({ signal: attempt.signal })[Symbol.asyncIterator]();
          try {
            while (!controller.signal.aborted) {
              const result = await Promise.race([iterator.next(), cancelled]);
              if (result.done || controller.signal.aborted) break;
              clearTimeout(initialTimeout);
              const event = result.value;
              setStreamError(undefined); attempts = 0;
              if (event.type === 'server.connected' || event.type === 'location.shutdown' || sessionListEvents.has(event.type)) scheduleRefresh();
            }
          } finally {
            clearTimeout(initialTimeout);
            controller.signal.removeEventListener('abort', cancelAttempt);
            attempt.abort();
            if (rejectCancelled) attempt.signal.removeEventListener('abort', rejectCancelled);
            void iterator.return?.().catch(() => {});
          }
          if (!controller.signal.aborted) throw new Error('The live connection closed');
        } catch (cause) {
          if (controller.signal.aborted) break;
          setStreamError(`Live updates unavailable: ${errorMessage(cause)}`);
          await new Promise<void>(resolve => { releaseRetry = resolve; retryTimer = setTimeout(resolve, Math.min(1000 * 2 ** Math.min(attempts++, 4), 15000)); });
          if (!controller.signal.aborted) await refreshRef.current(true, controller.signal);
        }
      }
    })().catch(cause => { if (!controller.signal.aborted) setStreamError(errorMessage(cause)); });
    return () => { controller.abort(); clearTimeout(refreshTimer); clearTimeout(retryTimer); releaseRetry?.(); };
  }, [client, foreground]);

  const openConversation = (id: string) => {
    Keyboard.dismiss();
    onOpenSession(id);
  };

  const run = async (operation: () => Promise<void>, inSheet = false) => {
    if (operationPending.current) return;
    operationPending.current = true;
    const owner = scope.current;
    setBusy(true);
    setError(undefined);
    setSheetError(undefined);
    try {
      await operation();
    } catch (cause) {
      if (mounted.current && owner === scope.current) {
        if (inSheet) setSheetError(errorMessage(cause));
        else setError(errorMessage(cause));
      }
    } finally {
      operationPending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const createSession = (named = false) => run(async () => {
    const owner = scope.current;
    setCreating(true);
    try {
      const created = await client.session.create({ location: { directory }, title: named ? title.trim() || undefined : undefined });
      if (scope.current.client !== owner.client || scope.current.directory !== owner.directory || !mounted.current) return;
      setActions(null);
      setTitle('');
      if (archived) setArchived(false);
      openConversation(created.id);
      if (!archived) await refresh();
    } finally { if (mounted.current) setCreating(false); }
  }, named);

  const changeSession = (operation: (item: SessionInfo) => Promise<void>) => run(async () => {
    if (!selected) return;
    const owner = scope.current;
    await operation(selected);
    if (scope.current.client !== owner.client || scope.current.directory !== owner.directory || !mounted.current) return;
    setSelected(undefined);
    await refresh();
  }, true);

  const exportSession = () => run(async () => {
    if (!selected) return;
    const owner = scope.current;
    const transcript = await client.experimental.session.export({ sessionID: selected.id, sanitize: true });
    if (scope.current !== owner || !mounted.current) return;
    const text = JSON.stringify(transcript, null, 2);
    const filename = `opencode-${selected.id.replace(/[^a-zA-Z0-9_-]/g, '')}.json`;
    if (Platform.OS === 'web') {
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device');
      const file = new File(Paths.cache, filename);
      await file.write(text);
      await withNativePresentation(() => Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' }));
    }
  }, true);

  const importSession = () => run(async () => {
    const owner = scope.current;
    const picked = await withNativePresentation(() => DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true }));
    if (picked.canceled || !mounted.current || scope.current !== owner) return;
    const asset = picked.assets[0];
    if (asset.size && asset.size > 20 * 1024 * 1024) throw new Error('Choose a transcript smaller than 20 MB');
    const text = Platform.OS === 'web' ? await (asset.file ? asset.file.text() : fetch(asset.uri).then(response => response.text())) : await new File(asset.uri).text();
    if (!mounted.current || scope.current !== owner) return;
    const transcript = JSON.parse(text);
    if (!transcript || typeof transcript !== 'object' || !transcript.info || typeof transcript.info !== 'object' || !Array.isArray(transcript.messages)) {
      throw new Error('Choose a JSON transcript exported by OpenCode');
    }
    if (!await confirmAction('Import session?', `Import this transcript into ${directory}? The server validates its contents.`)) return;
    if (scope.current.client !== owner.client || scope.current.directory !== owner.directory || !mounted.current) return;
    const imported = await client.experimental.session.import({ info: transcript.info, messages: transcript.messages, location: { directory } });
    if (scope.current.client !== owner.client || scope.current.directory !== owner.directory || !mounted.current) return;
    await refresh();
    openConversation(imported.id);
  });

  const queueImport = () => {
    if (operationPending.current || pendingImport.current) return;
    const owner = scope.current;
    pendingImport.current = () => {
      if (mounted.current && scope.current === owner) void importSession();
    };
    Keyboard.dismiss();
    setActions(null);
  };

  const finishActionsDismissal = () => {
    const action = pendingImport.current;
    pendingImport.current = null;
    action?.();
  };

  const loadMore = () => {
    if (loading || paging.current || !nextCursor) return;
    paging.current = true;
    void refresh(nextCursor);
  };

  const chooseHistory = () => {
    if (Platform.OS === 'web') { setActions('filter'); return; }
    const owner = scope.current;
    void withNativePresentation(() => new Promise<void>(resolve => {
      const choose = (value: boolean) => {
        if (mounted.current && scope.current === owner) setArchived(value);
        resolve();
      };
      if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({
        title: 'Session history',
        options: ['Recent sessions', 'Archived sessions', 'Cancel'],
        cancelButtonIndex: 2,
        userInterfaceStyle: scheme,
      }, index => { if (index < 2) choose(index === 1); else resolve(); });
      else Alert.alert('Session history', undefined, [
        { text: 'Recent sessions', onPress: () => choose(false) },
        { text: 'Archived sessions', onPress: () => choose(true) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve() },
      ], { cancelable: true, onDismiss: () => resolve() });
    })).catch(cause => { if (mounted.current && scope.current === owner) setError(errorMessage(cause)); });
  };

  return <View style={styles.screen} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={[styles.header, compactHeader && styles.compactHeader]}>
      <Row style={styles.headingRow}>
        {!compact && onOpenNavigation && <Pressable accessibilityRole="button" accessibilityLabel="Open navigation" onPress={onOpenNavigation} style={({ pressed }) => [styles.navigationButton, pressed && styles.pressed]}><ShellIcon name="menu" color={colors.text} /></Pressable>}
        <View style={styles.headingText}><Label accessibilityRole="header" numberOfLines={1} style={[styles.title, compactHeader && styles.compactTitle]}>{compact ? 'Your sessions' : 'Sessions'}</Label></View>
        <Pressable accessibilityRole="button" accessibilityLabel="New session" accessibilityState={{ disabled: busy, busy: creating }} disabled={busy} onPress={() => { void createSession(); }} style={({ pressed }) => [styles.newButton, (pressed || busy) && styles.pressed]}>
          {creating ? <ActivityIndicator size="small" color={colors.text} /> : <ShellIcon name="compose" color={colors.text} size={20} />}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Session list actions" onPress={() => { setSheetError(undefined); setActions('menu'); }} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}><ShellIcon name="more" color={colors.muted} size={18} /></Pressable>
      </Row>
      <Row style={styles.searchRow}>
        <View style={{ flex: 1, minWidth: 0 }}><Field accessibilityLabel="Search sessions" placeholder={archived ? 'Search archived sessions' : 'Search sessions'} value={search} onChangeText={setSearch} clearButtonMode="while-editing" style={styles.search} /></View>
        {search ? <Button title="Clear" accessibilityLabel="Clear session search" compact variant="ghost" onPress={() => setSearch('')} /> : <Pressable accessibilityRole="button" accessibilityLabel={`Session history: ${archived ? 'Archived' : 'Recent'}`} onPress={chooseHistory} style={styles.filter}><Label muted style={styles.filterText}>{archived ? 'Archived' : 'Recent'} ⌄</Label></Pressable>}
      </Row>
      <ErrorNotice error={listError} onRetry={() => { void refresh(); }} />
      <ErrorNotice error={error} />
      {statusError && <Label muted>{statusError}</Label>}
      {streamError && <Label muted>{streamError}</Label>}
    </View>
    <FlatList
      data={sessions}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshing={loading && sessions.length > 0}
      onRefresh={() => { void refresh(); }}
      onEndReached={loadMore}
      onEndReachedThreshold={0.4}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      ListEmptyComponent={loading ? <Busy /> : <Empty title={listUnavailable ? 'Could not load sessions' : search.trim() ? 'No matching sessions' : archived ? 'No archived sessions' : 'Start your first session'} detail={listUnavailable ? 'Use Retry to load your history.' : search.trim() ? 'Try another title or clear the search.' : archived ? 'Sessions appear here after you archive them.' : 'Create a session to work with OpenCode in this directory.'} />}
      ListFooterComponent={sessions.length ? loading ? <Busy /> : nextCursor ? <Button title="Load more" variant="ghost" onPress={loadMore} /> : undefined : undefined}
      renderItem={({ item }) => {
        const status = sessionStatus(item, active.has(item.id));
        const unread = item.time.idle && (!item.time.viewed || item.time.viewed < item.time.idle);
        const visibleStatus = status === 'Working' || status === 'Needs attention' || status === 'Stopped' ? status : undefined;
        return <View style={[styles.session, selectedSessionID === item.id && styles.selected]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title || 'Untitled session'}`} accessibilityHint={`${status}. Updated ${new Date(item.time.updated).toLocaleString()}`} onPress={() => openConversation(item.id)} style={({ pressed }) => [styles.sessionMain, pressed && styles.sessionPressed]}>
            <Label numberOfLines={1} style={styles.sessionTitle}>{item.title || 'Untitled session'}</Label>
            <Label muted numberOfLines={1} style={styles.metadata}>{[visibleStatus, unread ? 'Unread' : undefined, updatedLabel(item.time.updated), item.parentID ? 'Child session' : undefined].filter(Boolean).join(' · ')}</Label>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Manage ${item.title || 'session'}`} onPress={() => { setSelected(item); setEditTitle(item.title || ''); setMoveDirectory(item.location.directory); setSheetError(undefined); }} style={({ pressed }) => [styles.rowAction, pressed && styles.pressed]}><ShellIcon name="more" color={colors.faint} size={18} /></Pressable>
        </View>;
      }}
    />
    <Sheet visible={actions !== null} title={displayedActions === 'create' ? 'Name a new session' : displayedActions === 'filter' ? 'Session history' : 'Session list actions'} onClose={() => { if (!creating) setActions(null); }} onDismiss={finishActionsDismissal}>
      {displayedActions === 'create' ? <>
        <Field label="Session title" placeholder="What do you want to work on?" value={title} onChangeText={setTitle} editable={!creating} />
        <Label muted>You can choose a model and agent in the conversation.</Label>
        <Card><Label muted>Remote directory</Label><Label selectable>{directory}</Label></Card>
        <ErrorNotice error={sheetError} />
        <Button title="Create session" variant="primary" busy={creating} onPress={() => { void createSession(true); }} />
      </> : <>
        <View accessibilityRole="radiogroup">
          {[{ title: 'Recent sessions', value: false }, { title: 'Archived sessions', value: true }].map(item => <Pressable key={item.title} accessibilityRole="radio" accessibilityState={{ checked: archived === item.value }} aria-checked={archived === item.value} onPress={() => { setArchived(item.value); setActions(null); }} style={styles.menuRow}><Label>{item.title}</Label><Label muted>{archived === item.value ? '✓' : ''}</Label></Pressable>)}
        </View>
        {displayedActions === 'menu' && <>
          <Button title="Refresh sessions" variant="ghost" disabled={loading} onPress={() => { setActions(null); void refresh(); }} />
          <Button title="Create a named session" variant="ghost" disabled={busy} onPress={() => { setTitle(''); setSheetError(undefined); setActions('create'); }} />
          <Button title="Import session JSON" variant="ghost" disabled={busy} onPress={queueImport} />
        </>}
      </>}
    </Sheet>
    <Sheet visible={!!selected} title="Manage session" onClose={() => setSelected(undefined)}>
      <Label selectable style={{ fontWeight: '500', fontSize: 16 }}>{selected?.title || 'Untitled session'}</Label>
      {selected && <Label muted>Updated {new Date(selected.time.updated).toLocaleString()}</Label>}
      <Field label="Session title" value={editTitle} onChangeText={setEditTitle} />
      <Button title="Save title" busy={busy} disabled={!editTitle.trim()} onPress={() => changeSession(item => client.session.update({ sessionID: item.id, title: editTitle.trim() }))} />
      <Row><Button title={selected?.time.archived ? 'Restore session' : 'Archive session'} disabled={busy} onPress={() => changeSession(item => client.session.update({ sessionID: item.id, archived: !item.time.archived }))} /><Button title="Fork session" disabled={busy} onPress={() => changeSession(async item => { const fork = await client.session.fork({ sessionID: item.id }); if (scope.current.client === client && mounted.current) openConversation(fork.id); })} /></Row>
      <Field label="Move to remote directory" value={moveDirectory} onChangeText={setMoveDirectory} />
      <Button title="Move session" disabled={busy || !moveDirectory.trim() || moveDirectory.trim() === selected?.location.directory} onPress={() => changeSession(item => client.session.move({ sessionID: item.id, directory: moveDirectory.trim(), delivery: 'queue' }))} />
      <Label muted>A move during active work takes effect at a safe server boundary.</Label>
      <Button title="Export JSON" disabled={busy} onPress={exportSession} />
      <Label muted>Export and import require a server with the experimental transcript API.</Label>
      <Button title="Delete session" variant="danger" disabled={busy} onPress={() => changeSession(async item => { if (await confirmAction('Delete session?', `Delete ${item.title || item.id} and all child sessions from the server?`)) await client.session.remove({ sessionID: item.id }); })} />
      <ErrorNotice error={sheetError} />
    </Sheet>
  </View>;
}

const sessionListEvents = new Set([
  'session.created', 'session.renamed', 'session.archived', 'session.unarchived', 'session.deleted',
  'session.forked', 'session.moved', 'session.viewed', 'session.agent.selected', 'session.model.selected',
  'session.execution.started', 'session.execution.succeeded', 'session.execution.failed', 'session.execution.interrupted',
  'session.inbox.enqueued', 'session.inbox.delivered', 'session.shell.started', 'session.shell.ended',
]);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10, gap: 8 },
  compactHeader: { paddingTop: 8 },
  headingRow: { flexWrap: 'nowrap', gap: 8 },
  navigationButton: { minHeight: Platform.OS === 'android' ? 48 : 44, minWidth: Platform.OS === 'android' ? 48 : 44, marginStart: -16, marginEnd: 16, alignItems: 'center', justifyContent: 'center' },
  headingText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  compactTitle: { fontSize: 18, lineHeight: 23, letterSpacing: -0.2 },
  newButton: { minHeight: Platform.OS === 'android' ? 48 : 44, minWidth: Platform.OS === 'android' ? 48 : 44, alignItems: 'center', justifyContent: 'center' },
  actionButton: { minHeight: Platform.OS === 'android' ? 48 : 44, minWidth: Platform.OS === 'android' ? 48 : 44, marginStart: 16, marginEnd: -16, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.55 },
  searchRow: { flexWrap: 'nowrap', gap: 8 },
  search: { borderRadius: 8, backgroundColor: colors.panel, minHeight: 40, height: 40, paddingHorizontal: 15, paddingVertical: 9, fontSize: 14, lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center' },
  filter: { minHeight: Platform.OS === 'android' ? 48 : 44, minWidth: Platform.OS === 'android' ? 48 : 44, alignItems: 'center', justifyContent: 'center' },
  filterText: { fontSize: 13, lineHeight: 20 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 2, flexGrow: 1 },
  session: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderRadius: 10 },
  sessionMain: { flex: 1, minWidth: 0, gap: 3, paddingVertical: 10, paddingLeft: 16 },
  sessionPressed: { opacity: 0.65 },
  sessionTitle: { minWidth: 0, fontWeight: '500', fontSize: 15, lineHeight: 20 },
  metadata: { fontSize: 11, lineHeight: 16 },
  rowAction: { minHeight: Platform.OS === 'android' ? 48 : 44, minWidth: Platform.OS === 'android' ? 48 : 44, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  menuRow: { minHeight: Platform.OS === 'android' ? 48 : 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  selected: { backgroundColor: colors.selected },
});

function updatedLabel(time: number): string {
  const date = new Date(time);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function sessionStatus(session: SessionInfo, working: boolean): string {
  if (working) return 'Working';
  if (session.outcome === 'succeeded') return 'Completed';
  if (session.outcome === 'failed') return 'Needs attention';
  if (session.outcome === 'interrupted') return 'Stopped';
  return 'Ready';
}
