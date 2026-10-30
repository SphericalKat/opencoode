import React, { useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import type { GenerateImageResult, ModelInfo, UsageLimitsInfo, UsageLimitsMeter, WebSearchProvider, WebSearchResult } from '@opencode/client';
import { ClientError } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { externalURL } from '../lib/settings';
import { useTheme } from '../lib/theme';
import { Button, Busy, Card, Empty, ErrorNotice, Field, Label, Row, sans } from './ui';

async function openLink(url: string) { await Linking.openURL(externalURL(url)); }

export function AdvancedSettings({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const [tool, setTool] = useState<'Usage' | 'Search' | 'Generate'>('Usage');
  return <View style={{ flex: 1 }}><Row style={{ padding: 18 }}>{(['Usage', 'Search', 'Generate'] as const).map(item => <Button key={item} title={item} compact variant={tool === item ? 'primary' : 'secondary'} onPress={() => setTool(item)} />)}</Row>
    {tool === 'Usage' && <Usage client={client} directory={directory} />}
    {tool === 'Search' && <WebSearch client={client} directory={directory} />}
    {tool === 'Generate' && <Generate client={client} directory={directory} />}
  </View>;
}

function Usage({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const [info, setInfo] = useState<UsageLimitsInfo | null>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; void load(); return () => { active.current = false; }; }, []);
  async function load() {
    setLoading(true); setError(null);
    try { const result = await client.experimental.usage.limits({ location: { directory } }); if (active.current) setInfo(result.data); }
    catch (e) { if (active.current) setError(e instanceof ClientError && e.reason === 'UnsupportedContentType' ? 'Usage limits require OpenCode 2.2.1 or later. Update your server to use this view.' : errorMessage(e)); }
    finally { if (active.current) setLoading(false); }
  }
  return <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
    <Row><Label style={{ fontSize: 18, fontWeight: '600', flex: 1 }}>Server usage</Label><Button title="Refresh" compact busy={loading} onPress={() => void load()} /></Row>
    <ErrorNotice error={error} onRetry={() => void load()} />{loading && !info && <Busy />}
    {info && <><Label muted>{info.workspace.name || info.workspace.id}</Label>
      <Button title="Open usage dashboard" onPress={() => { void openLink(info.workspace.usageURL).catch(e => setError(errorMessage(e))); }} />
      {info.go && <><Meter label="Rolling allowance" meter={info.go.rolling} /><Meter label="Weekly allowance" meter={info.go.weekly} /><Meter label="Monthly allowance" meter={info.go.monthly} /></>}
      {info.budgets.map(budget => <Card key={budget.id}><Label style={{ fontWeight: '600' }}>{budget.vendors.join(', ') || 'Model budget'}</Label><Label>${budget.spent.toFixed(2)} of ${budget.limit.toFixed(2)}</Label><Label muted>Resets {new Date(budget.resetsAt).toLocaleString()}</Label>{budget.models.map(model => <Label key={`${model.providerID}/${model.modelID}`} muted>{model.name}{model.spent !== undefined ? ` · $${model.spent.toFixed(2)}` : ''}</Label>)}</Card>)}
    </>}
    {info === null && <Empty title="No usage information" detail="Your server does not expose usage limits for this account." />}
  </ScrollView>;
}

function Meter({ label, meter }: { label: string; meter: UsageLimitsMeter }) {
  const { colors } = useTheme();
  const percent = Math.min(100, Math.max(0, meter.percent));
  return <Card><Row style={{ justifyContent: 'space-between' }}><Label>{label}</Label><Label style={{ color: meter.limited ? colors.danger : colors.success }}>{Math.round(percent)}% used</Label></Row><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ height: 5, borderRadius: 3, backgroundColor: colors.raised, overflow: 'hidden' }}><View style={{ width: `${percent}%`, height: 5, backgroundColor: meter.limited ? colors.danger : colors.success }} /></View><Label muted>Resets {new Date(meter.resetsAt).toLocaleString()}</Label></Card>;
}

function WebSearch({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const [providers, setProviders] = useState<WebSearchProvider[]>([]);
  const [provider, setProvider] = useState<string>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WebSearchResult[]>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    active.current = true;
    void client.websearch.providers({ location: { directory } }).then(result => { if (active.current) setProviders(result.data); }).catch(e => { if (active.current) setError(errorMessage(e)); });
    return () => { active.current = false; request.current?.abort(); };
  }, [client, directory]);
  async function search() {
    const abort = new AbortController(); request.current?.abort(); request.current = abort;
    setBusy(true); setError(null); setResults(undefined);
    try { const result = await client.websearch.query({ location: { directory }, query: query.trim(), providerID: provider }, { signal: abort.signal }); if (active.current && !abort.signal.aborted) setResults(result.data.results); }
    catch (e) { if (active.current && !abort.signal.aborted) setError(errorMessage(e)); }
    finally { if (active.current && !abort.signal.aborted) setBusy(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, gap: 14 }}>
    <Label style={{ fontSize: 18, fontWeight: '600' }}>Search the web</Label><Label muted>Use the web search providers on your OpenCode server.</Label>
    <Field label="Search query" value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={() => { if (query.trim() && !busy) void search(); }} />
    <Row><Button title="Default provider" compact variant={!provider ? 'primary' : 'secondary'} onPress={() => setProvider(undefined)} />{providers.map(item => <Button key={item.id} title={item.name} compact variant={provider === item.id ? 'primary' : 'secondary'} onPress={() => setProvider(item.id)} />)}</Row>
    <Button title="Search" variant="primary" busy={busy} disabled={!query.trim()} onPress={() => void search()} /><ErrorNotice error={error} />
    {results?.map((result, index) => <Card key={`${result.url}:${index}`}><Label style={{ fontSize: 16, fontWeight: '600' }}>{result.title || result.url}</Label><Label muted>{result.url}</Label>{result.content && <Text selectable style={{ fontFamily: sans, color: colors.text, lineHeight: 22 }}>{result.content}</Text>}<Button title="Open source" compact onPress={() => { void openLink(result.url).catch(e => setError(errorMessage(e))); }} /></Card>)}
    {results && !results.length && <Empty title="No results" detail="Try another query or search provider." />}
  </ScrollView>;
}

function Generate({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const [kind, setKind] = useState<'text' | 'image'>('text');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState<ModelInfo>();
  const [query, setQuery] = useState('');
  const [prompt, setPrompt] = useState('');
  const [text, setText] = useState('');
  const [images, setImages] = useState<GenerateImageResult>();
  const [aspect, setAspect] = useState('1:1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const active = useRef(true);
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => { active.current = true; void client.model.list({ location: { directory }, types: ['chat', 'image'] }).then(result => { if (active.current) setModels(result.data.filter(item => item.enabled)); }).catch(e => { if (active.current) setError(errorMessage(e)); }); return () => { active.current = false; request.current?.abort(); }; }, [client, directory]);
  const available = models.filter(item => kind === 'image' ? item.type === 'image' : !item.type || item.type === 'chat');
  const matches = available.filter(item => `${item.name} ${item.providerID}`.toLowerCase().includes(query.toLowerCase()));
  async function generate() {
    if (kind === 'image' && !model) { setError('Select an image model'); return; }
    const abort = new AbortController(); request.current?.abort(); request.current = abort;
    setBusy(true); setError(null); setText(''); setImages(undefined);
    try {
      const ref = model ? { id: model.id, providerID: model.providerID } : undefined;
      if (kind === 'image' && ref) {
        if (!/^\d+:\d+$/.test(aspect) || aspect.split(':').some(part => Number(part) <= 0)) throw new Error('Enter an aspect ratio such as 1:1 or 16:9');
        const result = await client.experimental.generate.image({ model: ref, prompt, aspect: aspect as `${number}:${number}`, n: 1 }, { signal: abort.signal });
        if (active.current && !abort.signal.aborted) setImages(result);
      } else {
        const result = await client.experimental.generate.text({ model: ref, prompt }, { signal: abort.signal });
        if (active.current && !abort.signal.aborted) setText(result.text);
      }
    } catch (e) { if (active.current && !abort.signal.aborted) setError(e instanceof ClientError && e.reason === 'UnsupportedContentType' ? 'Standalone generation requires OpenCode 2.2.1 or later. Update your server to use this feature.' : errorMessage(e)); }
    finally { if (active.current && !abort.signal.aborted) setBusy(false); }
  }
  async function shareImage(image: GenerateImageResult['images'][number]) {
    setSharing(true); setError(null);
    try {
      const extension = image.mime === 'image/jpeg' ? 'jpg' : image.mime === 'image/webp' ? 'webp' : 'png';
      const filename = `opencoode-${Date.now()}.${extension}`;
      if (Platform.OS === 'web') {
        const link = document.createElement('a'); link.href = `data:${image.mime};base64,${image.data}`; link.download = filename; link.click();
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device');
        const file = new File(Paths.cache, filename);
        try { await file.write(image.data, { encoding: 'base64' }); await Sharing.shareAsync(file.uri, { mimeType: image.mime, dialogTitle: 'Save or share image' }); }
        finally { if (file.exists) await file.delete(); }
      }
    } catch (e) { setError(errorMessage(e)); }
    finally { setSharing(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, gap: 14 }}>
    <Label style={{ fontSize: 18, fontWeight: '600' }}>Generate</Label><Label muted>Create a standalone result through your server. Requests use your connected provider and can incur charges.</Label><Label muted>Standalone generation uses the server global configuration. Project-only model settings do not apply.</Label>
    <Row><Button title="Text" compact variant={kind === 'text' ? 'primary' : 'secondary'} disabled={busy} onPress={() => { setKind('text'); setModel(undefined); }} /><Button title="Image" compact variant={kind === 'image' ? 'primary' : 'secondary'} disabled={busy} onPress={() => { setKind('image'); setModel(undefined); }} /></Row>
    <Field label="Find a model" value={query} onChangeText={setQuery} /><Label muted>{model ? `${model.name} · ${model.providerID}` : kind === 'text' ? 'Server default model' : 'Choose an available image model'}</Label>
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{kind === 'text' && <Button title="Server default" compact variant={!model ? 'primary' : 'secondary'} onPress={() => setModel(undefined)} />}{matches.slice(0, 30).map(item => <Button key={`${item.providerID}/${item.id}`} title={`${item.name} · ${item.providerID}`} compact variant={model === item ? 'primary' : 'secondary'} onPress={() => setModel(item)} />)}</ScrollView>
    {kind === 'image' && !available.length && <Label muted>No image models are connected. Add one through Accounts or your server configuration.</Label>}
    <Field label="Prompt" multiline value={prompt} onChangeText={setPrompt} placeholder={kind === 'image' ? 'Describe the image' : 'Describe what you need'} />
    {kind === 'image' && <Field label="Aspect ratio" value={aspect} onChangeText={setAspect} placeholder="1:1" />}
    <Button title={kind === 'image' ? 'Generate image' : 'Generate text'} variant="primary" busy={busy} disabled={!prompt.trim() || (kind === 'image' && !model)} onPress={() => void generate()} />
    {busy && <Button title="Stop waiting" compact onPress={() => { request.current?.abort(); setBusy(false); }} />}
    <ErrorNotice error={error} />
    {!!text && <Card><Text selectable style={{ fontFamily: sans, color: colors.text, lineHeight: 23 }}>{text}</Text><Button title="Copy text" compact onPress={() => { void Clipboard.setStringAsync(text).catch(e => setError(errorMessage(e))); }} /></Card>}
    {images?.images.map((image, index) => <Card key={index}><Image accessibilityLabel={prompt} source={{ uri: `data:${image.mime};base64,${image.data}` }} resizeMode="contain" style={{ width: '100%', aspectRatio: 1, borderRadius: 6 }} /><Button title={Platform.OS === 'web' ? 'Save image' : 'Save or share image'} busy={sharing} onPress={() => void shareImage(image)} /></Card>)}
    {images?.cost !== undefined && <Label muted>Cost: ${images.cost.toFixed(4)}</Label>}
  </ScrollView>;
}
