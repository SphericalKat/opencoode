import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import type { FileSystemEntry, Project } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { fileName } from '../lib/workspace';
import { type ThemeColors, useTheme, useThemedStyles } from '../lib/theme';
import { Button, Busy, Empty, ErrorNotice, Field, Label, mono, Row, confirmAction, touchTarget } from './ui';
import { NavIcon } from './Icons';

type Props = {
  client: Client;
  directory: string;
  value: string;
  projects: Project[];
  busy: boolean;
  error: string | null;
  onChangeValue: (value: string) => void;
  onOpenDirectory: (directory: string) => void;
};

function absolutePath(value: string) {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\');
}

function normalizePath(value: string) {
  const path = value.replace(/\\/g, '/');
  const network = path.startsWith('//') && !path.startsWith('///') ? path.split('/').filter(Boolean).slice(0, 2) : [];
  const unc = network.length === 2 && network.every(part => part !== '.' && part !== '..') ? network : null;
  const root = unc ? `//${unc.join('/')}` : /^[A-Za-z]:\//.test(path) ? path.slice(0, 3) : '/';
  const parts: string[] = [];
  for (const part of path.slice(root.length).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return root + (parts.length ? `${root.endsWith('/') ? '' : '/'}${parts.join('/')}` : '');
}

function entryPath(base: string, entry: FileSystemEntry) {
  return normalizePath(absolutePath(entry.path) ? entry.path : `${base}/${entry.path}`);
}

export function ProjectDirectoryBrowser({ client, directory, value, projects, busy, error, onChangeValue, onOpenDirectory }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [path, setPath] = useState(() => normalizePath(directory));
  const [base, setBase] = useState(directory);
  const [folders, setFolders] = useState<FileSystemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [recent, setRecent] = useState(false);
  const [revision, setRevision] = useState(0);
  const [initializing, setInitializing] = useState(false);
  const mounted = useRef(true);
  const action = useRef<AbortController | null>(null);
  const parent = normalizePath(`${path}/..`);
  const pending = busy || initializing;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; action.current?.abort(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setBrowseError(null); setActionError(null); setNotice(null);
    void client.file.list({ location: { directory }, path }, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      setBase(result.location.directory);
      setFolders(result.data.filter(entry => entry.type === 'directory').sort((a, b) => fileName(a.path).localeCompare(fileName(b.path))));
    }).catch(cause => {
      if (!controller.signal.aborted) { setFolders([]); setBrowseError(errorMessage(cause)); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client, directory, path, revision]);

  function browse(next: string) {
    Keyboard.dismiss();
    if (!absolutePath(next.trim())) { setBrowseError('Enter an absolute folder path on the server'); return; }
    const normalized = normalizePath(next.trim());
    onChangeValue(normalized);
    setRecent(false); setManual(false);
    if (normalized === path) setRevision(current => current + 1);
    else setPath(normalized);
  }

  async function initializeGit() {
    if (pending || action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setInitializing(true); setActionError(null); setNotice(null);
    try {
      const location = await client.location.get({ location: { directory: path } }, { signal: controller.signal });
      const vcs = await client.vcs.get({ location: { directory: location.directory } }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (vcs.data.provider) { setNotice(`This folder already belongs to a ${vcs.data.provider} repository.`); return; }
      const confirmed = await confirmAction('Initialize Git?', `Create a Git repository in ${location.project.directory}?`, { confirmLabel: 'Initialize Git', destructive: false });
      if (!confirmed || controller.signal.aborted) return;
      await client.vcs.init({ location: { directory: location.directory }, provider: 'git' }, { signal: controller.signal });
      if (!controller.signal.aborted) setNotice(`Git initialized in ${location.project.directory}`);
    } catch (cause) {
      if (!controller.signal.aborted) setActionError(errorMessage(cause));
    } finally {
      if (mounted.current) setInitializing(false);
      if (action.current === controller) action.current = null;
    }
  }

  return <View style={styles.container}>
    <View style={styles.header}>
      <Label selectable numberOfLines={1} ellipsizeMode="middle" accessibilityLabel={`Current folder: ${path}`} style={styles.path}>{path}</Label>
      <Row style={{ flexWrap: 'nowrap' }}>
        {recent ? <Button title="‹ Folders" compact variant="ghost" disabled={pending} onPress={() => setRecent(false)} /> : <Button title="↑ Parent" compact variant="ghost" disabled={parent === path || pending} onPress={() => browse(parent)} />}
        <Button title={manual ? 'Hide path' : 'Enter a path'} compact variant="ghost" disabled={pending} onPress={() => setManual(open => !open)} />
        {!recent && <Button title="Recent" compact variant="ghost" disabled={pending} onPress={() => setRecent(true)} />}
      </Row>
      {manual && <View style={{ gap: 8 }}><Field label="Directory on the server" value={value} editable={!pending} onChangeText={onChangeValue} returnKeyType="go" onSubmitEditing={() => browse(value)} /><Button title="Browse this path" compact onPress={() => browse(value)} disabled={!value.trim() || pending} /></View>}
      <ErrorNotice error={error || browseError || actionError} onRetry={!pending ? () => setRevision(current => current + 1) : undefined} />
      {notice && <Label accessibilityLiveRegion="polite" style={{ color: colors.success }}>{notice}</Label>}
      {recent && <Label muted>Recent projects</Label>}
    </View>
    {recent ? <FlatList style={{ flex: 1, minHeight: 0 }} data={projects} keyExtractor={project => project.id} contentContainerStyle={styles.list} ListEmptyComponent={busy ? <Busy /> : <Empty title="No recent projects" detail="Browse to a folder on the server." />} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open project ${item.name || fileName(item.canonical)}`} disabled={pending} onPress={() => { Keyboard.dismiss(); onChangeValue(item.canonical); onOpenDirectory(item.canonical); }} style={({ pressed }) => [styles.folder, pressed && { backgroundColor: colors.raised }]}><NavIcon name="workspace" color={colors.muted} size={18} /><View style={{ flex: 1, minWidth: 0 }}><Label numberOfLines={2}>{item.name || fileName(item.canonical)}</Label><Label muted numberOfLines={1} ellipsizeMode="middle" style={styles.detail}>{item.canonical}</Label></View><Label muted>›</Label></Pressable>} />
      : loading ? <View style={{ flex: 1 }}><Busy /></View> : <FlatList style={{ flex: 1, minHeight: 0 }} data={folders} keyExtractor={folder => folder.path} contentContainerStyle={styles.list} ListEmptyComponent={<Empty title={browseError ? 'Folder unavailable' : 'No folders inside'} detail={browseError ? 'Enter another path or return to the parent folder.' : 'You can open the current folder.'} />} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Browse folder ${fileName(item.path)}`} accessibilityHint={entryPath(base, item)} disabled={pending} onPress={() => browse(entryPath(base, item))} style={({ pressed }) => [styles.folder, pressed && { backgroundColor: colors.raised }]}><NavIcon name="workspace" color={colors.muted} size={18} /><Label numberOfLines={2} style={{ flex: 1, minWidth: 0 }}>{fileName(item.path)}</Label><Label muted>›</Label></Pressable>} />}
    <View style={styles.footer}><View style={{ flex: 1 }}><Button title="Open folder" accessibilityLabel={`Open folder ${path}`} variant="primary" busy={busy} disabled={initializing || loading || !!browseError} onPress={() => { Keyboard.dismiss(); onOpenDirectory(path); }} /></View><Button title="Initialize Git" variant="ghost" busy={initializing} disabled={busy || loading || !!browseError} onPress={() => { void initializeGit(); }} /></View>
  </View>;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, minHeight: 0 }, header: { padding: 16, paddingBottom: 8, gap: 10 }, path: { color: colors.muted, fontFamily: mono, fontSize: 12 },
    list: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 16 }, folder: { minHeight: touchTarget + 8, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border }, detail: { fontSize: 11, fontFamily: mono },
    footer: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 8, padding: 16, borderTopWidth: 1, borderColor: colors.border },
  });
}
