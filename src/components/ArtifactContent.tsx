import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { ToolFileContent } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { type ThemeColors, useThemedStyles } from '../lib/theme';
import { useNativePresentation } from '../lib/sheets';
import { Button, ErrorNotice, Label, Row } from './ui';

type Props = { content: ToolFileContent; client: Client; directory?: string };
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']);

function source(uri: string): { kind: 'data' } | { kind: 'file'; path: string } | { kind: 'remote'; url: string } | undefined {
  if (uri.startsWith('data:')) return { kind: 'data' };
  if (/[\u0000-\u0020\u007f]/.test(uri)) return;
  try {
    const url = new URL(uri);
    if (url.username || url.password) return;
    if (url.protocol === 'file:' && (!url.hostname || url.hostname === 'localhost') && url.pathname.startsWith('/') && !url.search && !url.hash) {
      const path = decodeURIComponent(url.pathname);
      if (!/[\u0000-\u001f\u007f]/.test(path)) return { kind: 'file', path };
    }
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname) return { kind: 'remote', url: url.href };
  } catch {}
}

function inlineBytes(uri: string): Uint8Array {
  const comma = uri.indexOf(',');
  if (comma < 0) throw new Error('The attachment data is invalid');
  const header = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  if (/;base64$/i.test(header)) return Uint8Array.from(atob(payload.replace(/\s/g, '')), char => char.charCodeAt(0));
  const bytes: number[] = [];
  for (let index = 0; index < payload.length;) {
    if (payload[index] === '%') {
      const hex = payload.slice(index + 1, index + 3);
      if (!/^[a-f\d]{2}$/i.test(hex)) throw new Error('The attachment data is invalid');
      bytes.push(parseInt(hex, 16)); index += 3;
    } else {
      const character = String.fromCodePoint(payload.codePointAt(index)!);
      bytes.push(...new TextEncoder().encode(character)); index += character.length;
    }
  }
  return new Uint8Array(bytes);
}

function dataUri(bytes: Uint8Array, mime: string) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 16384) binary += String.fromCharCode(...bytes.subarray(index, index + 16384));
  return `data:${mime};base64,${btoa(binary)}`;
}

export function ArtifactContent(props: Props) {
  return <Artifact key={`${props.directory ?? ''}:${props.content.uri}`} {...props} />;
}

function Artifact({ content, client, directory }: Props) {
  const styles = useThemedStyles(createStyles);
  const presentNative = useNativePresentation();
  const target = source(content.uri);
  const mime = content.mime.split(';')[0].trim().toLowerCase();
  const image = imageTypes.has(mime);
  const [preview, setPreview] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const controller = useRef(new AbortController());
  const running = useRef<AbortSignal | undefined>(undefined);
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    running.current = undefined;
    setPreview(undefined); setExpanded(false); setError(undefined); setBusy(false);
    return () => request.abort();
  }, [client]);
  const filename = (content.name || `attachment.${mime.split('/')[1]?.replace(/[^a-z\d]/gi, '') || 'bin'}`).split(/[\\/]/).pop()!.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '_') || 'attachment';

  async function read(signal: AbortSignal) {
    if (!target) throw new Error('This attachment URI is not supported');
    if (target.kind === 'data') return inlineBytes(content.uri);
    if (target.kind === 'file') return client.file.read({ location: directory ? { directory } : undefined, path: target.path }, { signal });
    const response = await fetch(target.url, { signal, credentials: 'omit' });
    if (!response.ok) throw new Error(`The attachment request failed (HTTP ${response.status})`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async function perform(action: 'preview' | 'save') {
    if (running.current) return;
    const signal = controller.current.signal;
    running.current = signal; setBusy(true); setError(undefined);
    let temporary: File | undefined;
    try {
      if (action === 'save' && Platform.OS !== 'web' && !await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device');
      const bytes = await read(signal);
      if (signal.aborted) return;
      if (action === 'preview') {
        setPreview(dataUri(bytes, mime));
      } else if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: mime }));
        const link = document.createElement('a');
        link.href = url; link.download = filename; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        temporary = new File(Paths.cache, `artifact-${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`);
        await temporary.write(bytes);
        const uri = temporary.uri;
        if (!signal.aborted) await presentNative(() => Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: filename }));
      }
    } catch (reason) {
      if (!signal.aborted) setError(errorMessage(reason));
    } finally {
      if (temporary?.exists) { try { await temporary.delete(); } catch {} }
      if (running.current === signal) {
        running.current = undefined;
        if (!signal.aborted) setBusy(false);
      }
    }
  }

  return <View style={styles.container}>
    <Label numberOfLines={2} style={styles.name}>{filename}</Label>
    <Label muted style={styles.mime}>{content.mime}</Label>
    {!target ? <Label muted>This attachment URI is not supported.</Label> : <>
      {preview && <Pressable accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse image preview' : 'Expand image preview'} onPress={() => setExpanded(value => !value)}>
        <Image source={{ uri: preview }} accessibilityLabel={filename} resizeMode="contain" style={[styles.preview, expanded && styles.expanded]} onError={() => { setPreview(undefined); setError(`This image cannot be displayed. Use ${Platform.OS === 'web' ? 'Download' : 'Save or share'} to open the file.`); }} />
      </Pressable>}
      <Row>{image && !preview && <Button title="Show image" compact disabled={busy} onPress={() => { void perform('preview'); }} />}<Button title={Platform.OS === 'web' ? 'Download' : 'Save or share'} compact busy={busy} onPress={() => { void perform('save'); }} /></Row>
    </>}
    <ErrorNotice error={error} />
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.panel, minWidth: 0 },
  name: { fontWeight: '500' },
  mime: { fontSize: 12 },
  preview: { width: '100%', height: 180, backgroundColor: colors.bg, borderRadius: 6 },
  expanded: { height: 420 },
});
