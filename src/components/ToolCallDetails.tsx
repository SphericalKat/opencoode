import React, { memo, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Rect } from 'react-native-svg';
import type { JsonValue, SessionMessageAssistantTool } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { MessageActionsContext } from '../lib/messageActions';
import { type ThemeColors, useTheme, useThemedStyles } from '../lib/theme';
import { ArtifactContent } from './ArtifactContent';
import { Disclosure, ErrorNotice, Label, mono, touchTarget } from './ui';

type Arguments = Record<string, JsonValue>;
type Section = { label?: string; text: string; diff?: boolean };
const textPageSize = 24_000;

function nameOf(name: string): string {
  return name.replace(/^.*[.:]/, '').replace(/[_-]/g, '').toLowerCase();
}

const toolNames: Record<string, string> = {
  shell: 'Shell', bash: 'Shell', read: 'Read', readfile: 'Read', edit: 'Edit', editfile: 'Edit',
  write: 'Write', writefile: 'Write', patch: 'Patch', applypatch: 'Patch', glob: 'Glob',
  grep: 'Grep', webfetch: 'Web fetch', fetch: 'Web fetch', websearch: 'Web search',
  ls: 'List', list: 'List', execute: 'Execute', subagent: 'Agent', task: 'Task',
};

export function toolDisplayName(name: string): string {
  return toolNames[nameOf(name)] ?? name.replace(/^.*[.:]/, '').replace(/[_-]/g, ' ');
}

function text(input: Arguments | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input?.[key];
    if (typeof value === 'string' && value.length) return value;
  }
}

function optionalString(input: Arguments, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string') return value;
  }
}

export function toolDetail(tool: SessionMessageAssistantTool): string | undefined {
  if (tool.state.status === 'streaming') return;
  return text(tool.state.input, 'description', 'command', 'filePath', 'file_path', 'path', 'pattern', 'url', 'query');
}

function inputSections(name: string, input: Arguments, metadata?: Arguments): Section[] {
  const path = text(input, 'filePath', 'file_path', 'path');
  const file = path ? [{ label: 'File', text: path }] : [];
  switch (toolNames[nameOf(name)]) {
    case 'Shell': return text(input, 'command', 'cmd') ? [{ text: text(input, 'command', 'cmd')! }] : [];
    case 'Read': case 'List': return file;
    case 'Edit': case 'Patch': {
      const diff = text(metadata, 'diff', 'patch') ?? text(input, 'diff', 'patch', 'patchText');
      if (diff) return [...file, { label: 'Diff', text: diff, diff: true }];
      const before = optionalString(input, 'oldText', 'old_text', 'oldString', 'old_string');
      const after = optionalString(input, 'newText', 'new_text', 'newString', 'new_string');
      return [...file, ...(before !== undefined ? [{ label: 'Before', text: before }] : []), ...(after !== undefined ? [{ label: 'After', text: after }] : [])];
    }
    case 'Write': {
      const content = optionalString(input, 'content', 'text');
      return [...file, ...(content !== undefined ? [{ label: 'Content', text: content }] : [])];
    }
    case 'Glob': case 'Grep': {
      const pattern = text(input, 'pattern', 'query');
      return [...(pattern ? [{ label: 'Pattern', text: pattern }] : []), ...(path ? [{ label: 'Directory', text: path }] : [])];
    }
    case 'Web fetch': {
      const url = text(input, 'url');
      const prompt = text(input, 'prompt');
      return [...(url ? [{ label: 'URL', text: url }] : []), ...(prompt ? [{ label: 'Request', text: prompt }] : [])];
    }
    case 'Web search': {
      const query = text(input, 'query');
      return query ? [{ label: 'Search', text: query }] : [];
    }
    case 'Execute': {
      const code = text(input, 'code', 'command');
      return code ? [{ label: 'Code', text: code }] : [];
    }
    case 'Agent': case 'Task': {
      const prompt = text(input, 'prompt', 'task', 'description');
      return prompt ? [{ label: 'Task', text: prompt }] : [];
    }
    default: return [];
  }
}

function CopyAction({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { setCopied(false); setError(undefined); }, [value]);
  return <View style={styles.copyAction}>
    <Pressable accessibilityRole="button" accessibilityLabel={copied ? 'Copied' : label} onPress={event => {
      event.stopPropagation();
      void Clipboard.setStringAsync(value).then(() => { setCopied(true); setError(undefined); }).catch(reason => setError(errorMessage(reason)));
    }} onLongPress={event => event.stopPropagation()} style={({ pressed }) => [styles.copyTarget, pressed && { opacity: 0.6 }]}>
      <Svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>{copied ? <Path d="m3 8 3 3 7-7" stroke={colors.muted} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" /> : <><Rect x={2} y={5} width={9} height={9} rx={1.5} stroke={colors.muted} /><Path d="M5 5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-2" stroke={colors.muted} /></>}</Svg>
    </Pressable>
    {error && <Label accessibilityRole="alert" style={styles.copyError}>{error}</Label>}
  </View>;
}

function CodeSection({ section, output, divided, selectable }: { section: Section; output?: boolean; divided?: boolean; selectable: boolean }) {
  const styles = useThemedStyles(createStyles);
  const actions = useContext(MessageActionsContext);
  const [limit, setLimit] = useState(textPageSize);
  const shown = section.text.slice(0, limit);
  const lines = useMemo(() => section.diff ? shown.split('\n') : undefined, [section.diff, shown]);
  return <View style={[output && styles.output, divided && styles.divider]}>
    {section.label ? <View style={styles.sectionHeader}><Label muted style={styles.sectionLabel}>{section.label}</Label><CopyAction value={section.text} label={output ? 'Copy output' : `Copy ${section.label.toLowerCase()}`} /></View> : null}
    <View style={styles.codeRow}>
      <ScrollView nestedScrollEnabled style={styles.viewport} contentContainerStyle={styles.codeContent} keyboardShouldPersistTaps="handled">
        <Text selectable={selectable} onLongPress={!selectable && Platform.OS !== 'web' ? actions : undefined} style={styles.code}>{lines ? lines.map((line, index) => <Text key={index} style={line.startsWith('+') && !line.startsWith('+++') ? styles.added : line.startsWith('-') && !line.startsWith('---') ? styles.removed : undefined}>{line}{index < lines.length - 1 ? '\n' : ''}</Text>) : shown}</Text>
        {section.text.length > limit && <Pressable accessibilityRole="button" accessibilityLabel="Show more text" onPress={event => { event.stopPropagation(); setLimit(current => current + textPageSize); }} style={styles.more}><Label muted>Show more text ({(section.text.length - limit).toLocaleString()} characters left)</Label></Pressable>}
      </ScrollView>
      {!section.label && <CopyAction value={section.text} label="Copy command" />}
    </View>
  </View>;
}

export const ToolCallDetails = memo(function ToolCallDetails({ tool, client, directory, selectable }: {
  tool: SessionMessageAssistantTool; client?: Client; directory: string; selectable: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const state = tool.state;
  const input = state.status === 'streaming' ? undefined : state.input;
  const metadata = 'metadata' in state ? state.metadata : undefined;
  const sections = useMemo(() => input ? inputSections(tool.name, input, metadata) : [], [tool.name, input, metadata]);
  const argumentsText = useMemo(() => state.status === 'streaming' ? state.input : JSON.stringify(state.input, null, 2), [state.input, state.status]);
  const content = 'content' in state ? state.content ?? [] : [];
  const outputs = content.filter(item => item.type === 'text').map(item => item.text);
  if (state.status === 'running' && typeof state.metadata.output === 'string') outputs.push(state.metadata.output);
  const output = outputs.join('\n\n');
  const files = content.filter(item => item.type === 'file');
  const fallback = !!input && !sections.length;
  return <View style={styles.body}>
    <View style={styles.panel}>
      {sections.map((section, index) => <CodeSection key={`${tool.id}:${index}`} section={section} divided={index > 0} selectable={selectable} />)}
      {fallback && <CodeSection section={{ label: 'Arguments', text: argumentsText }} selectable={selectable} />}
      {state.status === 'streaming' && <Label muted style={styles.pending}>Receiving tool arguments</Label>}
      {!!output && <CodeSection section={{ label: 'Output', text: output }} output divided={sections.length > 0 || fallback} selectable={selectable} />}
      {!output && !files.length && state.status === 'completed' && <Label muted style={[styles.pending, styles.divider]}>No output</Label>}
    </View>
    {files.map((file, index) => <ArtifactContent key={`${file.uri}:${index}`} content={file} client={client} directory={directory} />)}
    {state.status === 'error' && <ErrorNotice error={state.error.message} />}
    {!fallback && <Disclosure disclosureKey={`${tool.id}:arguments`} title="Arguments"><View style={styles.panel}><CodeSection section={{ label: 'Arguments', text: argumentsText }} selectable={selectable} /></View></Disclosure>}
  </View>;
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  body: { gap: 10, minWidth: 0 },
  panel: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.panel },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  output: { backgroundColor: colors.bg },
  sectionHeader: { minHeight: touchTarget, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 11, lineHeight: 16 },
  codeRow: { flexDirection: 'row', alignItems: 'flex-start' },
  viewport: { maxHeight: 200, flex: 1 },
  codeContent: { padding: 12, paddingTop: 8, gap: 8 },
  code: { fontFamily: mono, fontSize: 12, lineHeight: 19, color: colors.text },
  copyAction: { flexShrink: 0, maxWidth: 160 },
  copyTarget: { width: touchTarget, minHeight: touchTarget, justifyContent: 'center', alignItems: 'center' },
  copyError: { fontSize: 11, lineHeight: 16, color: colors.danger, padding: 8 },
  more: { minHeight: touchTarget, justifyContent: 'center' },
  pending: { fontSize: 12, lineHeight: 18, padding: 12 },
  added: { color: colors.success, backgroundColor: colors.successBackground },
  removed: { color: colors.danger, backgroundColor: colors.dangerBackground },
});
