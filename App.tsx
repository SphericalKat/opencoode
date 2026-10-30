import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { KeyboardAvoidingView, KeyboardProvider } from 'react-native-keyboard-controller';
import { useFonts } from 'expo-font';
import { ClientError, isLocationNotFoundError, isUnauthorizedError, type Project, type ServerInfo } from '@opencode/client';
import { Button, Busy, confirmAction, ErrorNotice, Heading, Label, sans, Sheet } from './src/components/ui';
import { clearPairingRetry, connect, connectionErrorMessage, createClient, errorMessage, normalizeConnection, withServerDeadline, type Connection } from './src/lib/client';
import { loadActiveConnectionId, loadConnections, loadWorkspace, saveActiveConnectionId, saveConnections, saveWorkspace } from './src/lib/storage';
import { ChatScreen } from './src/screens/ChatScreen';
import { SessionsScreen } from './src/screens/SessionsScreen';
import { WorkspaceScreen } from './src/screens/WorkspaceScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { UnsavedProvider, useUnsavedGuard } from './src/lib/unsaved';
import { ThemeProvider, useTheme, useThemedStyles, type ThemeColors } from './src/lib/theme';
import { OpenCodeLogo } from './src/components/OpenCodeLogo';
import { NavIcon } from './src/components/Icons';
import { ProjectDirectoryBrowser } from './src/components/ProjectDirectoryBrowser';
import { ShellIcon } from './src/components/ShellIcon';
import { MotionDrawer, MotionScreen } from './src/components/motion';
import { ConnectionFlow, type ConnectionForm } from './src/components/ConnectionFlow';
import { SheetCoordinatorProvider, useSheetCoordinator } from './src/lib/sheets';
import { pageInset } from './src/lib/layout';

type Tab = 'sessions' | 'workspace' | 'settings';
const destinations: { id: Tab; label: string }[] = [
  { id: 'workspace', label: 'Workspace' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [fontsReady, fontError] = useFonts({ Inter: require('./assets/fonts/Inter.ttf'), IBMPlexMono: require('./assets/fonts/IBMPlexMono-Text.ttf') });
  if (!fontsReady && !fontError) return <View style={{ flex: 1, backgroundColor: '#080808' }} />;
  return <SafeAreaProvider><KeyboardProvider statusBarTranslucent navigationBarTranslucent preserveEdgeToEdge><ThemeProvider><SheetCoordinatorProvider><UnsavedProvider><ThemedStatusBar /><MobileApp /></UnsavedProvider></SheetCoordinatorProvider></ThemeProvider></KeyboardProvider></SafeAreaProvider>;
}

function ThemedStatusBar() {
  const { scheme, colors } = useTheme();
  useEffect(() => { if (Platform.OS !== 'web') void SystemUI.setBackgroundColorAsync(colors.bg); }, [colors.bg]);
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function MobileApp() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const wide = width >= 920;
  const confirmNavigation = useUnsavedGuard();
  const { suspendSheets, resumeSheets } = useSheetCoordinator();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [active, setActive] = useState<Connection | null>(null);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [booting, setBooting] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [unavailableID, setUnavailableID] = useState<string | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [error, setError] = useState<string | null>(null);
  const [directory, setDirectory] = useState('');
  const [sessionID, setSessionID] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('sessions');
  const [visited, setVisited] = useState<Partial<Record<Tab, boolean>>>({ sessions: true });
  const [serversOpen, setServersOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [newDirectory, setNewDirectory] = useState('');
  const [revision, setRevision] = useState(0);
  const [attachmentPath, setAttachmentPath] = useState<string>();
  const [attachmentContext, setAttachmentContext] = useState<string>();
  const [pendingLocation, setPendingLocation] = useState<{ sessionID: string; directory: string } | null>(null);
  const [form, setForm] = useState<ConnectionForm>({ id: '', name: '', url: '', token: '' });
  const [pairingLink, setPairingLink] = useState<string | null>(null);
  const [flowRevision, setFlowRevision] = useState(0);
  const epoch = useRef(0);
  const pendingNavigationSheet = useRef<{ kind: 'servers' | 'projects'; epoch: number; serverRequest?: number } | null>(null);
  const navigationPresented = useRef(false);
  const serverSheetRequest = useRef(0);
  const automaticServerRequest = useRef<number | null>(null);
  const showServerSheet = useRef<() => void>(() => {});
  const recoveringConnection = useRef<{ connection: Connection; message: string } | null>(null);
  const recoverConnection = useRef<(connection: Connection, cause: unknown) => void>(() => {});
  const connectingRef = useRef(false);
  const selection = useRef(0);
  const selectedSessionRef = useRef(sessionID);
  const settingsCanGoBack = useRef(false);
  const setSettingsBackState = useCallback((canGoBack: boolean) => { settingsCanGoBack.current = canGoBack; }, []);
  const directoryRef = useRef(directory);
  selectedSessionRef.current = sessionID;
  directoryRef.current = directory;
  const locationSync = useRef<{ key: string; promise: Promise<string | null> } | null>(null);
  const activeRef = useRef<Connection | null>(null);
  activeRef.current = active;
  const client = useMemo(() => active ? createClient(active) : null, [active]);

  const selectServer = useCallback(async (connection: Connection, existing?: Connection[], alternatives?: Connection[], explicitName = false) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    const request = ++epoch.current;
    setConnecting(true);
    setConnectionError(null);
    try {
      const result = await connect(connection, undefined, alternatives);
      const current = existing ?? connections;
      const matching = !explicitName && !current.some(item => item.id === connection.id)
        ? current.find(item => item.url === result.connection.url && (item.username || 'opencode') === (result.connection.username || 'opencode'))
        : undefined;
      const connected = matching ? { ...result.connection, id: matching.id, name: matching.name } : result.connection;
      const nextClient = createClient(connected);
      const owner = activeRef.current;
      const sameServer = owner?.id === connected.id && owner.url === connected.url && (owner.username || 'opencode') === (connected.username || 'opencode');
      const workspace = sameServer ? { directory: directoryRef.current, sessionID: selectedSessionRef.current ?? undefined } : await loadWorkspace(connected.id);
      let restoredSessionID = workspace?.sessionID;
      const location = await withServerDeadline(signal => nextClient.location.get(
        workspace?.directory ? { location: { directory: workspace.directory } } : undefined,
        { signal },
      ).catch(cause => {
        if (signal.aborted || !workspace?.directory || !isLocationNotFoundError(cause)) throw cause;
        restoredSessionID = undefined;
        return nextClient.location.get(undefined, { signal });
      }));
      if (request !== epoch.current) return;
      const preserveWorkspace = sameServer && location.directory === directoryRef.current;
      if (preserveWorkspace) restoredSessionID = selectedSessionRef.current ?? undefined;
      if (!preserveWorkspace && !(await confirmNavigation())) return;
      if (request !== epoch.current) return;
      const next = [...current.filter(item => item.id !== connected.id), connected];
      await saveConnections(next);
      await saveWorkspace(connected.id, { directory: location.directory, sessionID: restoredSessionID });
      await saveActiveConnectionId(connected.id);
      if (request !== epoch.current) return;
      clearPairingRetry();
      setConnections(next);
      setActive(connected);
      setUnavailableID(null);
      recoveringConnection.current = null;
      if (!preserveWorkspace) setConnectionRevision(value => value + 1);
      setInfo(result.info);
      if (!preserveWorkspace) {
        setDirectory(location.directory);
        directoryRef.current = location.directory;
        setNewDirectory(location.directory);
        setSessionID(restoredSessionID ?? null);
        selectedSessionRef.current = restoredSessionID ?? null;
        setPendingLocation(null);
        setAttachmentPath(undefined); setAttachmentContext(undefined);
        setTab('sessions');
      }
      setError(null);
      setServersOpen(false);
      setForm({ id: '', name: '', url: '', token: '' });
    } catch (cause) {
      if (request === epoch.current) {
        setConnectionError(connectionErrorMessage(cause, connection));
        if (!activeRef.current || activeRef.current.id === connection.id) setUnavailableID(connection.id);
      }
    } finally {
      connectingRef.current = false;
      if (request === epoch.current) setConnecting(false);
    }
  }, [connections, confirmNavigation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!active || !directory) return;
    const timer = setTimeout(() => {
      saveWorkspace(active.id, { directory, sessionID: sessionID ?? undefined }).catch(cause => setError(errorMessage(cause)));
    }, 300);
    return () => clearTimeout(timer);
  }, [active, directory, sessionID]);

  useEffect(() => {
    let live = true;
    Promise.all([loadConnections(), loadActiveConnectionId()]).then(async ([saved, id]) => {
      if (!live) return;
      setConnections(saved);
      const last = saved.find(item => item.id === id);
      if (last) await selectServer(last, saved);
    }).catch(cause => { if (live) setError(errorMessage(cause)); }).finally(() => { if (live) setBooting(false); });
    return () => { live = false; epoch.current++; };
  }, []);

  useEffect(() => {
    const acceptLink = (url: string | null | undefined) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'opencoode:' && !/\/auth\/connect\/[^/]+\/?$/.test(parsed.pathname)) return;
        const server = parsed.protocol === 'opencoode:' ? parsed.searchParams.get('url') : url;
        if (!server) return;
        normalizeConnection({ name: '', url: server });
        setConnectionError(null);
        setForm({ id: '', name: '', url: server, token: '' });
        setPairingLink(server);
        setFlowRevision(value => value + 1);
        showServerSheet.current();
      } catch { setError('The connection link is invalid'); }
    };
    Linking.getInitialURL().then(acceptLink).catch(() => {});
    const subscription = Linking.addEventListener('url', event => acceptLink(event.url));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab === 'settings' && settingsCanGoBack.current) return false;
      if (sessionID && tab === 'sessions') {
        const request = epoch.current;
        const navigation = ++selection.current;
        void confirmNavigation().then(leave => {
          if (leave && activeRef.current === active && request === epoch.current && navigation === selection.current) {
            selectedSessionRef.current = null; setSessionID(null); setPendingLocation(null);
          }
        });
        return true;
      }
      if (tab !== 'sessions') { setTab('sessions'); return true; }
      return false;
    });
    return () => back.remove();
  }, [active, sessionID, tab, confirmNavigation]);

  const changeDirectory = useCallback((next: string) => {
    if (activeRef.current !== active) return;
    const request = epoch.current;
    const navigation = ++selection.current;
    void confirmNavigation().then(leave => {
      if (!leave || activeRef.current !== active || request !== epoch.current || navigation !== selection.current) return;
      directoryRef.current = next; selectedSessionRef.current = null;
      setDirectory(next); setNewDirectory(next); setSessionID(null); setAttachmentPath(undefined); setAttachmentContext(undefined); setProjectsOpen(false);
      setPendingLocation(null);
    });
  }, [active, confirmNavigation]);

  const syncSelectedLocation = useCallback((): Promise<string | null> => {
    if (!client || activeRef.current !== active) return Promise.resolve(null);
    const id = selectedSessionRef.current;
    if (!id) return Promise.resolve(directoryRef.current);
    const request = epoch.current;
    const navigation = selection.current;
    const key = `${request}:${navigation}:${id}`;
    if (locationSync.current?.key === key) return locationSync.current.promise;
    const current = () => activeRef.current === active && request === epoch.current && navigation === selection.current && selectedSessionRef.current === id;
    const promise = (async () => {
      try {
        const selected = await client.session.get({ sessionID: id }, { signal: AbortSignal.timeout(15_000) });
        if (!current()) return null;
        const next = selected.location.directory;
        if (next === directoryRef.current) { setPendingLocation(null); return next; }
        const leave = await confirmNavigation();
        if (!current()) return null;
        if (!leave) { setPendingLocation({ sessionID: id, directory: next }); return null; }
        directoryRef.current = next;
        setDirectory(next); setNewDirectory(next); setAttachmentPath(undefined); setAttachmentContext(undefined); setPendingLocation(null);
        return next;
      } catch (cause) {
        if (current()) setError(errorMessage(cause));
        return null;
      }
    })();
    locationSync.current = { key, promise };
    void promise.finally(() => { if (locationSync.current?.promise === promise) locationSync.current = null; });
    return promise;
  }, [active, client, confirmNavigation]);

  const openSession = useCallback((id: string) => {
    if (!client || activeRef.current !== active) return;
    if (id === selectedSessionRef.current) {
      void syncSelectedLocation().then(next => {
        if (next && activeRef.current === active && selectedSessionRef.current === id) { setTab('sessions'); setNavigationOpen(false); }
      });
      return;
    }
    const request = epoch.current;
    const navigation = ++selection.current;
    const current = () => activeRef.current === active && request === epoch.current && navigation === selection.current;
    void (async () => {
      try {
        const selected = id ? await client.session.get({ sessionID: id }, { signal: AbortSignal.timeout(15_000) }) : null;
        if (!current() || !(await confirmNavigation()) || !current()) return;
        if (selected) {
          directoryRef.current = selected.location.directory;
          setDirectory(selected.location.directory); setNewDirectory(selected.location.directory);
        }
        selectedSessionRef.current = id || null;
        setSessionID(id || null); setTab('sessions'); setAttachmentPath(undefined); setAttachmentContext(undefined); setPendingLocation(null); setNavigationOpen(false);
      } catch (cause) { if (current()) setError(errorMessage(cause)); }
    })();
  }, [active, client, confirmNavigation, syncSelectedLocation]);

  async function changeTab(next: Tab) {
    if (next === 'sessions' || next === tab) {
      setTab(next);
      setNavigationOpen(false);
      if (next === 'sessions' && selectedSessionRef.current) void syncSelectedLocation();
      return;
    }
    const owner = active;
    const request = epoch.current;
    const navigation = selection.current;
    if (selectedSessionRef.current && !(await syncSelectedLocation())) return;
    if (activeRef.current !== owner || request !== epoch.current || navigation !== selection.current) return;
    setVisited(current => ({ ...current, [next]: true }));
    setTab(next);
    setNavigationOpen(false);
  }

  async function openProjects() {
    if (!client) return;
    showNavigationSheet('projects');
    setProjectBusy(true); setProjectError(null);
    const owner = activeRef.current;
    try {
      const result = await client.project.list();
      if (activeRef.current === owner) setProjects(result);
    } catch (cause) { if (activeRef.current === owner) setProjectError(errorMessage(cause)); }
    finally { if (activeRef.current === owner) setProjectBusy(false); }
  }

  function openNavigation() {
    if (pendingNavigationSheet.current?.kind === 'servers') { serverSheetRequest.current += 1; automaticServerRequest.current = null; resumeSheets(); }
    pendingNavigationSheet.current = null;
    navigationPresented.current = !wide;
    setNavigationOpen(true);
  }

  async function showNavigationSheet(kind: 'servers' | 'projects', automatic = false) {
    let serverRequest: number | undefined;
    if (kind === 'servers') {
      if (!automatic) automaticServerRequest.current = null;
      if (!activeRef.current) { serverSheetRequest.current += 1; resumeSheets(); return; }
      const request = ++serverSheetRequest.current;
      serverRequest = request;
      if (automatic) automaticServerRequest.current = request;
      const owner = activeRef.current;
      const connectionEpoch = epoch.current;
      await suspendSheets();
      if (request !== serverSheetRequest.current) return;
      if (owner !== activeRef.current || connectionEpoch !== epoch.current) { automaticServerRequest.current = null; resumeSheets(); return; }
    }
    if ((navigationOpen || navigationPresented.current) && !wide) {
      pendingNavigationSheet.current = { kind, epoch: epoch.current, serverRequest };
      setNavigationOpen(false);
      return;
    }
    pendingNavigationSheet.current = null;
    if (kind === 'servers') { automaticServerRequest.current = null; setServersOpen(true); }
    else setProjectsOpen(true);
  }
  showServerSheet.current = () => { void showNavigationSheet('servers'); };

  function onNavigationDismissed() {
    navigationPresented.current = false;
    const pending = pendingNavigationSheet.current;
    pendingNavigationSheet.current = null;
    if (!pending || pending.epoch !== epoch.current || !activeRef.current || pending.kind === 'servers' && pending.serverRequest !== serverSheetRequest.current) {
      if (pending?.kind === 'servers') resumeSheets();
      return;
    }
    if (pending.kind === 'servers') { automaticServerRequest.current = null; setServersOpen(true); }
    else setProjectsOpen(true);
  }

  recoverConnection.current = (connection, cause) => {
    if (activeRef.current !== connection || connectingRef.current || recoveringConnection.current?.connection === connection) return;
    const message = isUnauthorizedError(cause)
      ? `${connection.name} rejected the saved password. Pair again or update its saved connection.`
      : `${connection.name} is not responding. Retry it or connect to another server.`;
    recoveringConnection.current = { connection, message };
    setUnavailableID(connection.id);
    setConnectionError(message);
    if (!serversOpen) {
      setForm({ id: '', name: '', url: '', token: '' });
      setPairingLink(null);
      setFlowRevision(value => value + 1);
      void showNavigationSheet('servers', true);
    }
  };

  useEffect(() => {
    if (!active || !client || !foreground || connecting) return;
    const owner = active;
    const request = epoch.current;
    let stopped = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelProbe: (() => void) | undefined;
    const current = () => !stopped && activeRef.current === owner && epoch.current === request;
    const probe = async () => {
      if (!current()) return;
      const controller = new AbortController();
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          client.server.info({ signal: controller.signal }),
          new Promise<never>((_, reject) => {
            cancelProbe = () => { controller.abort(); reject(new Error('The connection check was canceled')); };
            deadline = setTimeout(() => {
              reject(new Error('OpenCode did not respond within five seconds. Check the server address and your network.'));
              controller.abort();
            }, 5_000);
          }),
        ]);
        if (!current()) return;
        if (!result || typeof result.version !== 'string' || !/^2\./.test(result.version)) throw new Error('This address no longer returns an OpenCode 2 server.');
        failures = 0;
        const recovery = recoveringConnection.current;
        if (recovery?.connection === owner) {
          recoveringConnection.current = null;
          const automaticRequest = automaticServerRequest.current;
          if (automaticRequest !== null && automaticRequest === serverSheetRequest.current) {
            automaticServerRequest.current = null;
            serverSheetRequest.current += 1;
            if (pendingNavigationSheet.current?.kind === 'servers' && pendingNavigationSheet.current.serverRequest === automaticRequest) pendingNavigationSheet.current = null;
            resumeSheets();
          }
          setUnavailableID(value => value === owner.id ? null : value);
          setConnectionError(value => value === recovery.message ? null : value);
        }
        timer = setTimeout(() => { void probe(); }, 5_000);
      } catch (cause) {
        if (!current()) return;
        failures += 1;
        const unauthorized = isUnauthorizedError(cause) || cause instanceof ClientError && cause.reason === 'UnexpectedStatus' && cause.cause && typeof cause.cause === 'object' && 'status' in cause.cause && cause.cause.status === 401;
        if (unauthorized || failures >= 2) recoverConnection.current(owner, cause);
        timer = setTimeout(() => { void probe(); }, failures === 1 && !unauthorized ? 1_000 : 5_000);
      } finally {
        clearTimeout(deadline);
        cancelProbe = undefined;
      }
    };
    void probe();
    return () => { stopped = true; clearTimeout(timer); cancelProbe?.(); };
  }, [active, client, foreground, connecting, connectionRevision, resumeSheets]);

  async function openDirectory(nextDirectory = newDirectory) {
    if (!client) return;
    const target = nextDirectory.trim();
    if (!target.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(target) && !target.startsWith('\\\\')) { setProjectError('Enter an absolute directory on the server'); return; }
    const owner = active;
    const request = epoch.current;
    setProjectBusy(true); setProjectError(null);
    try {
      const location = await client.location.get({ location: { directory: target } }, { signal: AbortSignal.timeout(15_000) });
      if (activeRef.current !== owner || request !== epoch.current) return;
      changeDirectory(location.directory);
    } catch (cause) { if (activeRef.current === owner && request === epoch.current) setProjectError(errorMessage(cause)); }
    finally { if (activeRef.current === owner && request === epoch.current) setProjectBusy(false); }
  }

  async function removeConnection(connection: Connection) {
    if (activeRef.current?.id === connection.id && !(await confirmNavigation())) return;
    if (!(await confirmAction('Remove server?', `Remove the saved connection to ${connection.name}?`))) return;
    try {
      const next = connections.filter(item => item.id !== connection.id);
      await saveConnections(next);
      if (activeRef.current?.id === connection.id) {
        ++epoch.current;
        await saveActiveConnectionId(null);
        selectedSessionRef.current = null; directoryRef.current = '';
        setActive(null); setInfo(null); setSessionID(null); setDirectory('');
        setAttachmentPath(undefined); setAttachmentContext(undefined);
        setPendingLocation(null);
      }
      setConnections(next);
    } catch (cause) { setConnectionError(errorMessage(cause)); }
  }

  async function attachFile(path: string, contextText?: string): Promise<boolean> {
    if (!client) return false;
    const owner = activeRef.current;
    const request = epoch.current;
    const navigation = selection.current;
    try {
      if (selectedSessionRef.current) {
        const nextDirectory = await syncSelectedLocation();
        if (!nextDirectory) return false;
        if (nextDirectory !== directory) throw new Error('The session moved to another directory. Choose the file again in its current workspace.');
      }
      const selected = sessionID || (await client.session.create({ location: { directory } })).id;
      if (activeRef.current !== owner || epoch.current !== request || selection.current !== navigation) return false;
      selectedSessionRef.current = selected;
      setSessionID(selected);
      setAttachmentContext(contextText);
      setAttachmentPath(path);
      setRevision(value => value + 1);
      setTab('sessions');
      return true;
    } catch (cause) {
      if (activeRef.current === owner && epoch.current === request && selection.current === navigation) setError(errorMessage(cause));
      return false;
    }
  }

  const serverForm = <ConnectionFlow key={flowRevision} form={form} connections={connections} activeID={active?.id} unavailableID={unavailableID ?? undefined} connecting={connecting} error={connectionError ?? (!active ? error : null)} pairingLink={pairingLink} onPairingLinkConsumed={() => setPairingLink(null)} onChangeForm={setForm} onClearError={() => setConnectionError(null)} onConnect={(connection, alternatives) => selectServer(connection, undefined, alternatives, !!form.name.trim())} onRemove={removeConnection} />;

  const projectLabel = directory.split('/').filter(Boolean).pop() || 'Project';
  const returnLabel = sessionID ? 'Chat' : 'Sessions';
  const returnToSessions = () => { void changeTab('sessions'); };
  const openServers = () => { setConnectionError(null); showNavigationSheet('servers'); };
  const navigation = client && active ? <>
    <View style={styles.navigationBrand}><OpenCodeLogo width={Platform.OS === 'android' ? 112 : 136} />{!wide && <Pressable accessibilityRole="button" accessibilityLabel="Close navigation" onPress={() => setNavigationOpen(false)} style={styles.iconButton}><ShellIcon name="close" color={colors.muted} /></Pressable>}</View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Switch project directory. Current project: ${projectLabel}`} accessibilityHint={directory} onPress={() => void openProjects()} style={({ pressed }) => [styles.projectChoice, pressed && styles.pressed]}>
      <NavIcon name="workspace" color={colors.muted} size={18} /><View style={styles.contextText}><Label numberOfLines={1} style={styles.projectName}>{projectLabel}</Label>{Platform.OS !== 'android' && <Label muted numberOfLines={1} ellipsizeMode="middle" style={styles.contextDetail}>{directory}</Label>}</View><ShellIcon name="chevron" size={14} color={colors.faint} />
    </Pressable>
    <View style={styles.navigationSessions}><SessionsScreen compact key={`${active.id}:${connectionRevision}:navigation`} client={client} directory={directory} selectedSessionID={sessionID ?? undefined} revision={revision} onOpenSession={openSession} /></View>
    <View style={styles.navigationFooter}>
      <Pressable accessibilityRole="button" accessibilityLabel="Switch server" onPress={openServers} style={({ pressed }) => [styles.serverChoice, pressed && styles.pressed]}><ShellIcon name="server" color={colors.muted} size={18} /><View style={styles.contextText}><Label numberOfLines={1} style={styles.serverName}>{active.name}</Label><Label muted style={styles.contextDetail}>OpenCode {info?.version ? `· v${info.version}` : ''}</Label></View><ShellIcon name="chevron" size={14} color={colors.faint} /></Pressable>
      <View style={styles.navigationLinks}>{destinations.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.label}`} aria-current={tab === item.id ? 'page' : undefined} onPress={() => { void changeTab(item.id); }} style={({ pressed }) => [styles.navigationLink, tab === item.id && styles.selectedDestination, pressed && styles.pressed]}><NavIcon name={item.id} color={colors.muted} size={16} /><Label style={styles.navigationLinkText}>{item.label}</Label></Pressable>)}</View>
    </View>
  </> : null;

  if (booting) return <SafeAreaView style={styles.safe}><View style={styles.boot}><OpenCodeLogo width={160} /><Busy /><Label muted>Restoring your workspace</Label></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    {!client || !active ? <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" automaticOffset><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.onboarding}>
      <View style={{ gap: 16, marginBottom: 20 }}><OpenCodeLogo width={180} /><Label muted>Mobile client</Label></View>
      {serverForm}
    </ScrollView></KeyboardAvoidingView> : <View style={styles.shell}>
      {wide && <View style={styles.sidebar}>{navigation}</View>}
      <View style={styles.main}>
      {error && <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}><ErrorNotice error={error} /></View>}
      {pendingLocation?.sessionID === sessionID && <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}><ErrorNotice error={`This session uses ${pendingLocation.directory}. Update the workspace before you attach files or open its terminal.`} onRetry={() => { void syncSelectedLocation(); }} /></View>}
      <View style={styles.body}>
        <MotionScreen visible={tab === 'sessions'} style={[styles.full, { flexDirection: 'row' }, tab !== 'sessions' && { display: 'none' }]}>
          {!wide && !sessionID && <View style={styles.full}><SessionsScreen key={`${active.id}:${connectionRevision}`} client={client} directory={directory} selectedSessionID={sessionID ?? undefined} revision={revision} onOpenSession={openSession} onOpenNavigation={openNavigation} /></View>}
          {(wide || sessionID) && <View style={styles.full}>{sessionID ? <ChatScreen key={`${active.id}:${connectionRevision}:${sessionID}`} client={client} sessionID={sessionID} serverID={active.id} draftKey={`${active.id}:${sessionID}`} visible={tab === 'sessions'} projectLabel={projectLabel} onOpenNavigation={wide ? undefined : openNavigation} onSessionChanged={() => { setRevision(value => value + 1); void syncSelectedLocation(); }} onOpenSession={id => { openSession(id); setRevision(value => value + 1); }} attachmentPath={attachmentPath} attachmentContext={attachmentContext} onAttachmentConsumed={() => { setAttachmentPath(undefined); setAttachmentContext(undefined); }} /> : <View style={styles.welcome}><OpenCodeLogo width={160} /><Heading>Start a session</Heading><Label muted style={styles.welcomeDetail}>Choose a conversation, or create a new session in {projectLabel}.</Label></View>}</View>}
        </MotionScreen>
        {visited.workspace && <MotionScreen visible={tab === 'workspace'} style={[styles.full, tab !== 'workspace' && { display: 'none' }]}><WorkspaceScreen key={`${active.id}:${connectionRevision}:${directory}`} client={client} connection={active} directory={directory} sessionID={sessionID ?? undefined} visible={tab === 'workspace'} onDirectoryChange={changeDirectory} onAttachFile={attachFile} onBack={wide ? undefined : returnToSessions} backLabel={returnLabel} onOpenNavigation={wide ? undefined : openNavigation} /></MotionScreen>}
        {visited.settings && <MotionScreen visible={tab === 'settings'} style={[styles.full, tab !== 'settings' && { display: 'none' }]}><SettingsScreen key={`${active.id}:${connectionRevision}:${directory}`} client={client} directory={directory} visible={tab === 'settings'} onBackStateChange={setSettingsBackState} onBack={wide ? undefined : returnToSessions} backLabel={returnLabel} onOpenNavigation={wide ? undefined : openNavigation} /></MotionScreen>}
      </View>
      </View>
    </View>}
    <MotionDrawer visible={navigationOpen && !wide && !!active} width={Math.min(width - 32, 352)} onClose={() => setNavigationOpen(false)} onDismiss={onNavigationDismissed} panelStyle={styles.drawer}>
      <SafeAreaView style={styles.full} edges={['top', 'bottom', 'left']}>{navigation}</SafeAreaView>
    </MotionDrawer>
    <Sheet visible={serversOpen && !!active} title={unavailableID === active?.id ? 'Connection' : 'Servers'} allowDuringRecovery onClose={() => { serverSheetRequest.current += 1; setServersOpen(false); }} onDismiss={resumeSheets}>{serversOpen && active && serverForm}</Sheet>
    <Sheet visible={projectsOpen} title="Open a project" scroll={false} onClose={() => setProjectsOpen(false)}>
      {projectsOpen && client && active && <ProjectDirectoryBrowser key={`${active.id}:${connectionRevision}:${directory}`} client={client} directory={directory} value={newDirectory} projects={projects} busy={projectBusy} error={projectError} onChangeValue={value => { setNewDirectory(value); setProjectError(null); }} onOpenDirectory={value => { void openDirectory(value); }} />}
    </Sheet>
  </SafeAreaView>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, boot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  onboarding: { flexGrow: 1, padding: 24, paddingVertical: 40, maxWidth: 520, width: '100%', alignSelf: 'center', gap: 16 },
  shell: { flex: 1, flexDirection: 'row', minHeight: 0 }, main: { flex: 1, minWidth: 0, minHeight: 0 },
  iconButton: { width: Platform.OS === 'android' ? 48 : 44, height: Platform.OS === 'android' ? 48 : 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 }, full: { flex: 1, minWidth: 0, minHeight: 0 },
  sidebar: { width: 288, borderRightWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  navigationBrand: { height: Platform.OS === 'android' ? 48 : 64, paddingHorizontal: pageInset, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  projectChoice: { marginHorizontal: pageInset, paddingHorizontal: 15, paddingVertical: 10, minHeight: Platform.OS === 'android' ? 48 : 56, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border },
  contextText: { flex: 1, minWidth: 0, gap: 1 }, projectName: { fontSize: 13, fontWeight: '500' }, contextDetail: { fontSize: 10, lineHeight: 15 },
  navigationSessions: { flex: 1, minHeight: 0, marginTop: 8 },
  navigationFooter: { borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: pageInset, paddingTop: 8, gap: 4 },
  navigationLinks: { flexDirection: 'row', gap: 4 }, navigationLink: { flex: 1, minHeight: Platform.OS === 'android' ? 48 : 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8 },
  navigationLinkText: { fontFamily: sans, color: colors.muted, fontSize: 12, lineHeight: 18 }, selectedDestination: { backgroundColor: colors.panel },
  serverChoice: { minHeight: 48, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8 }, serverName: { fontSize: 12, fontWeight: '500' },
  drawer: { height: '100%', backgroundColor: colors.bg, borderRightWidth: 1, borderColor: colors.border },
  pressed: { backgroundColor: colors.selected }, welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }, welcomeDetail: { maxWidth: 320, textAlign: 'center', lineHeight: 23 },
});
