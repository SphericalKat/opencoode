import React, { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { FileDiffInfo, FileSystemEntry, LocationPublicInfo, VcsFileStatus, VcsInfo, WorktreeDirectory } from '@opencode/client';
import { type Client, type Connection, errorMessage } from '../lib/client';
import { decodeEditableFile, fileName, parentPath, saveEditableFile, serverFilePath } from '../lib/workspace';
import { Busy, Button, Card, confirmAction, Empty, ErrorNotice, Field, Label, mono, Row, Sheet } from '../components/ui';
import { TerminalPanel } from '../components/TerminalPanel';
import { type ThemeColors, useTheme, useThemedStyles } from '../lib/theme';
import { useUnsavedChanges } from '../lib/unsaved';

type Props = {
  client: Client;
  connection: Connection;
  directory: string;
  onDirectoryChange: (directory: string) => void;
  onAttachFile?: (path: string, contextText?: string) => void | Promise<boolean | void>;
  visible?: boolean;
  sessionID?: string;
};

export function WorkspaceScreen(props: Props) {
  return <Workspace key={`${props.connection.id}:${props.directory}`} {...props} />;
}

function Workspace({ client, connection, directory, onDirectoryChange, onAttachFile, visible = true, sessionID }: Props) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [tab, setTab] = useState<'Files' | 'Changes' | 'Worktrees' | 'Terminal'>('Files');
  return <View style={styles.screen}>
    <View style={styles.header}><Label accessibilityRole="header" style={styles.title}>Workspace</Label></View>
    <View accessibilityRole="tablist" accessibilityLabel="Workspace sections" style={styles.tabs}>
      {(['Files', 'Changes', 'Worktrees', 'Terminal'] as const).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityLabel={item} accessibilityState={{ selected: tab === item }} aria-selected={tab === item} style={({ pressed }) => [styles.workspaceTab, tab === item && styles.selectedTab, pressed && { opacity: 0.65 }]} onPress={() => setTab(item)}><Label style={{ textAlign: 'center', fontSize: 13, color: tab === item ? colors.text : colors.muted }}>{item}</Label></Pressable>)}
    </View>
    <View style={[styles.screen, tab !== 'Files' && { display: 'none' }]}><Files client={client} directory={directory} onAttachFile={onAttachFile} /></View>
    {tab === 'Changes' && <Changes client={client} directory={directory} onAttachFile={onAttachFile} />}
    {tab === 'Worktrees' && <Worktrees client={client} directory={directory} onDirectoryChange={onDirectoryChange} />}
    {visible && tab === 'Terminal' && <TerminalPanel client={client} connection={connection} directory={directory} sessionID={sessionID} />}
  </View>;
}

type OpenFile = { path: string; bytes: Uint8Array | null; original: Uint8Array | null; text: string; initialText: string; mime?: string; preview?: string; notice?: string; error?: string };

function imageMime(bytes: Uint8Array): string | undefined {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) return 'image/gif';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
}

function fileMime(path: string, bytes: Uint8Array): string {
  const image = imageMime(bytes);
  if (image) return image;
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return 'application/pdf';
  const extension = path.split('.').pop()?.toLowerCase();
  return ({ json: 'application/json', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', mp3: 'audio/mpeg', wav: 'audio/wav', mp4: 'video/mp4', mov: 'video/quicktime', zip: 'application/zip' } as Record<string, string>)[extension || ''] || 'application/octet-stream';
}

function base64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  for (let index = 0; index < bytes.length; index += 0x8000) chunks.push(String.fromCharCode(...bytes.subarray(index, index + 0x8000)));
  return btoa(chunks.join(''));
}

function quotedText(text: string, language = ''): string {
  let longest = 2;
  for (const match of text.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  const fence = '`'.repeat(longest + 1);
  return `${fence}${language}\n${text}\n${fence}`;
}

function Files({ client, directory, onAttachFile }: Pick<Props, 'client' | 'directory' | 'onAttachFile'>) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [path, setPath] = useState('');
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [file, setFile] = useState<OpenFile | null>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fileActionsOpen, setFileActionsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [sharing, setSharing] = useState(false);
  const location = { directory };
  const searching = query.trim().length > 0;
  useUnsavedChanges(`workspace-editor:${directory}`, 'File editor', !!file && (file.text !== file.initialText || (fileBusy && !!file.original)));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = setTimeout(async () => {
      try {
        const result = query.trim()
          ? await client.file.find({ location: { directory }, query: query.trim(), limit: 200 }, { signal: controller.signal })
          : await client.file.list({ location: { directory }, path }, { signal: controller.signal });
        if (!controller.signal.aborted) setEntries([...result.data].sort((a, b) => a.type === b.type ? a.path.localeCompare(b.path) : a.type === 'directory' ? -1 : 1));
      } catch (failure) {
        if (!controller.signal.aborted) { setEntries([]); setError(errorMessage(failure)); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query.trim() ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [client, directory, path, query, revision]);

  async function openFile(nextPath: string) {
    setFile({ path: nextPath, bytes: null, original: null, text: '', initialText: '' });
    setFileBusy(true);
    setSaveError(null);
    setSaved(false);
    setFileActionsOpen(false);
    setCopied(false);
    setSelection({ start: 0, end: 0 });
    try {
      const bytes = await client.file.read({ location, path: nextPath });
      const mime = fileMime(nextPath, bytes);
      if (imageMime(bytes)) {
        const preview = bytes.length <= 8 * 1024 * 1024 ? `data:${mime};base64,${base64(bytes)}` : undefined;
        setFile(current => current?.path === nextPath ? { path: nextPath, bytes, original: null, text: '', initialText: '', mime, preview } : current);
      } else {
        try {
          const text = decodeEditableFile(bytes);
          setFile(current => current?.path === nextPath ? { path: nextPath, bytes, original: bytes, text, initialText: text, mime } : current);
        } catch (failure) {
          setFile(current => current?.path === nextPath ? { path: nextPath, bytes, original: null, text: '', initialText: '', mime, notice: errorMessage(failure) } : current);
        }
      }
    } catch (failure) {
      setFile(current => current?.path === nextPath ? { ...current, error: errorMessage(failure) } : current);
    } finally {
      setFileBusy(false);
    }
  }

  async function closeFile() {
    if (fileBusy || sharing) return false;
    if (file && file.text !== file.initialText && !await confirmAction('Discard your edits?', 'Your unsaved edits will be lost.')) return false;
    setFile(null);
    return true;
  }

  async function save() {
    if (!file?.original) return;
    const editing = file;
    setFileBusy(true);
    setSaveError(null);
    try {
      const bytes = await saveEditableFile({
        read: () => client.file.read({ location, path: editing.path }),
        write: payload => client.experimental.file.write({ location, path: editing.path, payload }),
      }, editing.original!, editing.text);
      setFile(current => current?.path === editing.path ? { ...current, bytes, original: bytes, initialText: editing.text } : current);
      setSaved(true);
      setRevision(value => value + 1);
    } catch (failure) { setSaveError(errorMessage(failure)); }
    finally { setFileBusy(false); }
  }

  async function attach(contextText?: string) {
    if (!file || !onAttachFile) return;
    const editing = file;
    if (!await closeFile()) return;
    try {
      if (await onAttachFile(serverFilePath(directory, editing.path), contextText) === false) { setFile(editing); setSaveError('The attachment was not added. Check the connection and retry.'); }
    } catch (failure) { setFile(editing); setSaveError(errorMessage(failure)); }
  }

  async function attachSelection() {
    if (!file || selection.end <= selection.start) return;
    const start = Math.max(0, Math.min(selection.start, file.text.length));
    const end = Math.max(start, Math.min(selection.end, file.text.length));
    if (end <= start) return;
    const firstLine = file.text.slice(0, start).split('\n').length;
    const lastLine = file.text.slice(0, file.text[end - 1] === '\n' ? end - 1 : end).split('\n').length;
    const path = serverFilePath(directory, file.path);
    await attach(`Selected text from ${path}, lines ${firstLine}–${lastLine}${file.text !== file.initialText ? ' (unsaved editor text)' : ''}:\n\n${quotedText(file.text.slice(start, end))}`);
  }

  async function shareFile() {
    if (!file?.bytes) return;
    setSharing(true); setSaveError(null);
    try {
      const bytes = file.original ? new TextEncoder().encode(file.text) : file.bytes;
      const name = fileName(file.path).replace(/[^\p{L}\p{N}._-]/gu, '_') || 'download';
      const mime = file.mime || 'application/octet-stream';
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
        const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device');
        const exported = new File(Paths.cache, `opencoode-${Date.now()}-${name}`);
        try { await exported.write(bytes); await Sharing.shareAsync(exported.uri, { mimeType: mime, dialogTitle: 'Save or share file' }); }
        finally { if (exported.exists) await exported.delete(); }
      }
    } catch (failure) { setSaveError(errorMessage(failure)); }
    finally { setSharing(false); }
  }

  return <View style={styles.screen}>
    <View style={styles.controls}>
      <Field accessibilityLabel="Find workspace files" placeholder="Find a file or folder…" value={query} onChangeText={setQuery} />
      <Row style={{ flexWrap: 'nowrap' }}><Button title="↑ Parent" compact disabled={!path || searching} onPress={() => setPath(parentPath(path))} /><Label muted numberOfLines={1} ellipsizeMode="middle" style={{ flex: 1, minWidth: 0, fontFamily: mono, fontSize: 12 }}>{searching ? 'Search · up to 200' : path || '/'}</Label><Button title="Refresh" compact variant="ghost" onPress={() => setRevision(value => value + 1)} /></Row>
      <ErrorNotice error={error} onRetry={() => setRevision(value => value + 1)} />
    </View>
    {loading ? <Busy /> : <FlatList data={entries} keyExtractor={entry => entry.path} contentContainerStyle={styles.list} ListEmptyComponent={<Empty title={error ? 'Files unavailable' : searching ? 'No matches' : 'No files'} detail={error ? 'Retry the request or check your server connection.' : searching ? 'Try a different file name.' : 'This folder is empty.'} />}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.type === 'directory' ? 'Open folder' : 'Open file'} ${item.path}`} style={({ pressed }) => [styles.fileRow, pressed && { backgroundColor: colors.raised }]} onPress={() => { if (item.type === 'directory') { setPath(item.path); setQuery(''); } else void openFile(item.path); }}>
        <Text style={styles.fileIcon}>{item.type === 'directory' ? '▱' : '≡'}</Text>
        <View style={{ flex: 1, minWidth: 0 }}><Label numberOfLines={2}>{fileName(item.path)}</Label>{searching && <Label muted numberOfLines={2} ellipsizeMode="middle" style={{ fontSize: 11 }}>{item.path}</Label>}</View><Label muted>{item.type === 'directory' ? '›' : ''}</Label>
      </Pressable>} />}
    <Sheet visible={!!file} title="File" scroll={false} onClose={() => { void closeFile(); }}>
      {file && <View style={styles.editor}>
        <Label selectable muted numberOfLines={2} ellipsizeMode="middle" style={{ fontFamily: mono, fontSize: 11 }}>{file.path}</Label>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          {file.original && <Button title={saved && file.text === file.initialText ? 'Saved' : 'Save file'} compact variant="primary" disabled={file.text === file.initialText || sharing} busy={fileBusy} onPress={() => { void save(); }} />}
          {file.bytes && !file.original && onAttachFile && <Button title="Attach to prompt" compact variant="primary" disabled={fileBusy || sharing} onPress={() => { void attach(); }} />}
          <Button title={fileActionsOpen ? 'Hide actions' : 'More actions'} compact variant="ghost" disabled={fileBusy || sharing} onPress={() => setFileActionsOpen(open => !open)} />
        </Row>
        {fileActionsOpen && <><Row>{onAttachFile && <Button title="Attach to prompt" compact disabled={fileBusy || sharing} onPress={() => { void attach(); }} />}
          {onAttachFile && file.original && <Button title="Attach selection" compact disabled={fileBusy || sharing || selection.end <= selection.start} onPress={() => { void attachSelection(); }} />}
          <Button title="Reload" compact disabled={fileBusy || sharing} onPress={() => { if (file.text === file.initialText) void openFile(file.path); else void confirmAction('Reload the file?', 'Your unsaved edits will be lost.').then(yes => { if (yes) void openFile(file.path); }); }} />
          {file.original && <Button title={copied ? 'Copied' : 'Copy text'} compact onPress={() => { void Clipboard.setStringAsync(file.text).then(() => setCopied(true)).catch(failure => setSaveError(errorMessage(failure))); }} />}
          {file.bytes && <Button title={Platform.OS === 'web' ? 'Download file' : 'Save or share'} compact busy={sharing} disabled={fileBusy} onPress={() => { void shareFile(); }} />}
        </Row>{file.original && selection.end > selection.start && <Label muted style={{ fontSize: 11 }}>Selected text: {selection.end - selection.start} characters</Label>}</>}
        <ErrorNotice error={file.error || saveError} />
        {fileBusy && !file.bytes ? <Busy /> : file.preview ? <View style={styles.mediaPreview}><Image accessibilityLabel={fileName(file.path)} source={{ uri: file.preview }} resizeMode="contain" style={{ width: '100%', height: '100%' }} onError={() => setFile(current => current?.path === file.path ? { ...current, preview: undefined, notice: 'This device cannot display this image. Save or share the file to open it in another app.' } : current)} /></View> : file.original ? <Field accessibilityLabel={`Edit ${file.path}`} multiline scrollEnabled value={file.text} onSelectionChange={event => setSelection(event.nativeEvent.selection)} onChangeText={text => { setFile(current => current && { ...current, text }); setSaved(false); setCopied(false); setSelection({ start: 0, end: 0 }); }} editable={!fileBusy && !sharing} containerStyle={{ flex: 1, minHeight: 0 }} style={{ flex: 1, fontFamily: mono, fontSize: 13, lineHeight: 20, minHeight: 0 }} /> : file.bytes && <View style={styles.mediaPreview}><Label>{file.mime} · {(file.bytes.length / 1024).toFixed(1)} KiB</Label><Label muted>{file.notice || (imageMime(file.bytes) ? 'This image exceeds the 8 MiB preview limit.' : 'Save or share this file to open it in a compatible app.')}</Label><Button title={Platform.OS === 'web' ? 'Download file' : 'Save or share'} busy={sharing} onPress={() => { void shareFile(); }} /></View>}
        {file.original && <Label muted style={{ fontSize: 11 }}>If the server file changes, copy your edits before you reload the file.</Label>}
      </View>}
    </Sheet>
  </View>;
}

function Changes({ client, directory, onAttachFile }: Pick<Props, 'client' | 'directory' | 'onAttachFile'>) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [info, setInfo] = useState<VcsInfo | null>(null);
  const [files, setFiles] = useState<VcsFileStatus[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [mode, setMode] = useState<'working' | 'branch' | 'committed'>('working');
  const [base, setBase] = useState('');
  const [diff, setDiff] = useState<FileDiffInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [branchesVisible, setBranchesVisible] = useState(false);
  const [revision, setRevision] = useState(0);
  const [review, setReview] = useState<FileDiffInfo | null>(null);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewComment, setReviewComment] = useState('');
  const [addingReview, setAddingReview] = useState(false);
  useUnsavedChanges(`workspace-review:${directory}`, 'Review comment', !!review && !!reviewComment.trim() && !addingReview);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    void Promise.allSettled([
      client.vcs.get({ location: { directory } }, { signal: controller.signal }),
      client.vcs.status({ location: { directory } }, { signal: controller.signal }),
    ]).then(([vcs, status]) => {
      if (controller.signal.aborted) return;
      if (vcs.status === 'fulfilled') setInfo(vcs.value.data);
      if (status.status === 'fulfilled') setFiles(status.value.data);
      const failures = [vcs, status].filter(result => result.status === 'rejected');
      if (failures.length) setError(failures.map(result => errorMessage(result.reason)).join('\n'));
    })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client, directory, revision]);
  async function loadDiff(file?: string) {
    setBusy(true); setError(null);
    try {
      const result = await client.vcs.diff({ location: { directory }, mode, base: base.trim() || undefined, untracked: 'files' });
      setDiff(file ? result.data.filter(item => item.file === file) : result.data);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function loadBranches() {
    setBusy(true); setError(null);
    try { const result = await client.vcs.branch.list({ location: { directory }, limit: 200 }); setBranches(result.data); setBranchesVisible(true); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function closeDiff() {
    if (addingReview) return;
    if (reviewComment.trim() && !await confirmAction('Discard review comment?', 'Your comment has not been added to a prompt.')) return;
    setReview(null); setReviewVisible(false); setReviewComment(''); setDiff(null);
  }
  async function openReview(file: FileDiffInfo) {
    if (review?.file !== file.file) {
      if (reviewComment.trim() && !await confirmAction('Discard review comment?', 'Your comment has not been added to a prompt.')) return;
      setReviewComment('');
    }
    setReview(file); setReviewVisible(true); setError(null);
  }
  async function addReview() {
    if (!review || !onAttachFile || !reviewComment.trim()) return;
    setAddingReview(true); setError(null);
    try {
      const context = `Review feedback for ${serverFilePath(directory, review.file)}:\n\n${reviewComment.trim()}\n\n${quotedText(review.patch, 'diff')}${review.more ? '\n\nThe server truncated this diff.' : ''}`;
      if (await onAttachFile(serverFilePath(directory, review.file), context) !== false) { setReview(null); setReviewVisible(false); setReviewComment(''); setDiff(null); }
      else setError('The review was not added. Check the connection and retry.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setAddingReview(false); }
  }
  return <View style={styles.screen}>
    <View style={styles.controls}>
      <Row style={{ flexWrap: 'nowrap' }}><Label numberOfLines={1} ellipsizeMode="middle" style={{ flex: 1, minWidth: 0, fontFamily: mono }}>⑂ {info?.branch.current || 'No branch'}</Label><Button title="Branches" compact variant="ghost" onPress={() => { void loadBranches(); }} busy={busy} /><Button title="Refresh" compact variant="ghost" onPress={() => setRevision(value => value + 1)} /></Row>
      <Row>{(['working', 'branch', 'committed'] as const).map(value => <Button key={value} title={{ working: 'Working tree', branch: 'Branch', committed: 'Committed' }[value]} compact variant={mode === value ? 'primary' : 'secondary'} onPress={() => setMode(value)} />)}</Row>
      {mode !== 'working' && <Field label="Base branch or commit (optional)" placeholder="Server default" value={base} onChangeText={setBase} />}
      <Button title="View diff" onPress={() => { void loadDiff(); }} busy={busy} />
      <ErrorNotice error={error} onRetry={() => setRevision(value => value + 1)} />
    </View>
    {loading ? <Busy /> : <FlatList data={files} keyExtractor={file => file.file} contentContainerStyle={styles.list} ListEmptyComponent={<Empty title={error ? 'Changes unavailable' : 'No changes'} detail={error ? 'Retry the request or check your repository.' : 'Your working tree has no changed files.'} />}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`View diff for ${item.file}`} style={styles.fileRow} onPress={() => { void loadDiff(item.file); }}><View style={{ flex: 1, minWidth: 0 }}><Label numberOfLines={2} ellipsizeMode="middle">{item.file}</Label><Label muted style={{ fontSize: 11 }}>{item.status}</Label></View><Label style={{ color: colors.success }}>+{item.additions}</Label><Label style={{ color: colors.danger }}>−{item.deletions}</Label></Pressable>} />}
    <Sheet visible={diff !== null} title={reviewVisible ? 'Review comment' : 'Changes'} onClose={() => { void closeDiff(); }}>{reviewVisible && review ? <><Label selectable style={{ fontFamily: mono }}>{review.file}</Label><Field label="Comment for OpenCode" multiline value={reviewComment} onChangeText={setReviewComment} editable={!addingReview} /><ErrorNotice error={error} /><Button title="Add review to prompt" variant="primary" busy={addingReview} disabled={!reviewComment.trim()} onPress={() => { void addReview(); }} /><Button title="Back to diff" disabled={addingReview} onPress={() => setReviewVisible(false)} /></> : <>{diff?.length === 0 && <Empty title="No diff" detail="The selected comparison has no changes." />}{diff?.map(file => <Card key={file.file}><Label selectable style={{ fontFamily: mono }}>{file.file}</Label><Label muted>+{file.additions}  −{file.deletions} · {file.status}</Label><ScrollView horizontal><Text selectable style={styles.code}>{file.patch}</Text></ScrollView>{file.more && <Label muted>The server truncated this diff.</Label>}{onAttachFile && <Button title={review?.file === file.file && reviewComment.trim() ? 'Continue review comment' : 'Add review comment'} compact onPress={() => { void openReview(file); }} />}</Card>)}</>}</Sheet>
    <Sheet visible={branchesVisible} title="Branches" onClose={() => setBranchesVisible(false)}><Label muted>Select a branch as the comparison base.</Label>{branches.map(branch => <Button key={branch} title={branch} onPress={() => { setBase(branch); setMode('branch'); setBranchesVisible(false); }} />)}</Sheet>
  </View>;
}

function Worktrees({ client, directory, onDirectoryChange }: Pick<Props, 'client' | 'directory' | 'onDirectoryChange'>) {
  const styles = useThemedStyles(createStyles);
  const [location, setLocation] = useState<LocationPublicInfo | null>(null);
  const [trees, setTrees] = useState<WorktreeDirectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [name, setName] = useState('');
  const [branch, setBranch] = useState('');
  const [from, setFrom] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    void client.location.get({ location: { directory } }, { signal: controller.signal }).then(async result => {
      const list = await client.worktree.list({ projectID: result.project.id }, { signal: controller.signal });
      if (!controller.signal.aborted) { setLocation(result); setTrees(list); }
    }).catch(failure => { if (!controller.signal.aborted) setError(errorMessage(failure)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [client, directory, revision]);
  async function create() {
    if (!location) return;
    setBusy(true); setError(null);
    try {
      const tree = await client.worktree.create({ projectID: location.project.id, name: name.trim() || undefined, branch: branch.trim() || undefined, from: from.trim() || undefined });
      setCreateVisible(false); onDirectoryChange(tree.directory);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function remove(tree: WorktreeDirectory) {
    if (!location || tree.directory === location.project.directory || !await confirmAction('Remove this worktree?', `The server will remove ${tree.directory}. Removal stops if the worktree has uncommitted changes.`)) return;
    setBusy(true); setError(null);
    try { await client.worktree.remove({ projectID: location.project.id, directory: tree.directory, force: false }); setRevision(value => value + 1); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={styles.content}>
    <Row><Label muted style={{ flex: 1 }}>Isolated Git workspaces</Label><Button title="Create" compact variant="primary" disabled={!location} onPress={() => setCreateVisible(true)} /><Button title="Refresh" compact onPress={() => setRevision(value => value + 1)} /></Row>
    <ErrorNotice error={error} onRetry={() => setRevision(value => value + 1)} />
    {loading ? <Busy /> : <>
      {location && <Card><Label style={{ fontWeight: '600' }}>Project checkout</Label><Label muted style={{ fontFamily: mono, fontSize: 12 }}>{location.project.directory}</Label><Button title={directory === location.project.directory ? 'Current checkout' : 'Open checkout'} disabled={directory === location.project.directory} onPress={() => onDirectoryChange(location.project.directory)} /></Card>}
      {!error && trees.length === 0 && <Empty title="No worktrees" detail="Create a worktree to keep a separate branch and set of files." />}
      {trees.map(tree => <Card key={tree.directory}><Label style={{ fontWeight: '600' }}>{fileName(tree.directory)}</Label><Label selectable muted style={{ fontFamily: mono, fontSize: 12 }}>{tree.directory}</Label><Row><Button title={tree.directory === directory ? 'Current worktree' : 'Open'} disabled={tree.directory === directory || busy} onPress={() => onDirectoryChange(tree.directory)} /><Button title="Remove" variant="danger" disabled={tree.directory === directory || tree.directory === location?.project.directory} busy={busy} onPress={() => { void remove(tree); }} /></Row></Card>)}
    </>}
    <Sheet visible={createVisible} title="Create worktree" onClose={() => { if (!busy) setCreateVisible(false); }}><ErrorNotice error={error} /><Field label="Name (optional)" value={name} onChangeText={setName} editable={!busy} /><Field label="Branch (optional)" value={branch} onChangeText={setBranch} editable={!busy} /><Field label="Start from branch or commit (optional)" value={from} onChangeText={setFrom} editable={!busy} /><Label muted>The server chooses defaults for blank fields.</Label><Button title="Create and open" variant="primary" busy={busy} onPress={() => { void create(); }} /></Sheet>
  </ScrollView>;
}

function createStyles(colors: ThemeColors) { return StyleSheet.create({
  screen: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, gap: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '500', letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, padding: 4, gap: 2, backgroundColor: colors.raised, borderRadius: 14 },
  workspaceTab: { flex: 1, minWidth: 0, minHeight: Platform.OS === 'android' ? 48 : 44, paddingHorizontal: 4, paddingVertical: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  selectedTab: { backgroundColor: colors.panel },
  controls: { paddingHorizontal: 18, paddingBottom: 10, gap: 8 },
  list: { flexGrow: 1, paddingHorizontal: 18, paddingBottom: 24 },
  content: { padding: 18, gap: 16, paddingBottom: 48 },
  fileRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border },
  fileIcon: { fontFamily: mono, fontSize: 23, color: colors.muted },
  editor: { flex: 1, minHeight: 0, padding: 16, gap: 12 },
  mediaPreview: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center', gap: 12 },
  code: { color: colors.text, fontFamily: mono, fontSize: 12, lineHeight: 19 },
}); }
