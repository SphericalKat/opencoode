import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Keyboard, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Rect } from 'react-native-svg';
import { type Connection, errorMessage, normalizeConnection } from '../lib/client';
import { parsePairingPayload } from '../lib/pairing';
import { type ThemeColors, useTheme, useThemedStyles } from '../lib/theme';
import { Button, Busy, Card, Disclosure, ErrorNotice, Field, Heading, Label, mono, Row, touchTarget } from './ui';
import { ShellIcon } from './ShellIcon';
import { MotionContent } from './motion';

export type ConnectionForm = { id: string; name: string; url: string; token: string; username?: string };
type Step = 'home' | 'pair' | 'address' | 'password' | 'scan';
type Props = {
  form: ConnectionForm;
  connections: Connection[];
  activeID?: string;
  connecting: boolean;
  error: string | null;
  pairingLink?: string | null;
  onPairingLinkConsumed: () => void;
  onChangeForm: (form: ConnectionForm) => void;
  onClearError: () => void;
  onConnect: (connection: Connection, alternatives?: Connection[]) => Promise<void>;
  onRemove: (connection: Connection) => Promise<void>;
};

const blankForm: ConnectionForm = { id: '', name: '', url: '', token: '' };

export function ConnectionFlow({ form, connections, activeID, connecting, error, pairingLink, onPairingLinkConsumed, onChangeForm, onClearError, onConnect, onRemove }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [navigation, setNavigation] = useState(() => ({ step: (form.id ? 'password' : form.url ? /\/auth\/connect\/[^/]+\/?$/.test(form.url) ? 'pair' : 'address' : 'home') as Step, direction: 0 as -1 | 0 | 1, revision: 0 }));
  const { step } = navigation;
  const [pairingText, setPairingText] = useState(form.id ? '' : form.url);
  const [localError, setLocalError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [managing, setManaging] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [submission, setSubmission] = useState<Connection[] | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const mounted = useRef(true);
  const acceptedScan = useRef(false);
  const requesting = useRef(false);
  const submitting = useRef(false);
  const connectRef = useRef(onConnect);
  connectRef.current = onConnect;
  const busy = connecting || !!submission || reading;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!pairingLink) return;
    setPairingText(pairingLink);
    setStep('pair');
    acceptPairing(pairingLink);
    onPairingLinkConsumed();
  }, [pairingLink]);

  useEffect(() => {
    if (!submission) return;
    let live = true;
    void connectRef.current(submission[0], submission.slice(1)).catch(cause => {
      if (live) setLocalError(errorMessage(cause));
    }).finally(() => {
      submitting.current = false;
      if (live) setSubmission(null);
    });
    return () => { live = false; };
  }, [submission]);

  useEffect(() => {
    if (step !== 'scan') return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => { setStep('home'); return true; });
    const appState = AppState.addEventListener('change', state => { if (state !== 'active') setStep('home'); });
    const timeout = !cameraReady ? setTimeout(() => {
      acceptedScan.current = true;
      setStep('pair');
      setLocalError('The camera is unavailable. Paste a pairing link instead.');
    }, 7_000) : null;
    return () => { back.remove(); appState.remove(); if (timeout) clearTimeout(timeout); };
  }, [step, cameraReady]);

  function clearError() { setLocalError(null); onClearError(); }

  function setStep(next: Step, direction: -1 | 0 | 1 = 0) {
    setNavigation(current => current.step === next ? current.direction === direction ? current : { ...current, direction } : { step: next, direction, revision: current.revision + 1 });
  }

  function go(next: Step, direction: -1 | 1 = 1) {
    if (busy) return;
    Keyboard.dismiss();
    clearError(); setCameraBlocked(false); setStep(next, direction);
  }

  function submit(candidates: Connection[], returnStep: Step = 'home') {
    if (connecting || submitting.current || !candidates.length) return;
    submitting.current = true;
    acceptedScan.current = true;
    Keyboard.dismiss();
    clearError();
    setStep(returnStep);
    setSubmission(candidates);
  }

  function acceptPairing(text: string) {
    try {
      const candidates = parsePairingPayload(text);
      onChangeForm(blankForm);
      submit(candidates);
    }
    catch (cause) { setLocalError(errorMessage(cause)); return false; }
    return true;
  }

  async function pastePairing() {
    if (busy || requesting.current) return;
    requesting.current = true;
    clearError(); setReading(true);
    setStep('pair');
    try {
      const text = await Clipboard.getStringAsync();
      if (!mounted.current) return;
      setPairingText(text); setStep('pair');
      if (text.trim()) acceptPairing(text);
    } catch {
      if (mounted.current) { setStep('pair'); setLocalError('Paste the pairing link into the field below.'); }
    } finally {
      requesting.current = false;
      if (mounted.current) setReading(false);
    }
  }

  async function scan() {
    if (busy || requesting.current) return;
    requesting.current = true;
    Keyboard.dismiss(); clearError(); setReading(true); setCameraBlocked(false);
    try {
      if (Platform.OS === 'web' && !(await CameraView.isAvailableAsync())) throw new Error('unavailable');
      const nextPermission = permission?.granted ? permission : await requestPermission();
      if (!mounted.current) return;
      if (!nextPermission.granted) {
        setCameraBlocked(!nextPermission.canAskAgain);
        setLocalError('Camera access is off. You can paste a pairing link or enable the camera to scan.');
        return;
      }
      acceptedScan.current = false; setCameraReady(false); setStep('scan');
    } catch {
      if (mounted.current) { setStep('pair'); setLocalError('The camera is unavailable. Paste a pairing link instead.'); }
    } finally {
      requesting.current = false;
      if (mounted.current) setReading(false);
    }
  }

  function nextAddress(animate = false) {
    if (busy) return;
    try {
      const url = form.url.trim();
      if (url.startsWith('{') || /\/auth\/connect\/[^/]+\/?$/.test(url)) { acceptPairing(url); return; }
      const normalized = normalizeConnection({ ...form, url, id: form.id || undefined });
      onChangeForm({ ...form, url: normalized.url });
      clearError(); setStep('password', animate ? 1 : 0);
    } catch (cause) { setLocalError(errorMessage(cause)); }
  }

  function connectManual() {
    try { submit([normalizeConnection({ ...form, id: form.id || undefined })], 'password'); }
    catch (cause) { setLocalError(errorMessage(cause)); }
  }

  const back = step !== 'home' && !submission ? <Button title="‹ Back" compact variant="ghost" disabled={busy} onPress={() => go(step === 'password' ? 'address' : 'home', -1)} /> : null;
  const savedServers = !!connections.length && <View style={styles.saved}>
    <Row style={{ justifyContent: 'space-between' }}><Label muted style={styles.instruction}>Your servers</Label><Button title={managing ? 'Done' : 'Manage'} compact variant="ghost" disabled={busy} onPress={() => setManaging(value => !value)} /></Row>
    {connections.map(connection => <View key={connection.id} style={styles.savedItem}><Pressable accessibilityRole="button" accessibilityLabel={`Connect to ${connection.name}${activeID === connection.id ? ', current server' : ''}`} disabled={busy} onPress={() => submit([connection])} style={({ pressed }) => [styles.server, pressed && { backgroundColor: colors.raised }]}><ShellIcon name="server" color={colors.muted} size={20} /><View style={styles.serverText}><Label numberOfLines={1} style={styles.serverName}>{connection.name}</Label><Label muted numberOfLines={1} ellipsizeMode="middle" style={styles.small}>{connection.url}</Label></View>{activeID === connection.id ? <Label muted style={styles.small}>Current</Label> : <ShellIcon name="chevron" color={colors.faint} size={16} />}</Pressable>{managing && <Row style={styles.manage}><Button title="Edit" compact disabled={busy} onPress={() => { clearError(); onChangeForm({ ...connection, token: connection.token || '' }); setStep('password'); }} /><Button title="Remove" compact variant="ghost" disabled={busy} onPress={() => { void onRemove(connection); }} /></Row>}</View>)}
  </View>;

  return <MotionContent variant="connection" transitionKey={navigation.revision} direction={navigation.direction} enabled={!busy && step !== 'scan'} style={styles.container}>
    {back && <View style={styles.back}>{back}</View>}
    <ErrorNotice error={localError || error} />
    {cameraBlocked && <Button title="Open camera settings" onPress={() => { void Linking.openSettings().catch(() => setLocalError('Open your device settings and enable camera access for Opencoode.')); }} />}
    {submission || connecting ? <Card><Busy /><Label style={styles.center}>Connecting to {serverName(submission?.[0]?.url || form.url)}</Label><Label muted style={styles.center}>Opening your workspace</Label></Card>
      : step === 'scan' ? <>
        <Heading>Scan the OpenCode QR code</Heading>
        <Label muted>Point your camera at the code on your computer.</Label>
        <View style={styles.camera}>
          <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onCameraReady={() => setCameraReady(true)} onMountError={() => { acceptedScan.current = true; setStep('pair'); setLocalError('The camera is unavailable. Paste a pairing link instead.'); }} onBarcodeScanned={({ data }) => {
            if (acceptedScan.current) return;
            acceptedScan.current = true;
            if (!acceptPairing(data)) setLocalError('This QR code is not an OpenCode pairing code. Scan the code from OpenCode.');
          }} />
          <View pointerEvents="none" style={styles.viewfinder}><View style={styles.frame} />{!cameraReady && <Busy />}</View>
        </View>
        {localError && <Button title="Scan another code" onPress={() => { clearError(); acceptedScan.current = false; }} />}
        <Button title="Paste a pairing link instead" variant="ghost" onPress={() => { void pastePairing(); }} />
      </> : step === 'pair' ? <>
        <Heading>Paste a pairing link</Heading>
        <Label muted>Copy the connection link from OpenCode on your computer.</Label>
        <Field label="Pairing link" placeholder="http://your-computer:4096/auth/connect/…" value={pairingText} onChangeText={value => { clearError(); setPairingText(value); }} keyboardType="url" autoComplete="off" autoFocus returnKeyType="go" onSubmitEditing={() => acceptPairing(pairingText)} />
        <Button title="Connect" variant="primary" disabled={!pairingText.trim() || busy} onPress={() => acceptPairing(pairingText)} />
        <Button title="Scan QR code instead" variant="ghost" onPress={() => { void scan(); }} />
      </> : step === 'address' ? <>
        <Heading>Enter the server address</Heading>
        <Label muted>Use your computer’s LAN or private VPN address.</Label>
        <Field label="Server address" placeholder="http://192.168.1.20:4096" value={form.url} editable={!busy} onChangeText={url => { clearError(); onChangeForm({ ...form, url, token: '' }); }} keyboardType="url" autoComplete="off" autoFocus returnKeyType="next" onSubmitEditing={() => nextAddress()} />
        <Button title="Continue" variant="primary" disabled={!form.url.trim() || busy} onPress={() => nextAddress(true)} />
        <Label muted style={styles.small}>On a phone, localhost refers to the phone. Use HTTPS outside a trusted network.</Label>
        <Disclosure title="Start a server"><Label selectable style={styles.command}>opencode serve --hostname 0.0.0.0 --port 4096</Label></Disclosure>
      </> : step === 'password' ? <>
        <Heading>{form.id ? 'Update your server' : 'Enter the server password'}</Heading>
        <Label muted numberOfLines={2}>{form.url}</Label>
        <Field label="Server password" placeholder="Password from OpenCode" secureTextEntry value={form.token} editable={!busy} onChangeText={token => { clearError(); onChangeForm({ ...form, token }); }} autoComplete="off" autoFocus returnKeyType="go" onSubmitEditing={connectManual} />
        <Button title="Connect" variant="primary" disabled={busy} onPress={connectManual} />
        <Label muted style={styles.small}>Leave this blank if your server does not require a password.</Label>
        <Disclosure title="Connection details"><Field label="Name" value={form.name} onChangeText={name => onChangeForm({ ...form, name })} /><Field label="Username" placeholder="opencode" value={form.username ?? 'opencode'} onChangeText={username => onChangeForm({ ...form, username })} /></Disclosure>
      </> : <>
        {activeID && savedServers}
        <View style={styles.intro}><PairingIcon color={colors.muted} /><Heading>{activeID ? 'Add a server' : 'Connect to OpenCode'}</Heading><Label muted style={styles.center}>Your computer does the work. Pick up the conversation here.</Label></View>
        <View style={styles.actions}><Button title="Scan QR code" variant="primary" busy={reading} onPress={() => { void scan(); }} /><Button title="Paste pairing link" disabled={busy} onPress={() => { void pastePairing(); }} /></View>
        <Card><Label style={styles.instruction}>On your computer</Label><Label muted>Run the command below, then scan the QR code or copy its connection link.</Label><Label selectable style={styles.command}>opencode pair</Label></Card>
        <Button title="Connect with a server address" variant="ghost" disabled={busy} onPress={() => { onChangeForm(blankForm); go('address'); }} />
        {!activeID && savedServers}
      </>}
    {step !== 'scan' && <Label muted style={styles.privacy}>{Platform.OS === 'web' ? 'Connections stay in this tab. Your server must allow this browser origin with --cors.' : 'Your server credentials stay in secure storage on this device.'}</Label>}
  </MotionContent>;
}

function serverName(value: string) { try { return new URL(value).hostname; } catch { return 'OpenCode'; } }

function PairingIcon({ color }: { color: string }) {
  return <Svg width={52} height={52} viewBox="0 0 32 32" fill="none" aria-hidden><Rect x={4} y={4} width={8} height={8} rx={1} stroke={color} strokeWidth={1.5} /><Rect x={20} y={4} width={8} height={8} rx={1} stroke={color} strokeWidth={1.5} /><Rect x={4} y={20} width={8} height={8} rx={1} stroke={color} strokeWidth={1.5} /><Path d="M20 20h4v4h4v4h-8v-4M28 20v-4M16 4v4M4 16h4M12 16h8M16 20v8" stroke={color} strokeWidth={1.5} strokeLinecap="square" /></Svg>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: 16 }, back: { alignSelf: 'flex-start', marginLeft: -10 }, center: { textAlign: 'center' },
    intro: { gap: 12, alignItems: 'center', paddingTop: 8, paddingBottom: 8 }, actions: { gap: 4 }, instruction: { fontWeight: '500', fontSize: 13 }, command: { fontFamily: mono, fontSize: 12, color: colors.text, paddingVertical: 4 }, small: { fontSize: 12, lineHeight: 18 },
    saved: { gap: 4 }, savedItem: { borderBottomWidth: 1, borderColor: colors.border }, server: { minHeight: touchTarget + 16, paddingVertical: 12, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 6 }, serverText: { flex: 1, minWidth: 0, gap: 2 }, serverName: { fontWeight: '500' }, manage: { paddingBottom: 10, paddingLeft: 32 },
    camera: { width: '100%', aspectRatio: 1, maxHeight: 360, overflow: 'hidden', borderRadius: 12, backgroundColor: '#000000' }, viewfinder: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }, frame: { position: 'absolute', width: '70%', aspectRatio: 1, borderWidth: 1.5, borderColor: '#ffffffbb', borderRadius: 12 }, privacy: { fontSize: 11, lineHeight: 17, textAlign: 'center', paddingTop: 4 },
  });
}
