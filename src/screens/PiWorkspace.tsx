import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Keyboard, Linking, View } from 'react-native';
import type { SessionInfo } from '@opencode/client';
import type { PiCommand } from '../../packages/pi-mobile/protocol';
import { BetaMoreSheet, BetaSessionNavigation, BetaTabsSheet, BetaTabStrip, SessionSurface, type OpenSessionTab } from '../components/BetaNavigation';
import { Busy, ErrorNotice } from '../components/ui';
import { useBetaLayout } from '../lib/betaLayout';
import { type Connection, errorMessage } from '../lib/client';
import { makePiChatBackend } from '../lib/piChatBackend';
import { createPiClient } from '../lib/piClient';
import { useUnsavedGuard } from '../lib/unsaved';
import { ChatScreen } from './ChatScreen';
import { SettingsScreen, type Section } from './SettingsScreen';

type Props = { connection: Connection; onManageServers: () => void; onConnectionLost: (error: unknown) => void; foreground: boolean };
const settingsSections: Section[] = ['Appearance', 'Models'];

export function PiWorkspace(props: Props) {
  return <PiWorkspaceSession key={`${props.connection.id}:${props.connection.url}`} {...props} />;
}

function PiWorkspaceSession({ connection, foreground, onManageServers, onConnectionLost }: Props) {
  const betaLayout = useBetaLayout();
  const client = useMemo(() => createPiClient(connection), [connection]);
  const backend = useMemo(() => makePiChatBackend(connection, client), [connection, client]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [tabs, setTabs] = useState<OpenSessionTab[]>([]);
  const [recent, setRecent] = useState<OpenSessionTab[]>([]);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panelRequest, setPanelRequest] = useState<{ id: number; sessionID: string; panel: 'actions' }>();
  const alive = useRef(true);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const pendingNavigation = useRef<(() => void) | null>(null);
  const operation = useRef(false);
  const requestID = useRef(0);
  const settingsCanGoBack = useRef(false);
  const lostConnection = useRef(onConnectionLost);
  lostConnection.current = onConnectionLost;
  const confirmNavigation = useUnsavedGuard();

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; pendingNavigation.current = null; };
  }, []);

  const recordSession = useCallback((next: SessionInfo) => {
    if (!alive.current) return;
    setSession(current => current?.id === next.id && current.title === next.title && current.location.directory === next.location.directory ? current : next);
    const tab = { id: next.id, title: next.title || 'New session', directory: next.location.directory };
    setTabs(current => {
      const previous = current.find(item => item.id === next.id);
      if (previous?.title === tab.title && previous.directory === tab.directory) return current;
      return previous ? current.map(item => item.id === tab.id ? tab : item) : [...current, tab];
    });
  }, []);

  const refreshSession = useCallback(async (signal?: AbortSignal) => {
    const info = await client.info(signal);
    const next = await backend.core.session.get({ sessionID: info.session.id }, { signal });
    if (!signal?.aborted) recordSession(next);
  }, [backend, client, recordSession]);

  useEffect(() => {
    if (!foreground || session) return;
    const controller = new AbortController();
    void refreshSession(controller.signal).catch(cause => {
      if (controller.signal.aborted) return;
      setError(errorMessage(cause));
      lostConnection.current(cause);
    });
    return () => controller.abort();
  }, [foreground, session, refreshSession]);

  useEffect(() => {
    if (!foreground || !navigationOpen) return;
    const controller = new AbortController();
    void client.sessions(controller.signal).then(value => {
      if (!controller.signal.aborted) setRecent(value.map(item => ({ id: item.id, title: item.name || 'New session', directory: item.cwd })));
    }).catch(cause => { if (!controller.signal.aborted) setError(errorMessage(cause)); });
    return () => controller.abort();
  }, [client, foreground, navigationOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (settingsCanGoBack.current) return false;
      setSettingsOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [settingsOpen]);

  const changeSession = async (command: Extract<PiCommand, { type: 'new' | 'switch' }>) => {
    if (operation.current || !foreground) return;
    if (!await confirmNavigation() || !alive.current) return;
    operation.current = true;
    setBusy(true); setError(null);
    try {
      const current = sessionRef.current;
      if (!current) return;
      await client.command({ ...command, expectedSessionID: current.id });
      if (alive.current) await refreshSession();
    } catch (cause) { if (alive.current) setError(errorMessage(cause)); }
    finally { operation.current = false; if (alive.current) setBusy(false); }
  };

  const openSession = (id: string) => {
    if (!id || id === sessionRef.current?.id) return;
    void changeSession({ type: 'switch', sessionID: id });
  };
  const openChatSession = (id: string) => {
    if (!id || !foreground) return;
    void (async () => {
      const info = await client.info();
      if (!alive.current) return;
      if (info.session.id === id) {
        recordSession(await backend.core.session.get({ sessionID: id }));
      } else await changeSession({ type: 'switch', sessionID: id });
    })().catch(cause => { if (alive.current) setError(errorMessage(cause)); });
  };
  const afterNavigation = (action: () => void) => {
    pendingNavigation.current = action;
    setNavigationOpen(false);
  };
  const onNavigationDismissed = () => {
    const action = pendingNavigation.current;
    pendingNavigation.current = null;
    if (alive.current) action?.();
  };
  const showDetails = () => {
    const current = sessionRef.current;
    if (current) setPanelRequest({ id: ++requestID.current, sessionID: current.id, panel: 'actions' });
  };
  const afterMenu = (action: () => void) => {
    pendingNavigation.current = action;
    setMoreOpen(false);
  };
  const onSettingsBackState = useCallback((value: boolean) => { settingsCanGoBack.current = value; }, []);
  const currentTab = session ? { id: session.id, title: session.title || 'New session', directory: session.location.directory } : undefined;

  return <View style={{ flex: 1 }}>
    {!settingsOpen && !selected && <BetaTabStrip current={currentTab} count={tabs.length} busy={busy || !session} onOpen={() => setNavigationOpen(true)} />}
    {error && <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}><ErrorNotice error={error} onRetry={() => { setError(null); void refreshSession().catch(cause => setError(errorMessage(cause))); }} /></View>}
    <SessionSurface framed={betaLayout && !settingsOpen}>
      {!settingsOpen && !selected && session && betaLayout && <BetaSessionNavigation pane="Session" directory={session.location.directory} changes={false} onSelect={() => setSettingsOpen(false)} onMore={() => { Keyboard.dismiss(); setMoreOpen(true); }} />}
      {session ? <>
        <View style={[{ flex: 1 }, settingsOpen && { display: 'none' }]}><ChatScreen backend={backend} sessionID={session.id} draftKey={`pi:${connection.id}:${session.id}`} serverID={connection.id} betaLayout={betaLayout} visible={foreground && !settingsOpen} projectLabel={session.location.directory.split(/[\\/]/).filter(Boolean).pop()} onOpenNavigation={() => setNavigationOpen(true)} onSelectionChange={setSelected} onSessionInfo={recordSession} onSessionChanged={() => { void refreshSession().catch(cause => { if (alive.current) setError(errorMessage(cause)); }); }} onOpenSession={openChatSession} onConnectionLost={onConnectionLost} sessionPanelRequest={panelRequest} /></View>
        {settingsOpen && <SettingsScreen modelCatalog={backend.core.model} directory={session.location.directory} sections={settingsSections} betaLayout={betaLayout} visible onBack={() => setSettingsOpen(false)} backLabel="Chat" onBackStateChange={onSettingsBackState} onManageServers={onManageServers} serverLabel={connection.name} />}
      </> : <Busy />}
    </SessionSurface>
    <BetaMoreSheet visible={moreOpen} onClose={() => setMoreOpen(false)} onDismiss={onNavigationDismissed} onDetails={() => afterMenu(showDetails)} />
    <BetaTabsSheet visible={navigationOpen} tabs={tabs} recent={recent} selectedID={session?.id} onClose={() => setNavigationOpen(false)} onDismiss={onNavigationDismissed} onSelect={id => afterNavigation(() => openSession(id))} onNew={() => afterNavigation(() => { void changeSession({ type: 'new' }); })} onSettings={() => afterNavigation(() => setSettingsOpen(true))} onHelp={() => afterNavigation(() => { void Linking.openURL('https://pi.dev/docs/latest/'); })} />
  </View>;
}
