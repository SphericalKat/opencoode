import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { AppState, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Pty, SessionInfo } from '@opencode/client';
import { type Client, type Connection, errorMessage } from '../lib/client';
import { persistentInputFrame, persistentPtySocketUrl, ptyControlCursor, ptySocketUrl, type TerminalEvent } from '../lib/terminal';
import { TerminalRenderer } from './TerminalRenderer';
import type { TerminalRendererHandle } from './TerminalRenderer.types';
import { Busy, Button, confirmAction, Empty, ErrorNotice, Label, mono, Row, Sheet } from './ui';
import { type ThemeColors, useTheme, useThemedStyles } from '../lib/theme';
import { useMotionPreference } from './motion';
import { useUnsavedChanges, useUnsavedGuard } from '../lib/unsaved';
import { useSheetCoordinator } from '../lib/sheets';

type Props = { client: Client; connection: Connection; directory: string; sessionID?: string };
type Mode = 'desktop' | 'workspace';
const ModalSafeAreaRoot = Platform.OS === 'web' ? React.Fragment : SafeAreaProvider;

export function TerminalPanel(props: Props) {
  return <Terminals key={`${props.connection.id}:${props.directory}`} {...props} />;
}

function Terminals(props: Props) {
  const styles = useThemedStyles(createStyles);
  const confirmUnsaved = useUnsavedGuard();
  const { suspended } = useSheetCoordinator();
  const capabilityKnown = useRef(false);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>('workspace');
  const [sessionID, setSessionID] = useState(props.sessionID);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionPicker, setSessionPicker] = useState(false);
  const [sessionCursor, setSessionCursor] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkRevision, setCheckRevision] = useState(0);
  const mounted = useRef(true);

  useEffect(() => { setSessionID(props.sessionID); }, [props.sessionID]);
  useEffect(() => {
    if (suspended) return;
    mounted.current = true;
    const controller = new AbortController();
    void props.client.server.info({ signal: controller.signal }).then(info => {
      if (controller.signal.aborted) return;
      const supported = info.capabilities?.persistentPty === true;
      setPersistent(supported);
      if (!supported || !capabilityKnown.current) setMode(supported ? 'desktop' : 'workspace');
      capabilityKnown.current = true;
    }).catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => { mounted.current = false; controller.abort(); };
  }, [props.client, checkRevision, suspended]);

  async function pickSession(cursor?: string) {
    setSessionPicker(true);
    setLoading(true);
    setError(null);
    try {
      const result = await props.client.session.list({ directory: props.directory, limit: 50, cursor });
      if (!mounted.current) return;
      setSessions(current => cursor ? [...current, ...result.data] : result.data);
      setSessionCursor(result.cursor.next ?? undefined);
    } catch (failure) { if (mounted.current) setError(errorMessage(failure)); }
    finally { if (mounted.current) setLoading(false); }
  }

  async function selectMode(next: Mode) {
    if (next === mode || !await confirmUnsaved()) return;
    setMode(next);
  }

  async function selectSession(next: string) {
    if (next !== sessionID && !await confirmUnsaved()) return;
    setSessionID(next);
    setSessionPicker(false);
  }

  return <View style={styles.panel}>
    {persistent && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modes} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 6 }}>
      <Button title="Desktop terminals" compact variant={mode === 'desktop' ? 'primary' : 'ghost'} onPress={() => void selectMode('desktop')} />
      <Button title="Workspace shells" compact variant={mode === 'workspace' ? 'primary' : 'ghost'} onPress={() => void selectMode('workspace')} />
      {mode === 'desktop' && <Button title="Choose session" compact onPress={() => void pickSession()} />}
    </ScrollView>}
    {persistent === null && !error && <Busy />}
    {error && <View style={styles.notice}><ErrorNotice error={error} onRetry={() => { setError(null); setCheckRevision(value => value + 1); }} /></View>}
    {persistent !== null && (mode === 'workspace' || sessionID)
      ? <TerminalList key={`${mode}:${sessionID ?? ''}`} {...props} sessionID={sessionID} mode={mode} />
      : persistent !== null && <Empty title="Choose a desktop session" detail="Desktop terminals belong to a session. Choose its session to see the same terminals on your phone." />}
    {persistent !== null && mode === 'desktop' && !sessionID && <View style={styles.notice}><Button title="Choose session" variant="primary" onPress={() => void pickSession()} /></View>}
    <Sheet visible={sessionPicker} title="Terminal session" onClose={() => setSessionPicker(false)}>
      <ErrorNotice error={error} />
      {loading && sessions.length === 0 && <Busy />}
      {sessions.map(session => <Button key={session.id} title={session.title || session.id} variant={sessionID === session.id ? 'primary' : 'secondary'} onPress={() => void selectSession(session.id)} />)}
      {!loading && sessions.length === 0 && <Label muted>Create a session from the Sessions tab first.</Label>}
      {sessionCursor && <Button title="More sessions" busy={loading} onPress={() => void pickSession(sessionCursor)} />}
    </Sheet>
  </View>;
}

function TerminalList({ client, connection, directory, sessionID, mode }: Props & { mode: Mode }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const confirmUnsaved = useUnsavedGuard();
  const { suspended } = useSheetCoordinator();
  const [terminals, setTerminals] = useState<Pty[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const data = mode === 'desktop' && sessionID
        ? await client.experimental.persistentPty.list({ sessionID }, { signal: controller.signal })
        : (await client.pty.list({ location: { directory } }, { signal: controller.signal })).data;
      if (controller.signal.aborted) return;
      setTerminals(data);
      setSelectedID(current => data.some(item => item.id === current) ? current : data.find(item => item.status === 'running')?.id ?? data[0]?.id ?? null);
    } catch (failure) {
      if (!controller.signal.aborted) setError(errorMessage(failure));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [client, directory, sessionID, mode]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; request.current?.abort(); };
  }, [refresh]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!foreground || suspended) return;
    const controller = new AbortController();
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let retryResolve: (() => void) | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => { refreshTimer = undefined; void refresh(); }, 250);
    };
    void (async () => {
      await refresh();
      let attempts = 0;
      while (!controller.signal.aborted) {
        try {
          for await (const event of client.event.subscribe({ signal: controller.signal })) {
            if (controller.signal.aborted) break;
            attempts = 0;
            if (event.type === 'server.connected') { scheduleRefresh(); continue; }
            if (mode === 'desktop' && (event.type === 'persistent-pty.added' || event.type === 'persistent-pty.removed')) {
              if (event.data.sessionID === sessionID) scheduleRefresh();
            }
            if (mode === 'workspace' && (event.type === 'pty.created' || event.type === 'pty.updated' || event.type === 'pty.deleted' || event.type === 'pty.exited')) {
              if (!event.location || event.location.directory === directory) scheduleRefresh();
            }
          }
          if (!controller.signal.aborted) throw new Error('The terminal inventory connection closed');
        } catch {
          if (controller.signal.aborted) break;
          await new Promise<void>(resolve => {
            retryResolve = resolve;
            retryTimer = setTimeout(resolve, Math.min(1000 * 2 ** Math.min(attempts++, 4), 15000));
          });
          if (!controller.signal.aborted) await refresh();
        }
      }
    })().catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); });
    return () => { controller.abort(); request.current?.abort(); clearTimeout(refreshTimer); clearTimeout(retryTimer); retryResolve?.(); };
  }, [client, directory, mode, sessionID, foreground, refresh, suspended]);

  async function create() {
    if (!await confirmUnsaved()) return;
    setBusy(true);
    setError(null);
    try {
      const terminal = mode === 'desktop' && sessionID
        ? await client.experimental.persistentPty.create({ sessionID, cwd: directory, title: 'Terminal', args: [], env: {} })
        : (await client.pty.create({ location: { directory }, cwd: directory })).data;
      if (!mounted.current) return;
      request.current?.abort();
      setLoading(false);
      setTerminals(current => current.some(item => item.id === terminal.id) ? current.map(item => item.id === terminal.id ? terminal : item) : [...current, terminal]);
      setSelectedID(terminal.id);
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  async function selectTerminal(next: string) {
    if (next === selectedID || !await confirmUnsaved()) return;
    setSelectedID(next);
  }

  async function terminate() {
    if (!selectedID || !await confirmAction('Terminate this shell?', 'The server will stop this shell and its child processes.')) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'desktop') await client.experimental.persistentPty.remove({ ptyID: selectedID });
      else await client.pty.remove({ ptyID: selectedID, location: { directory } });
      if (mounted.current) await refresh();
    } catch (failure) {
      if (mounted.current) setError(errorMessage(failure));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  const selected = terminals.find(item => item.id === selectedID);
  return <View style={styles.panel}>
    <Row style={styles.toolbar}>
      <Button title="New shell" compact variant="primary" onPress={() => void create()} busy={busy} />
      <Button title="Refresh" compact onPress={() => void refresh()} disabled={busy || loading} />
      {selected && <Button title="Terminate" compact variant="danger" onPress={() => void terminate()} disabled={busy} />}
    </Row>
    <View style={styles.notice}><ErrorNotice error={error} onRetry={() => void refresh()} /></View>
    {loading && terminals.length === 0 ? <Busy /> : null}
    {terminals.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
      {terminals.map(terminal => <Pressable accessibilityRole="tab" accessibilityState={{ selected: selectedID === terminal.id }} key={terminal.id} onPress={() => void selectTerminal(terminal.id)} style={[styles.tab, selectedID === terminal.id && styles.selectedTab]}>
        <Label style={{ color: terminal.status === 'running' ? colors.success : colors.muted }}>{terminal.status === 'running' ? '●' : '○'}  {terminal.title || terminal.command}</Label>
      </Pressable>)}
    </ScrollView>}
    {selected ? selected.status === 'running' || mode === 'desktop'
      ? <TerminalSession key={selected.id} client={client} connection={connection} directory={directory} terminal={selected} mode={mode} onExit={() => void refresh()} />
      : <Empty title="Shell exited" detail={`Exit code: ${selected.exitCode ?? 'unknown'}. Create a new shell to continue.`} />
      : !loading && <Empty title="A shell on your server" detail="Create a terminal to run commands in this workspace. Shells continue after you leave this screen." />}
  </View>;
}

function TerminalSession({ client, connection, directory, terminal, mode, onExit }: Props & { terminal: Pty; mode: Mode; onExit: () => void }) {
  const reducedMotion = useMotionPreference();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { suspended, recoveryPending, presentSheet, dismissSheet } = useSheetCoordinator();
  const modalID = useId();
  const suspendedRef = useRef(suspended);
  suspendedRef.current = suspended;
  const renderer = useRef<TerminalRendererHandle>(null);
  const socket = useRef<WebSocket | null>(null);
  const cursor = useRef<number | undefined>(undefined);
  const attachmentID = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`).current;
  const restored = useRef(false);
  const controllerRef = useRef(false);
  const sizeRef = useRef({ cols: 80, rows: 24 });
  const pending = useRef<string[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const [ready, setReady] = useState(false);
  const [rendererEpoch, setRendererEpoch] = useState(0);
  const [rendererBroken, setRendererBroken] = useState(false);
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [size, setSize] = useState({ cols: 80, rows: 24 });
  const [controller, setController] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [nativeText, setNativeText] = useState('');
  useUnsavedChanges(`terminal-input:${connection.id}:${terminal.id}`, 'Terminal input', nativeText.length > 0);
  const [privateInput, setPrivateInput] = useState(false);
  const nativeInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const rendererGeneration = useRef(0);
  sizeRef.current = size;
  const effectiveFullscreen = fullscreen && !suspended;
  const requestedModal = useRef(effectiveFullscreen);
  requestedModal.current = effectiveFullscreen;
  const previousModalVisible = useRef(effectiveFullscreen);
  const pendingModalDismiss = useRef(false);
  const previousSuspended = useRef(suspended);

  const notifyModalDismissed = useCallback(() => {
    if (requestedModal.current || !pendingModalDismiss.current) return;
    pendingModalDismiss.current = false;
    dismissSheet(modalID);
  }, [dismissSheet, modalID]);

  useLayoutEffect(() => {
    if (effectiveFullscreen) {
      pendingModalDismiss.current = false;
      presentSheet(modalID);
    } else if (previousModalVisible.current) pendingModalDismiss.current = true;
    previousModalVisible.current = effectiveFullscreen;
  }, [effectiveFullscreen, presentSheet, modalID]);

  useEffect(() => () => { dismissSheet(modalID); }, [dismissSheet, modalID]);

  useEffect(() => {
    if (effectiveFullscreen || !pendingModalDismiss.current || Platform.OS !== 'android') return;
    const frame = requestAnimationFrame(notifyModalDismissed);
    return () => cancelAnimationFrame(frame);
  }, [effectiveFullscreen, notifyModalDismissed]);

  const resetTerminalView = useCallback(() => {
    const ws = socket.current;
    socket.current = null;
    if (ws) { ws.onclose = null; ws.onerror = null; ws.onmessage = null; ws.close(); }
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    pending.current = [];
    cursor.current = undefined;
    restored.current = false;
    controllerRef.current = false;
    rendererGeneration.current++;
    setReady(false);
    setRendererBroken(false);
    setController(false);
    setStatus('connecting');
    setRendererEpoch(value => value + 1);
  }, []);

  useLayoutEffect(() => {
    if (previousSuspended.current === suspended) return;
    previousSuspended.current = suspended;
    resetTerminalView();
    if (suspended) {
      nativeInput.current?.blur();
      setStatus('disconnected');
    }
  }, [suspended, resetTerminalView]);

  useEffect(() => {
    if (!ready) return;
    renderer.current?.send({ type: 'inputEnabled', enabled: Platform.OS !== 'android' });
    renderer.current?.send({ type: 'theme', colors: {
      background: colors.bg, foreground: colors.text, cursor: colors.focus, cursorAccent: colors.bg,
      selectionBackground: colors.selected, black: colors.bg, brightBlack: colors.faint,
      red: colors.danger, brightRed: colors.danger, green: colors.success, brightGreen: colors.success,
      blue: colors.blue, brightBlue: colors.blue, white: colors.muted, brightWhite: colors.text,
    } });
  }, [colors, ready, rendererEpoch]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (ready || rendererBroken || suspended) return;
    const timer = setTimeout(() => {
      setRendererBroken(true);
      setError('The terminal view did not start. Tap Reconnect to reload it.');
    }, 10000);
    return () => clearTimeout(timer);
  }, [ready, rendererEpoch, rendererBroken, suspended]);

  useEffect(() => {
    if (!ready || !active || suspended) {
      setStatus('disconnected');
      return;
    }
    let disposed = false;
    let retries = 0;
    let exited = false;
    let decoder = new TextDecoder();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    function flush() {
      flushTimer.current = null;
      if (!pending.current.length) return;
      renderer.current?.send({ type: 'output', data: pending.current.join('') });
      pending.current = [];
    }
    function retry() {
      if (disposed || suspendedRef.current || retryTimer) return;
      setStatus('disconnected');
      retryTimer = setTimeout(() => { retryTimer = undefined; void open(); }, Math.min(30000, 1000 * 2 ** Math.min(retries++, 5)));
    }
    async function open() {
      if (disposed || suspendedRef.current) return;
      setStatus('connecting');
      restored.current = false;
      controllerRef.current = false;
      setController(false);
      try {
        let url: string;
        if (mode === 'desktop') {
          const snapshot = await client.experimental.persistentPty.snapshot({ ptyID: terminal.id }, { signal: controller.signal });
          if (disposed || suspendedRef.current) return;
          flush();
          decoder = new TextDecoder();
          renderer.current?.send({ type: 'restore', checkpoint: snapshot.checkpoint, ...snapshot.info.size });
          cursor.current = snapshot.info.output.tail;
          if (snapshot.info.status === 'exited') {
            exited = true;
            setStatus('disconnected');
            setError(`Shell exited with code ${snapshot.info.exitCode ?? 'unknown'}`);
            return;
          }
          const token = await client.experimental.persistentPty.connectToken({ ptyID: terminal.id, 'x-opencode-ticket': '1' }, { signal: controller.signal });
          if (disposed || suspendedRef.current) return;
          url = persistentPtySocketUrl(connection.url, terminal.id, token.ticket, { cursor: snapshot.info.output.tail, attachmentID, role: 'observer' });
        } else {
          const current = await client.pty.get({ ptyID: terminal.id, location: { directory } }, { signal: controller.signal });
          if (disposed || suspendedRef.current) return;
          if (current.data.status === 'exited') { onExitRef.current(); return; }
          const token = await client.pty.connect.token({ ptyID: terminal.id, location: { directory }, 'x-opencode-ticket': '1' }, { signal: controller.signal });
          if (disposed || suspendedRef.current) return;
          url = ptySocketUrl(connection.url, directory, terminal.id, token.data.ticket, cursor.current);
        }
        const ws = new WebSocket(url);
        socket.current = ws;
        ws.binaryType = 'arraybuffer';
        connectTimer = setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING || (mode === 'desktop' && !restored.current)) {
            setError('The terminal connection timed out');
            ws.close();
          }
        }, 15000);
        ws.onopen = () => {
          if (disposed || suspendedRef.current) { ws.close(); return; }
          retries = 0;
          setError(null);
          if (mode === 'workspace') {
            clearTimeout(connectTimer);
            setStatus('connected');
          }
        };
        ws.onmessage = event => {
          if (disposed || suspendedRef.current) return;
          if (mode === 'desktop') {
            if (event.data instanceof ArrayBuffer) {
              cursor.current = (cursor.current ?? 0) + event.data.byteLength;
              pending.current.push(decoder.decode(new Uint8Array(event.data), { stream: true }));
              if (!flushTimer.current) flushTimer.current = setTimeout(flush, 16);
              return;
            }
            if (typeof event.data !== 'string') return;
            let message: unknown;
            try { message = JSON.parse(event.data); } catch { return; }
            if (!message || typeof message !== 'object' || !('type' in message)) return;
            if (message.type === 'attached') {
              if (!('inputProtocol' in message) || message.inputProtocol !== 1) {
                setError('Restart the OpenCode server to update its terminal protocol');
                exited = true;
                ws.close();
                return;
              }
              if ('replay' in message && message.replay && typeof message.replay === 'object' && 'truncated' in message.replay && message.replay.truncated === true) {
                setError('The terminal changed during recovery. Reconnect to restore its current screen.');
                ws.close();
                return;
              }
              controllerRef.current = 'role' in message && message.role === 'controller';
              setController(controllerRef.current);
            }
            if (message.type === 'replay_complete') {
              restored.current = true;
              clearTimeout(connectTimer);
              setStatus('connected');
              if ('endOffset' in message && typeof message.endOffset === 'number') cursor.current = message.endOffset;
            }
            if (message.type === 'controller_changed') {
              controllerRef.current = 'attachmentID' in message && message.attachmentID === attachmentID;
              setController(controllerRef.current);
            }
            if (message.type === 'resized' && 'cols' in message && 'rows' in message && 'checkpoint' in message
              && typeof message.cols === 'number' && typeof message.rows === 'number' && typeof message.checkpoint === 'string') {
              flush();
              decoder = new TextDecoder();
              renderer.current?.send({ type: 'restore', checkpoint: message.checkpoint, cols: message.cols, rows: message.rows });
            }
            if (message.type === 'exited') {
              exited = true;
              setStatus('disconnected');
              setError(`Shell exited with code ${'exitCode' in message ? message.exitCode : 'unknown'}`);
              onExitRef.current();
            }
            return;
          }
          if (event.data instanceof ArrayBuffer) {
            const position = ptyControlCursor(event.data);
            if (position !== undefined) cursor.current = position;
            return;
          }
          if (typeof event.data !== 'string') return;
          cursor.current = (cursor.current ?? 0) + event.data.length;
          pending.current.push(event.data);
          if (!flushTimer.current) flushTimer.current = setTimeout(flush, 16);
        };
        ws.onerror = () => {
          if (!disposed) setError('The terminal connection failed. Check server access and allowed web origins.');
        };
        ws.onclose = () => {
          clearTimeout(connectTimer);
          if (socket.current === ws) socket.current = null;
          if (!disposed && !exited) retry();
        };
      } catch (failure) {
        if (!disposed) {
          setError(errorMessage(failure));
          retry();
        }
      }
    }
    void open();
    return () => {
      disposed = true;
      controllerRef.current = false;
      controller.abort();
      clearTimeout(retryTimer);
      clearTimeout(connectTimer);
      if (flushTimer.current) { clearTimeout(flushTimer.current); flush(); }
      const ws = socket.current;
      socket.current = null;
      if (ws) { ws.onclose = null; ws.onerror = null; ws.onmessage = null; ws.close(); }
    };
  }, [client, connection.url, directory, terminal.id, mode, attachmentID, ready, active, revision, suspended]);

  useEffect(() => {
    if (status !== 'connected' || suspended) return;
    if (mode === 'desktop') {
      if (!suspendedRef.current && controllerRef.current && restored.current && socket.current?.readyState === WebSocket.OPEN) socket.current.send(persistentInputFrame(size));
      return;
    }
    const requestController = new AbortController();
    const timer = setTimeout(() => {
      if (suspendedRef.current) return;
      void client.pty.update({ ptyID: terminal.id, location: { directory }, size }, { signal: requestController.signal }).catch(failure => {
        if (!requestController.signal.aborted) setError(errorMessage(failure));
      });
    }, 120);
    return () => { clearTimeout(timer); requestController.abort(); };
  }, [client, directory, terminal.id, size, status, controller, mode, suspended]);

  function send(data: string, binary = false, reportError = false): boolean {
    const ws = socket.current;
    if (suspendedRef.current || !ready || !ws || ws.readyState !== WebSocket.OPEN) {
      if (reportError) setError('Reconnect to the shell before you send text');
      return false;
    }
    if (mode === 'desktop' && (!restored.current || !controllerRef.current)) {
      if (reportError) setError('Take control of the terminal before you send text');
      return false;
    }
    try {
      if (mode === 'desktop') {
        const bytes = binary ? Uint8Array.from(data, char => char.charCodeAt(0)) : new TextEncoder().encode(data);
        ws.send(persistentInputFrame(sizeRef.current, bytes));
      } else ws.send(binary ? Uint8Array.from(data, char => char.charCodeAt(0)).buffer : data);
      return true;
    } catch (failure) {
      if (reportError) setError(errorMessage(failure));
      return false;
    }
  }
  function takeControl() {
    if (!suspendedRef.current && restored.current && socket.current?.readyState === WebSocket.OPEN) socket.current.send(persistentInputFrame(size));
  }
  function event(message: TerminalEvent) {
    if (suspendedRef.current) return;
    if (message.type === 'ready') setReady(true);
    if (message.type === 'input') send(message.data, message.binary);
    if (message.type === 'resize') setSize(current => current.cols === message.cols && current.rows === message.rows ? current : { cols: message.cols, rows: message.rows });
  }
  function reconnect() {
    if (suspendedRef.current) return;
    if (rendererBroken) {
      setReady(false);
      cursor.current = undefined;
      pending.current = [];
      rendererGeneration.current++;
      setRendererEpoch(value => value + 1);
      setRendererBroken(false);
    } else setRevision(value => value + 1);
    setError(null);
  }
  function changeFullscreen(next: boolean) {
    if (suspendedRef.current) return;
    resetTerminalView();
    setFullscreen(next);
  }
  function submitNative(appendReturn: boolean, text = nativeText) {
    if (!text && !appendReturn) return;
    if (send(`${text}${appendReturn ? '\r' : ''}`, false, true)) setNativeText('');
  }
  function focusInput() {
    if (suspendedRef.current) return;
    if (Platform.OS === 'android') nativeInput.current?.focus();
    else renderer.current?.send({ type: 'focus' });
  }
  const canSend = !suspended && ready && status === 'connected' && (mode !== 'desktop' || controller);
  const generation = rendererEpoch;
  const content = <View style={styles.session}>
    <Row style={styles.connectionBar}><Label muted style={{ flex: 1, fontSize: 11 }}>{status === 'connected' ? `${mode === 'desktop' ? controller ? 'In control' : 'View only' : 'Connected'} · ${size.cols} × ${size.rows}` : active ? status === 'connecting' ? 'Connect to shell…' : 'Disconnected' : 'Paused in background'}</Label>{mode === 'desktop' && status === 'connected' && !controller && <Button title="Take control" compact onPress={takeControl} />}<Button title={fullscreen ? 'Close' : 'Full screen'} compact onPress={() => changeFullscreen(!fullscreen)} /></Row>
    {fullscreen && <Row style={styles.connectionBar}><Label muted style={{ flex: 1 }} numberOfLines={1}>{terminal.title || terminal.command}</Label><Button title="Reconnect" compact onPress={reconnect} /></Row>}
    {recoveryPending
      ? <View style={styles.notice}><Label accessibilityRole="alert">Close this panel to open the connection wizard.</Label></View>
      : error && <View style={styles.notice}><ErrorNotice error={error} /></View>}
    <View style={styles.terminal}><TerminalRenderer key={rendererEpoch} ref={renderer} onEvent={message => { if (generation === rendererGeneration.current) event(message); }} onError={message => { if (generation !== rendererGeneration.current) return; setReady(false); setRendererBroken(true); setError(message); }} /></View>
    {Platform.OS === 'android' && (fullscreen
      ? <Row style={styles.nativeComposer}><TextInput ref={nativeInput} accessibilityLabel="Terminal text" placeholder={canSend ? 'Text for the terminal' : mode === 'desktop' && !controller ? 'Take control to send text' : 'Connect to send text'} placeholderTextColor={colors.faint} style={styles.nativeInput} value={nativeText} onChangeText={setNativeText} editable={canSend} autoCorrect={false} autoCapitalize="none" spellCheck={false} secureTextEntry={privateInput} textContentType="none" autoComplete="off" importantForAutofill="no" submitBehavior="submit" returnKeyType="send" onSubmitEditing={event => submitNative(true, event.nativeEvent.text)} /><Button title="Send line" compact variant="primary" disabled={!canSend} onPress={() => submitNative(true)} /></Row>
      : <View style={styles.notice}><Button title="Open full screen to type" compact onPress={() => changeFullscreen(true)} /></View>)}
    <ScrollView horizontal keyboardShouldPersistTaps="always" style={styles.keys} contentContainerStyle={{ gap: 6, padding: 8 }}>
      {Platform.OS === 'android' && fullscreen && <><Button title="Send text" compact disabled={!canSend || !nativeText} onPress={() => submitNative(false)} /><Button title={privateInput ? 'Show text' : 'Hide text'} compact onPress={() => setPrivateInput(value => !value)} /></>}
      {([['Enter', '\r'], ['Esc', '\u001b'], ['Tab', '\t'], ['Ctrl C', '\u0003'], ['Ctrl D', '\u0004'], ['↑', '\u001b[A'], ['↓', '\u001b[B'], ['←', '\u001b[D'], ['→', '\u001b[C'], ['Ctrl L', '\u000c'], ['Ctrl Z', '\u001a'], ['Ctrl R', '\u0012'], ['Home', '\u001b[H'], ['End', '\u001b[F'], ['Delete', '\u001b[3~']] as const).map(([title, data]) => <Button key={title} title={title} accessibilityLabel={`Send ${title} to terminal`} compact disabled={!canSend} onPress={() => { send(data, false, true); focusInput(); }} />)}
    </ScrollView>
  </View>;
  return <View style={styles.session}>{!fullscreen && content}<Modal visible={effectiveFullscreen} animationType={reducedMotion ? 'fade' : 'slide'} presentationStyle="fullScreen" supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} onRequestClose={() => changeFullscreen(false)} onDismiss={notifyModalDismissed}><ModalSafeAreaRoot><SafeAreaView style={styles.fullscreen} edges={['top', 'bottom', 'left', 'right']}><KeyboardAvoidingView style={styles.session} behavior="padding" automaticOffset>{fullscreen && content}</KeyboardAvoidingView></SafeAreaView></ModalSafeAreaRoot></Modal></View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  panel: { flex: 1, minHeight: 0 }, toolbar: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 6, flexShrink: 0 }, notice: { paddingHorizontal: 16, paddingBottom: 8, flexShrink: 0 },
  modes: { height: 50, flexGrow: 0, flexShrink: 0 }, tabs: { flexGrow: 0, flexShrink: 0, height: 48 }, tab: { borderWidth: 1, borderColor: colors.border, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }, selectedTab: { backgroundColor: colors.selected, borderColor: colors.focus },
  session: { flex: 1, minHeight: 0 }, connectionBar: { paddingHorizontal: 16, paddingBottom: 8, flexShrink: 0, flexWrap: 'nowrap' }, terminal: { flex: 1, minHeight: 0, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }, keys: { flexGrow: 0, flexShrink: 0, height: 54 },
  fullscreen: { flex: 1, backgroundColor: colors.bg, paddingTop: 8 }, nativeComposer: { flexShrink: 0, flexWrap: 'nowrap', paddingHorizontal: 8, paddingTop: 8 }, nativeInput: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, color: colors.text, fontFamily: mono, fontSize: 14, padding: 10, borderRadius: 6 },
});
