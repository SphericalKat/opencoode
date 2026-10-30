import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { CredentialEntry, IntegrationAttempt, IntegrationCommandAttempt, IntegrationInfo, IntegrationMethod, ModelInfo, PermissionSavedInfo } from '@opencode/client';
import { isFileNotFoundError } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { externalURL, saveConfigFile, withSettingsRequest } from '../lib/settings';
import { Button, Busy, Card, confirmAction, Disclosure, Empty, ErrorNotice, Field, Heading, JsonView, Label, mono, sans, Row, Sheet } from '../components/ui';
import { DynamicFields } from '../components/SessionForms';
import { initialFormValues, prepareFormAnswer, type FormValues } from '../lib/forms';
import { AdvancedSettings } from '../components/AdvancedSettings';
import { GlobalForms } from '../components/GlobalForms';
import { useTheme, useThemedStyles, type ThemeColors } from '../lib/theme';
import { useUnsavedChanges, useUnsavedGuard } from '../lib/unsaved';

type Section = 'Accounts' | 'Models' | 'MCP' | 'Config' | 'Skills' | 'Plugins' | 'Permissions' | 'Advanced' | 'Appearance';
const sectionDescriptions: Record<Section, string> = {
  Accounts: 'Provider connections and credentials',
  Models: 'Available models and capabilities',
  MCP: 'Tool servers and pending requests',
  Config: 'Server configuration and shell',
  Skills: 'Skills in this workspace',
  Plugins: 'Server plugins and updates',
  Permissions: 'Saved approvals for this project',
  Advanced: 'Usage, web search, and generation',
  Appearance: 'System, light, or dark theme',
};
const sectionGroups: { title: string; items: Section[] }[] = [
  { title: 'General', items: ['Appearance', 'Config'] },
  { title: 'Connections', items: ['Accounts', 'Models', 'MCP'] },
  { title: 'Agent', items: ['Skills', 'Plugins', 'Permissions'] },
  { title: 'Advanced', items: ['Advanced'] },
];

export function SettingsScreen({ client, directory, visible = true, onBackStateChange }: { client: Client; directory: string; visible?: boolean; onBackStateChange?: (canGoBack: boolean) => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const wide = width >= 920;
  const [section, setSection] = useState<Section | null>(null);
  const confirmNavigation = useUnsavedGuard();
  const mounted = useRef(true);
  const selected = section ?? (wide ? 'Accounts' : null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const changeSection = useCallback(async (next: Section | null) => {
    if (next === section) return;
    if (section !== null && !await confirmNavigation()) return;
    if (mounted.current) setSection(next);
  }, [section, confirmNavigation]);
  useEffect(() => {
    onBackStateChange?.(visible && !wide && section !== null);
    return () => onBackStateChange?.(false);
  }, [onBackStateChange, visible, wide, section]);
  useEffect(() => {
    if (!visible || wide || section === null) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { void changeSection(null); return true; });
    return () => subscription.remove();
  }, [visible, wide, section, changeSection]);

  return <View style={styles.screen}>
    {(wide || section === null) && <ScrollView style={wide ? styles.sidebar : undefined} contentContainerStyle={styles.index}>
      <View style={styles.indexHeader}><Heading>Settings</Heading><Label muted>Preferences, connections, and tools</Label></View>
      {sectionGroups.map(group => <View key={group.title} style={styles.group}>
        {!(group.items.length === 1 && group.items[0] === group.title) && <Label muted style={styles.groupTitle}>{group.title.toUpperCase()}</Label>}
        <View style={styles.groupPanel}>{group.items.map((item, index) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Open ${item}. ${sectionDescriptions[item]}`} accessibilityState={{ selected: selected === item }} aria-current={selected === item ? 'page' : undefined} onPress={() => { void changeSection(item); }} style={({ pressed }) => [styles.sectionRow, index > 0 && styles.sectionDivider, wide && selected === item && styles.currentSection, pressed && { backgroundColor: colors.raised }]}>
          <View style={{ flex: 1, minWidth: 0 }}><Label style={styles.sectionName}>{item}</Label><Label muted numberOfLines={1} style={styles.sectionDescription}>{sectionDescriptions[item]}</Label></View>
          <Label muted accessibilityElementsHidden style={styles.chevron}>›</Label>
        </Pressable>)}</View>
      </View>)}
    </ScrollView>}
    {selected && <View style={styles.detail}>
      <Row style={styles.detailHeader}>{!wide && <Button title="‹ Settings" accessibilityLabel="Back to Settings" compact variant="ghost" onPress={() => { void changeSection(null); }} />}<Label accessibilityRole="header" style={styles.detailTitle}>{selected}</Label></Row>
      <View key={`${directory}:${selected}`} style={{ flex: 1 }}>
        {selected === 'Accounts' && <Accounts client={client} directory={directory} />}
        {selected === 'Models' && <Models client={client} directory={directory} />}
        {selected === 'MCP' && <Mcp client={client} directory={directory} />}
        {selected === 'Config' && <Configuration client={client} directory={directory} />}
        {selected === 'Skills' && <Skills client={client} directory={directory} />}
        {selected === 'Plugins' && <Plugins client={client} directory={directory} />}
        {selected === 'Permissions' && <Permissions client={client} directory={directory} />}
        {selected === 'Advanced' && <AdvancedSettings client={client} directory={directory} />}
        {selected === 'Appearance' && <AppearanceSettings />}
      </View>
    </View>}
  </View>;
}

function useResource<T>(client: Client, directory: string, load: (signal: AbortSignal) => Promise<T>) {
  const scope = useMemo(() => ({ client, directory }), [client, directory]);
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resourceScope, setResourceScope] = useState(scope);
  const active = useRef(true);
  const latest = useRef({ scope, load });
  latest.current = { scope, load };
  const sequence = useRef(0);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const { scope: owner, load: read } = latest.current;
    const current = ++sequence.current;
    const isCurrent = () => active.current && current === sequence.current && latest.current.scope === owner;
    setResourceScope(owner);
    setLoading(true);
    setError(null);
    try { const result = await withSettingsRequest(read, signal); if (isCurrent()) setData(result); }
    catch (e) { if (isCurrent()) setError(errorMessage(e)); }
    finally { if (isCurrent()) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    active.current = true;
    setData(undefined);
    void refresh(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
    return () => { active.current = false; sequence.current++; controller.abort(); };
  }, [scope, refresh]);
  return { data: resourceScope === scope ? data : undefined, error: resourceScope === scope ? error : null, loading: resourceScope !== scope || loading, refresh };
}

function Page({ children, error, loading, refresh }: { children: React.ReactNode; error?: string | null; loading?: boolean; refresh?: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
    <Row style={{ justifyContent: 'flex-end' }}>{refresh && <Button title="Refresh" compact variant="ghost" onPress={() => refresh()} />}</Row>
    <ErrorNotice error={error} onRetry={refresh ? () => refresh() : undefined} />{loading && <Busy />}{children}
  </ScrollView>;
}

function AppearanceSettings() {
  const { appearance, scheme, setAppearance } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return <Page error={error}>
    <Label muted>Use your device theme or choose a fixed color scheme.</Label>
    {(['system', 'light', 'dark'] as const).map(value => <Button key={value} title={value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'} selected={appearance === value} variant={appearance === value ? 'primary' : 'secondary'} disabled={busy} onPress={() => {
      setBusy(true); setError(null);
      void setAppearance(value).catch(e => setError(errorMessage(e))).finally(() => setBusy(false));
    }} />)}
    <Label muted>Current theme: {scheme}</Label>
  </Page>;
}

function Accounts({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => {
    const [integrations, credentials] = await Promise.all([client.integration.list({ location: { directory } }, { signal }), client.credential.list({ signal })]);
    return { integrations: integrations.data, credentials };
  });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<IntegrationInfo>();
  const [limit, setLimit] = useState(40);
  useEffect(() => setLimit(40), [query]);
  const [credential, setCredential] = useState<CredentialEntry>();
  const [label, setLabel] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<unknown>) => {
    setBusy(true); setActionError(null);
    try { await withSettingsRequest(async signal => { await action(signal); await refresh(signal); }); } catch (e) { setActionError(errorMessage(e)); } finally { setBusy(false); }
  };
  const search = query.trim().toLowerCase();
  const integrations = data?.integrations.filter(item => `${item.name} ${item.id}`.toLowerCase().includes(search)) ?? [];
  return <Page error={error} loading={loading} refresh={refresh}>
    <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}><Field label="Find a provider or integration" placeholder="Search accounts" value={query} onChangeText={setQuery} containerStyle={{ flex: 1 }} />{!!query && <Button title="Clear" accessibilityLabel="Clear provider search" compact variant="ghost" onPress={() => setQuery('')} />}</Row>
    <ErrorNotice error={actionError} />
    {!!data?.credentials.length && <Label style={styles.sectionLabel}>SAVED ACCOUNTS</Label>}
    {data?.credentials.map(item => <Card key={item.id}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Label style={styles.name}>{item.label || item.integrationID}</Label><Label muted>{item.integrationID} · {item.value.type}{item.active ? ' · Active' : ''}</Label></View><Button title="Manage" compact onPress={() => { setCredential(item); setLabel(item.label); setActionError(null); }} /></Row></Card>)}
    <Label style={styles.sectionLabel}>CONNECT AN ACCOUNT</Label>
    {integrations.slice(0, limit).map(item => <Card key={item.id}>
      <Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Label style={styles.name}>{item.name}</Label><Label muted>{item.connections.length ? `${item.connections.length} connection${item.connections.length === 1 ? '' : 's'}` : 'Not connected'}</Label></View><Button title="Connect" compact onPress={() => setSelected(item)} /></Row>
      {item.connections.map((connection, index) => connection.status && <Label key={index} style={{ color: colors.danger }}>{connection.status.message}</Label>)}
    </Card>)}
    {integrations.length > limit && <><Label muted>Showing {limit} of {integrations.length} integrations. Search or load more.</Label><Button title="Load more integrations" onPress={() => setLimit(value => value + 40)} /></>}
    {data && !loading && !!data.integrations.length && !!search && !integrations.length && <Card><Empty title="No matching providers" detail="Try a provider name or integration ID, or clear the search to see all providers." /><Button title="Clear search" onPress={() => setQuery('')} /></Card>}
    {data && !data.integrations.length && <Empty title="No integrations" detail="Your server did not publish any account integrations for this project." />}
    <Sheet visible={!!credential} title="Manage account" onClose={() => { if (!busy) setCredential(undefined); }}>
      <ErrorNotice error={actionError} /><Label muted>{credential?.integrationID}</Label><Field label="Account name" value={label} editable={!busy} onChangeText={setLabel} />
      <Button title="Save name" busy={busy} onPress={() => void run(async signal => { if (!credential) return; await client.credential.update({ credentialID: credential.id, label: label.trim() }, { signal }); signal.throwIfAborted(); setCredential(undefined); })} />
      {!credential?.active && <Button title="Use this account" variant="primary" busy={busy} onPress={() => void run(async signal => { if (!credential) return; await client.credential.activate({ credentialID: credential.id }, { signal }); signal.throwIfAborted(); setCredential(undefined); })} />}
      <Button title="Remove account" variant="danger" busy={busy} onPress={() => { if (!credential) return; const credentialID = credential.id; void confirmAction('Remove account?', 'This removes the saved credential from your OpenCode server.').then(confirmed => { if (confirmed) void run(async signal => { await client.credential.remove({ credentialID }, { signal }); signal.throwIfAborted(); setCredential(undefined); }); }); }} />
    </Sheet>
    {selected && <ConnectIntegration key={selected.id} client={client} directory={directory} integration={selected} onClose={() => { setSelected(undefined); void refresh(); }} />}
  </Page>;
}

type Attempt = { kind: 'oauth'; data: IntegrationAttempt } | { kind: 'command'; data: IntegrationCommandAttempt };
function ConnectIntegration({ client, directory, integration, onClose }: { client: Client; directory: string; integration: IntegrationInfo; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [method, setMethod] = useState<IntegrationMethod>();
  const [values, setValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const [attempt, setAttempt] = useState<Attempt>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const statusRequest = useRef(false);
  useEffect(() => () => { active.current = false; }, []);
  const check = useCallback(async () => {
    if (!attempt || statusRequest.current) return;
    statusRequest.current = true;
    try {
      const input = { integrationID: integration.id, attemptID: attempt.data.attemptID, location: { directory } };
      const result = attempt.kind === 'oauth' ? await client.integration.oauth.status(input) : await client.integration.command.status(input);
      if (!active.current) return;
      setStatus(result.data.status);
      if (result.data.status === 'failed') setError(result.data.message);
      if (result.data.status === 'complete') onClose();
    } catch (e) { if (active.current) setError(errorMessage(e)); }
    finally { statusRequest.current = false; }
  }, [attempt, client, directory, integration.id, onClose]);
  useEffect(() => {
    if (!attempt || ['complete', 'expired', 'failed'].includes(status)) return;
    void check(); const timer = setInterval(() => void check(), 3000); return () => clearInterval(timer);
  }, [attempt, status, check]);
  const open = async (url: string) => { try { await Linking.openURL(externalURL(url)); } catch (e) { setError(errorMessage(e)); } };
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(null); try { await action(); } catch (e) { if (active.current) setError(errorMessage(e)); } finally { if (active.current) setBusy(false); } };
  const start = async () => {
    if (!method || method.type === 'env') return;
    const prepared = prepareFormAnswer('form' in method ? method.form ?? [] : [], values);
    setFieldErrors(prepared.errors);
    if (Object.keys(prepared.errors).length) return;
    const input = { integrationID: integration.id, location: { directory }, label: label.trim() || undefined, answer: prepared.answer };
    await run(async () => {
      if (method.type === 'key') {
        if (!key.trim()) throw new Error('Enter an API key');
        await client.integration.connect.key({ ...input, key: key.trim() }); setKey(''); onClose();
      } else if (method.type === 'external') { await client.integration.connect.external({ ...input, methodID: method.id }); onClose(); }
      else if (method.type === 'oauth') { const result = await client.integration.oauth.connect({ ...input, methodID: method.id }); setAttempt({ kind: 'oauth', data: result.data }); setStatus('pending'); await open(result.data.url); }
      else { const result = await client.integration.command.connect({ ...input, methodID: method.id }); setAttempt({ kind: 'command', data: result.data }); setStatus('pending'); }
    });
  };
  return <Sheet visible title={`Connect ${integration.name}`} onClose={onClose}>
    <ErrorNotice error={error} />
    {!attempt && <>
      <Label muted>Choose a connection method. Credentials stay on your OpenCode server.</Label>
      {integration.methods.map((item, index) => <Button key={index} title={item.type === 'env' ? `Server environment: ${item.names.join(', ')}` : item.label || (item.type === 'key' ? 'API key' : item.type)} selected={method === item} variant={method === item ? 'primary' : 'secondary'} onPress={() => { setMethod(item); setError(null); setFieldErrors({}); setValues(initialFormValues('form' in item ? item.form ?? [] : [])); }} />)}
      {method?.type === 'env' && <Label muted>Set these environment variables on the server, then restart OpenCode.</Label>}
      {method && method.type !== 'env' && <><Field label="Account name (optional)" value={label} onChangeText={setLabel} />
        {method.type === 'key' && <Field label="API key" secureTextEntry value={key} onChangeText={setKey} />}
        {'form' in method && <DynamicFields fields={method.form ?? []} values={values} onChange={setValues} errors={fieldErrors} />}
        {method.type === 'command' && <Card><Label muted>This starts the sign-in command on your server.</Label><Label style={{ fontFamily: mono }}>{method.command.join(' ')}</Label></Card>}
        <Button title="Continue" variant="primary" busy={busy} onPress={() => void start()} /></>}
      {!integration.methods.length && <Empty title="No connection methods" />}
    </>}
    {attempt && <>
      <Label style={styles.name}>{status === 'pending' ? 'Complete the sign-in' : status}</Label>
      {attempt.kind === 'oauth' && <><Label>{attempt.data.instructions}</Label><Button title="Open sign-in page" onPress={() => void open(attempt.data.url)} />
        {attempt.data.mode === 'code' && <><Field label="Authorization code" value={code} onChangeText={setCode} /><Button title="Submit code" variant="primary" busy={busy} disabled={!code.trim()} onPress={() => void run(async () => { await client.integration.oauth.complete({ integrationID: integration.id, attemptID: attempt.data.attemptID, location: { directory }, code: code.trim() }); await check(); })} /></>}
      </>}
      {attempt.kind === 'command' && <Label muted>Complete any browser or terminal steps on the server. This page checks the result automatically.</Label>}
      <Button title="Check status" compact onPress={() => void check()} />
      <Button title="Cancel sign-in" variant="danger" busy={busy} onPress={() => void run(async () => { const input = { integrationID: integration.id, attemptID: attempt.data.attemptID, location: { directory } }; if (attempt.kind === 'oauth') await client.integration.oauth.cancel(input); else await client.integration.command.cancel(input); setAttempt(undefined); setStatus(''); })} />
    </>}
  </Sheet>;
}

function Models({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => {
    const [models, providers] = await Promise.all([client.model.list({ location: { directory }, types: ['chat', 'image', 'decision'] }, { signal }), client.provider.list({ location: { directory } }, { signal })]);
    return { models: models.data, providers: providers.data };
  });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ModelInfo>();
  const [limit, setLimit] = useState(40);
  useEffect(() => setLimit(40), [query]);
  const search = query.trim().toLowerCase();
  const models = data?.models.filter(item => `${item.name} ${item.providerID} ${item.id}`.toLowerCase().includes(search)) ?? [];
  return <Page error={error} loading={loading} refresh={refresh}>
    <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}><Field label="Find a model" placeholder="Name or provider" value={query} onChangeText={setQuery} containerStyle={{ flex: 1 }} />{!!query && <Button title="Clear" accessibilityLabel="Clear model search" compact variant="ghost" onPress={() => setQuery('')} />}</Row>
    <Label muted>Select a model inside a chat to use it. Edit configuration to change server defaults or custom providers.</Label>
    <Label style={styles.sectionLabel}>{models.length} MODELS</Label>
    {models.slice(0, limit).map(item => <Card key={`${item.providerID}/${item.id}`}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Label style={styles.name}>{item.name}</Label><Label muted>{item.providerID} · {item.enabled ? 'Available' : 'Not connected'}</Label></View><Button title="Details" compact onPress={() => setSelected(item)} /></Row></Card>)}
    {models.length > limit && <><Label muted>Showing {limit} of {models.length} models.</Label><Button title="Load more models" onPress={() => setLimit(value => value + 40)} /></>}
    {data && !loading && !!data.models.length && !!search && !models.length && <Card><Empty title="No matching models" detail="Try a model name, provider, or model ID, or clear the search to see all models." /><Button title="Clear search" onPress={() => setQuery('')} /></Card>}
    {data && !loading && !data.models.length && <Empty title="No models available" detail="Your server did not publish a model catalog for this project." />}
    <Disclosure title={`Providers (${data?.providers.length ?? 0})`}>{data?.providers.map(item => <View key={item.id} style={{ gap: 4 }}><Label>{item.name}</Label><Label muted>{item.id} · {item.activation}</Label></View>)}</Disclosure>
    <Sheet visible={!!selected} title={selected?.name || 'Model'} onClose={() => setSelected(undefined)}>{selected && <><Label muted>{selected.providerID}/{selected.id}</Label><Label>Context: {selected.limit.context.toLocaleString()} tokens · Output: {selected.limit.output.toLocaleString()} tokens</Label><Label>Variants: {selected.variants.map(item => item.id).join(', ') || 'Default'}</Label><Disclosure title="Capabilities"><JsonView value={selected.capabilities} /></Disclosure><Disclosure title="Prices"><JsonView value={selected.cost} /></Disclosure><Disclosure title="Details"><JsonView value={selected} /></Disclosure></>}</Sheet>
  </Page>;
}

function Mcp({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => (await client.mcp.list({ location: { directory } }, { signal })).data);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'remote' | 'local'>('remote');
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [resources, setResources] = useState<unknown>();
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => { setBusy(true); setErrorAction(null); try { await withSettingsRequest(async signal => { await action(signal); await refresh(signal); }); } catch (e) { setErrorAction(errorMessage(e)); } finally { setBusy(false); } };
  return <Page error={error} loading={loading} refresh={refresh}>
    <GlobalForms client={client} directory={directory} />
    <Row><Button title="Add MCP server" variant="primary" disabled={busy} onPress={() => { setAdding(true); setErrorAction(null); }} /><Button title="Resources" disabled={busy} onPress={() => void run(async signal => { const result = await client.mcp.resource.catalog({ location: { directory } }, { signal }); signal.throwIfAborted(); setResources(result.data); })} /></Row>
    <ErrorNotice error={errorAction} />
    {data?.map(item => <Card key={item.name}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Label style={styles.name}>{item.title || item.name}</Label><Label muted>{item.name} · {item.status.status.replace('_', ' ')}</Label></View><Button title={item.status.status === 'connected' ? 'Disconnect' : 'Connect'} busy={busy} compact onPress={() => void run(async signal => { const input = { server: item.name, location: { directory } }; if (item.status.status === 'connected') await client.experimental.mcp.disconnect(input, { signal }); else await client.experimental.mcp.connect(input, { signal }); })} /></Row>
      {'error' in item.status && <Label style={{ color: colors.danger }}>{item.status.error}</Label>}
      {item.status.status === 'needs_auth' && <Label muted>Connect its account in the Accounts tab. The integration name is {item.integrationID || item.name}.</Label>}
      <Button title="Remove" variant="danger" compact busy={busy} onPress={() => { void confirmAction('Remove MCP server?', `This removes ${item.name} from the project configuration.`).then(confirmed => { if (confirmed) void run(async signal => { await client.experimental.mcp.remove({ server: item.name, location: { directory } }, { signal }); }); }); }} />
    </Card>)}
    {data && !data.length && <Empty title="No MCP servers" detail="Connect tools and resources from your own servers." />}
    <Sheet visible={resources !== undefined} title="MCP resources" onClose={() => setResources(undefined)}><JsonView value={resources} /></Sheet>
    <Sheet visible={adding} title="Add MCP server" onClose={() => { if (!busy) setAdding(false); }}>
      <ErrorNotice error={errorAction} /><Field label="Server name" value={name} editable={!busy} onChangeText={setName} placeholder="my-tools" />
      <Row><Button title="Remote URL" disabled={busy} variant={kind === 'remote' ? 'primary' : 'secondary'} onPress={() => setKind('remote')} /><Button title="Server command" disabled={busy} variant={kind === 'local' ? 'primary' : 'secondary'} onPress={() => setKind('local')} /></Row>
      {kind === 'remote' ? <Field label="MCP URL" keyboardType="url" value={url} editable={!busy} onChangeText={setUrl} placeholder="https://example.com/mcp" /> : <><Field label="Command arguments (JSON array)" multiline value={command} editable={!busy} onChangeText={setCommand} placeholder={'["npx", "-y", "your-mcp-server"]'} /><Label muted>The command runs on the OpenCode server.</Label></>}
      <Button title="Add server" variant="primary" busy={busy} disabled={!name.trim()} onPress={() => void run(async signal => {
        const server = name.trim();
        if (kind === 'remote') await client.experimental.mcp.add({ server, location: { directory }, config: { type: 'remote', url: externalURL(url.trim()) } }, { signal });
        else { const args: unknown = JSON.parse(command); if (!Array.isArray(args) || !args.length || !args.every(arg => typeof arg === 'string' && arg.length)) throw new Error('Enter a JSON array of command arguments'); await client.experimental.mcp.add({ server, location: { directory }, config: { type: 'local', command: args } }, { signal }); }
        signal.throwIfAborted();
        setAdding(false); setName(''); setUrl(''); setCommand('');
      })} />
    </Sheet>
  </Page>;
}

function Configuration({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => {
    const [entries, shells] = await Promise.all([client.config.get({ location: { directory } }, { signal }), client.config.shells({ signal })]);
    return { entries, shells };
  });
  const [editing, setEditing] = useState<{ path: string; original: string | null }>();
  const [text, setText] = useState('');
  useUnsavedChanges(`configuration:${directory}`, 'Configuration editor', Boolean(editing && text !== editing.original));
  const [notice, setNotice] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => { setBusy(true); setErrorAction(null); setNotice(null); try { await withSettingsRequest(action); } catch (e) { setErrorAction(errorMessage(e)); } finally { setBusy(false); } };
  return <Page error={error} loading={loading} refresh={refresh}>
    <Label muted>These files define agents, models, providers, permissions, tools, and other server options.</Label>
    <ErrorNotice error={errorAction} />{notice && <Label style={{ color: colors.success }}>{notice}</Label>}
    <Button title="Reload server configuration" busy={busy} onPress={() => void run(async signal => { await client.location.reload({ signal }); await refresh(signal); signal.throwIfAborted(); setNotice('I reloaded the server configuration.'); })} />
    <Button title="Open project configuration" busy={busy} onPress={() => void run(async signal => {
      const path = `${directory.replace(/[\\/]+$/, '')}/opencode.jsonc`;
      try { const source = new TextDecoder().decode(await client.file.read({ location: { directory }, path }, { signal })); signal.throwIfAborted(); setEditing({ path, original: source }); setText(source); }
      catch (e) { if (!isFileNotFoundError(e)) throw e; signal.throwIfAborted(); setEditing({ path, original: null }); setText('{\n  "$schema": "https://opencode.ai/config.json"\n}\n'); }
    })} />
    {data?.entries.map((entry, index) => <Card key={index}><Label style={{ fontFamily: mono, fontSize: 12 }}>{entry.path || 'Runtime configuration'}</Label><Label muted>{entry.type === 'directory' ? 'Configuration directory' : 'Configuration document'}</Label>
      {entry.type === 'document' && <><Disclosure title="Read effective values"><JsonView value={entry.info} /></Disclosure>{entry.path && <Button title="Edit source file" compact busy={busy} onPress={() => void run(async signal => { if (!entry.path) return; const source = new TextDecoder().decode(await client.file.read({ location: { directory }, path: entry.path }, { signal })); signal.throwIfAborted(); setEditing({ path: entry.path, original: source }); setText(source); })} />}</>}
    </Card>)}
    <Disclosure title="Default shell"><Label muted>This sets the shell for commands on your OpenCode server.</Label><Button title="Use system default" busy={busy} onPress={() => void run(async signal => { await client.experimental.config.update({ shell: null }, { signal }); await refresh(signal); signal.throwIfAborted(); setNotice('I set the shell to the system default.'); })} />{data?.shells.map(shell => <Button key={shell.path} title={`${shell.name} · ${shell.path}`} disabled={!shell.acceptable} busy={busy} onPress={() => void run(async signal => { await client.experimental.config.update({ shell: shell.path }, { signal }); await refresh(signal); signal.throwIfAborted(); setNotice(`I selected ${shell.name}.`); })} />)}</Disclosure>
    <Sheet visible={!!editing} title="Edit configuration" onClose={() => { if (busy) return; if (text === editing?.original) setEditing(undefined); else void confirmAction('Discard changes?', 'Your unsaved changes will be lost.').then(ok => { if (ok) setEditing(undefined); }); }}>
      <Label style={{ fontFamily: mono, fontSize: 12 }}>{editing?.path}</Label><ErrorNotice error={errorAction} /><Field label="JSON or JSONC" multiline editable={!busy} value={text} onChangeText={setText} style={{ minHeight: 360, fontFamily: mono, fontSize: 12, lineHeight: 20 }} />
      <Button title="Save and reload" busy={busy} variant="primary" disabled={text === editing?.original} onPress={() => void run(async signal => { if (!editing) return; await saveConfigFile(client, directory, editing.path, editing.original, text, signal); setEditing({ ...editing, original: text }); await client.location.reload({ signal }); await refresh(signal); signal.throwIfAborted(); setEditing(undefined); setNotice('I saved and reloaded the configuration.'); })} />
    </Sheet>
  </Page>;
}

function Skills({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => {
    const [skills, commands] = await Promise.all([client.skill.list({ location: { directory } }, { signal }), client.command.list({ location: { directory } }, { signal })]); return { skills: skills.data, commands: commands.data };
  });
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const skills = data?.skills.filter(item => `${item.name} ${item.description}`.toLowerCase().includes(search)) ?? [];
  const commands = data?.commands.filter(item => item.name.toLowerCase().includes(search)) ?? [];
  return <Page error={error} loading={loading} refresh={refresh}>
    <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}><Field label="Find a skill or command" value={query} onChangeText={setQuery} containerStyle={{ flex: 1 }} />{!!query && <Button title="Clear" accessibilityLabel="Clear skill and command search" compact variant="ghost" onPress={() => setQuery('')} />}</Row>
    <Label muted>Use slash commands and skills from the chat composer.</Label>
    <Label style={styles.sectionLabel}>SKILLS · {skills.length}</Label>{skills.map(item => <Disclosure key={item.id} title={item.name}><Label muted>{item.description}</Label><Label style={{ fontFamily: mono, fontSize: 12 }}>{item.path}</Label><Text selectable style={{ color: colors.text, lineHeight: 21 }}>{item.content}</Text></Disclosure>)}
    <Label style={styles.sectionLabel}>COMMANDS · {commands.length}</Label>{commands.map(item => <Card key={item.name}><Label style={styles.name}>/{item.name}</Label><Label muted>{item.description}</Label></Card>)}
    {data && !loading && !!(data.skills.length || data.commands.length) && !skills.length && !commands.length && <Empty title="No matching skills or commands" detail="Try a skill name, description, or command name." />}
    {data && !data.skills.length && !data.commands.length && <Empty title="No custom skills or commands" />}
  </Page>;
}

function Plugins({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => (await client.plugin.list({ location: { directory } }, { signal })).data);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => { setBusy(true); setErrorAction(null); try { await action(); await refresh(); } catch (e) { setErrorAction(errorMessage(e)); } finally { setBusy(false); } };
  return <Page error={error} loading={loading} refresh={refresh}>
    <Label muted>Edit the plugins list in your configuration to add or disable a plugin.</Label><ErrorNotice error={errorAction} />{notice && <Label style={{ color: colors.success }}>{notice}</Label>}
    <Button title="Check package updates" busy={busy} onPress={() => void run(async () => { const result = await client.plugin.check({ location: { directory } }); setNotice(`${result.data.filter(item => item.source.type === 'package' && item.source.outdated).length} package updates available.`); })} />
    {data?.map((item, index) => <Card key={`${item.id}:${index}`}><Label style={styles.name}>{item.id || (item.source.type === 'package' ? item.source.target : 'Plugin')}</Label><Label muted>{item.source.type} · {item.state.status}</Label>{item.state.status === 'failed' && <Label style={{ color: colors.danger }}>{item.state.error}</Label>}
      {item.source.type === 'package' && <><Label muted>{item.source.target}{item.source.version ? ` · ${item.source.version}` : ''}</Label><Button title={item.source.outdated ? 'Update package' : 'Reinstall latest package'} compact busy={busy} onPress={() => void run(async () => { if (item.source.type === 'package' && await confirmAction('Update plugin?', 'This installs the latest package version on your server.')) await client.plugin.update({ location: { directory }, targets: [item.source.target] }); })} /></>}
      <Label muted>{Object.entries(item.features).filter(([, enabled]) => enabled).map(([feature]) => feature).join(' · ')}</Label>
      {item.features.gui && <Label muted>This plugin includes a desktop web interface. Its tools and commands remain available through the server.</Label>}
    </Card>)}
  </Page>;
}

function Permissions({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => { const location = await client.location.get({ location: { directory } }, { signal }); return client.permission.saved.list({ projectID: location.project.id }, { signal }); });
  const [selected, setSelected] = useState<PermissionSavedInfo>();
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const run = async (task: (signal: AbortSignal) => Promise<void>) => { setBusy(true); setErrorAction(null); try { await withSettingsRequest(async signal => { await task(signal); await refresh(signal); }); } catch (e) { setErrorAction(errorMessage(e)); } finally { setBusy(false); } };
  return <Page error={error} loading={loading} refresh={refresh}>
    <Label muted>These are the approvals that you saved with “Always allow” in this project.</Label><ErrorNotice error={errorAction} />
    {data?.map(item => <Card key={item.id}><Label style={styles.name}>{item.action}</Label><Label style={{ fontFamily: mono }}>{item.resource}</Label><Row><Button title="Edit" compact disabled={busy} onPress={() => { setSelected(item); setAction(item.action); setResource(item.resource); setErrorAction(null); }} /><Button title="Revoke" variant="danger" compact busy={busy} onPress={() => { void confirmAction('Revoke saved approval?', 'OpenCode will ask again when this action requires permission.').then(confirmed => { if (confirmed) void run(async signal => { await client.permission.saved.remove({ id: item.id }, { signal }); }); }); }} /></Row></Card>)}
    {data && !data.length && <Empty title="No saved approvals" detail="OpenCode will ask you before protected actions." />}
    <Sheet visible={!!selected} title="Edit saved approval" onClose={() => { if (!busy) setSelected(undefined); }}><ErrorNotice error={errorAction} /><Field label="Action" value={action} editable={!busy} onChangeText={setAction} /><Field label="Resource pattern" value={resource} editable={!busy} onChangeText={setResource} /><Button title="Save approval" variant="primary" busy={busy} disabled={!action.trim() || !resource.trim()} onPress={() => void run(async signal => { if (!selected) return; await client.permission.saved.update({ id: selected.id, action: action.trim(), resource: resource.trim() }, { signal }); signal.throwIfAborted(); setSelected(undefined); })} /></Sheet>
  </Page>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, flexDirection: 'row', minHeight: 0, backgroundColor: colors.bg },
  sidebar: { width: 220, flexGrow: 0, borderRightWidth: 1, borderRightColor: colors.border },
  index: { padding: 18, paddingBottom: 32, gap: 22 },
  indexHeader: { gap: 5 }, group: { gap: 8 }, groupTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 8 },
  groupPanel: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  sectionRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  sectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, currentSection: { backgroundColor: colors.selected },
  sectionName: { fontFamily: sans, fontSize: 16, fontWeight: '500' }, sectionDescription: { fontSize: 12, lineHeight: 18 }, chevron: { fontSize: 24 },
  detail: { flex: 1, minWidth: 0 }, detailHeader: { minHeight: 64, paddingHorizontal: 12, paddingVertical: 6, flexWrap: 'nowrap', borderBottomWidth: 1, borderBottomColor: colors.border },
  detailTitle: { fontFamily: sans, fontSize: 24, lineHeight: 30, fontWeight: '500', flex: 1, flexShrink: 1 },
  page: { padding: 18, paddingBottom: 44, gap: 14 },
  name: { fontFamily: sans, fontSize: 16, fontWeight: '600' }, sectionLabel: { fontFamily: sans, color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 8 },
});
