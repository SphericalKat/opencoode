import React, { createContext, memo, useContext, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import MarkdownIt, { type Token } from 'markdown-it';
import { Button, mono, sans } from './ui';
import { type ThemeColors, useThemedStyles } from '../lib/theme';

const parser = new MarkdownIt({ html: false, linkify: true, breaks: true, maxNesting: 40 });
const SelectionContext = createContext(true);

type Node = { token: Token; children: Node[] };

function sameNode(left: Node, right: Node): boolean {
  if (left === right) return true;
  const a = left.token;
  const b = right.token;
  return a.type === b.type && a.tag === b.tag && a.content === b.content && a.info === b.info
    && (a.attrs?.length ?? 0) === (b.attrs?.length ?? 0)
    && (!a.attrs || a.attrs.every(([key, value], index) => {
      const attribute = b.attrs?.[index];
      return attribute?.[0] === key && attribute[1] === value;
    }))
    && sameNodes(left.children, right.children);
}

function sameNodes(left: Node[], right: Node[]): boolean {
  return left === right || left.length === right.length && left.every((node, index) => sameNode(node, right[index]));
}

function tree(tokens: Token[]): Node[] {
  const root: Node[] = [];
  const stack = [root];
  for (const token of tokens) {
    if (token.nesting === -1) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const node = { token, children: token.children ? tree(token.children) : [] };
    stack[stack.length - 1].push(node);
    if (token.nesting === 1) stack.push(node.children);
  }
  return root;
}

function safeUrl(value: string | number | null): string | undefined {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/.test(value)) return;
  try {
    const url = new URL(value);
    if ((url.protocol === 'https:' || url.protocol === 'http:') && url.hostname) return url.href;
    if (url.protocol === 'mailto:' && url.pathname) return url.href;
  } catch {}
}

const Inline = memo(function Inline({ nodes }: { nodes: Node[] }) {
  const styles = useThemedStyles(createStyles);
  const selectable = useContext(SelectionContext);
  return nodes.map(({ token, children }, index) => {
    if (token.type === 'text') return token.content;
    if (token.type === 'softbreak' || token.type === 'hardbreak') return '\n';
    const content = children.length ? <Inline nodes={children} /> : token.content;
    if (token.type === 'link_open' || token.type === 'image') {
      const uri = safeUrl(token.attrGet(token.type === 'image' ? 'src' : 'href'));
      const label = token.type === 'image' ? <>Image: {content || 'Open image'}</> : content;
      return <Text key={index} selectable={selectable} accessibilityRole={uri ? 'link' : undefined} accessibilityHint={uri ? `Open ${uri}` : undefined} style={uri && styles.link}
        onPress={uri ? () => { void Linking.openURL(uri).catch(() => {}); } : undefined}>{label}</Text>;
    }
    const style = token.type === 'strong_open' ? styles.bold : token.type === 'em_open' ? styles.italic : token.type === 's_open' ? styles.strike : token.type === 'code_inline' ? styles.inlineCode : undefined;
    return <Text key={index} selectable={selectable} style={style}>{content}</Text>;
  });
}, (previous, next) => sameNodes(previous.nodes, next.nodes));

const Code = memo(function Code({ code, language }: { code: string; language: string }) {
  const styles = useThemedStyles(createStyles);
  const selectable = useContext(SelectionContext);
  const [feedback, setFeedback] = useState<{ code: string; failed: boolean }>();
  const currentFeedback = feedback?.code === code ? feedback : undefined;
  return <View style={styles.code}>
    <View style={styles.codeHeader}><Text selectable={selectable} style={styles.language}>{language || 'TEXT'}</Text><Button title={currentFeedback?.failed ? 'Retry copy' : currentFeedback ? 'Copied' : 'Copy'} compact variant="ghost" accessibilityLabel="Copy code" onPress={() => {
      void Clipboard.setStringAsync(code).then(() => setFeedback({ code, failed: false })).catch(() => setFeedback({ code, failed: true }));
    }} /></View>
    {currentFeedback?.failed && <Text selectable={selectable} accessibilityRole="alert" style={styles.copyError}>Copy failed. {selectable ? 'Select the text or try again.' : 'Try again.'}</Text>}
    <ScrollView horizontal contentContainerStyle={styles.codeContent}><Text selectable={selectable} style={styles.codeText}>{code}</Text></ScrollView>
  </View>;
});

function Blocks({ nodes, muted }: { nodes: Node[]; muted?: boolean }) {
  return nodes.map((node, index) => <Block key={index} node={node} muted={muted} />);
}

const ListItem = memo(function ListItem({ node, marker, muted }: { node: Node; marker: string; muted?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const selectable = useContext(SelectionContext);
  return <View style={styles.listItem}>
    <Text selectable={selectable} style={[styles.text, muted && styles.muted, styles.marker]}>{marker}</Text>
    <View style={styles.listContent}><Blocks nodes={node.children} muted={muted} /></View>
  </View>;
}, (previous, next) => previous.marker === next.marker && previous.muted === next.muted && sameNode(previous.node, next.node));

const Block = memo(function Block({ node, muted }: { node: Node; muted?: boolean }) {
    const styles = useThemedStyles(createStyles);
    const selectable = useContext(SelectionContext);
    const { token, children } = node;
    const prose = [styles.text, muted && styles.muted];
    switch (token.type) {
      case 'inline':
        return <Text selectable={selectable} style={prose}><Inline nodes={children} /></Text>;
      case 'paragraph_open':
        return <View style={styles.paragraph}><Blocks nodes={children} muted={muted} /></View>;
      case 'heading_open': {
        const level = Number(token.tag.slice(1));
        return <Text selectable={selectable} accessibilityRole="header" style={[prose, styles.heading, { fontSize: 25 - level * 2, lineHeight: 32 - level }]}><Inline nodes={children.flatMap(node => node.children)} /></Text>;
      }
      case 'fence':
      case 'code_block':
        return <Code code={token.content} language={token.info.trim().split(/\s+/)[0]} />;
      case 'blockquote_open':
        return <View style={styles.quote}><Blocks nodes={children} muted={muted} /></View>;
      case 'bullet_list_open':
      case 'ordered_list_open': {
        const start = Number(token.attrGet('start') || 1);
        return <View style={styles.list}>{children.map((item, itemIndex) => <ListItem key={itemIndex} node={item} marker={token.type === 'ordered_list_open' ? `${start + itemIndex}.` : '•'} muted={muted} />)}</View>;
      }
      case 'hr':
        return <View style={styles.rule} />;
      case 'table_open':
        return <ScrollView horizontal style={styles.tableScroll}><View style={styles.table}><Blocks nodes={children} muted={muted} /></View></ScrollView>;
      case 'tr_open':
        return <View style={styles.tableRow}><Blocks nodes={children} muted={muted} /></View>;
      case 'thead_open':
      case 'tbody_open':
        return <View><Blocks nodes={children} muted={muted} /></View>;
      case 'th_open':
      case 'td_open': {
        const alignment = token.attrGet('style');
        const textAlign = alignment === 'text-align:right' ? 'right' : alignment === 'text-align:center' ? 'center' : 'left';
        return <View style={[styles.cell, token.type === 'th_open' && styles.tableHeader]}><Text selectable={selectable} style={[prose, { textAlign }, token.type === 'th_open' && styles.bold]}><Inline nodes={children.flatMap(node => node.children)} /></Text></View>;
      }
      default:
        return children.length ? <View style={styles.group}><Blocks nodes={children} muted={muted} /></View> : token.content ? <Text selectable={selectable} style={prose}>{token.content}</Text> : null;
    }
}, (previous, next) => previous.muted === next.muted && sameNode(previous.node, next.node));

export const Markdown = memo(function Markdown({ text, muted, selectable = true }: { text: string; muted?: boolean; selectable?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const nodes = useMemo(() => {
    try { return tree(parser.parse(text, {})); } catch { return null; }
  }, [text]);
  return <SelectionContext.Provider value={selectable}><View style={styles.root}>{nodes ? <Blocks nodes={nodes} muted={muted} /> : <Text selectable={selectable} style={[styles.text, muted && styles.muted]}>{text}</Text>}</View></SelectionContext.Provider>;
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: { minWidth: 0, maxWidth: '100%', gap: 12, flexShrink: 1 },
  text: { color: colors.text, fontFamily: sans, fontSize: 16, lineHeight: 25, flexShrink: 1, ...Platform.select({ web: { overflowWrap: 'anywhere' } as TextStyle }) },
  muted: { color: colors.muted },
  paragraph: { minWidth: 0 },
  heading: { fontWeight: '700' },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  link: { color: colors.blue, textDecorationLine: 'underline' },
  inlineCode: { fontFamily: mono, backgroundColor: colors.raised, fontSize: 13 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: 12, gap: 10, minWidth: 0 },
  list: { gap: 6, minWidth: 0 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, minWidth: 0 },
  marker: { minWidth: 20, textAlign: 'right', flexShrink: 0 },
  listContent: { flex: 1, minWidth: 0, gap: 6 },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  group: { gap: 8, minWidth: 0 },
  code: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden', minWidth: 0 },
  codeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12 },
  language: { color: colors.muted, fontFamily: mono, fontSize: 11, flexShrink: 1 },
  codeContent: { paddingHorizontal: 12, paddingBottom: 12 },
  codeText: { color: colors.text, fontFamily: mono, fontSize: 12, lineHeight: 19 },
  copyError: { color: colors.danger, fontFamily: sans, fontSize: 12, paddingHorizontal: 12, paddingBottom: 8 },
  tableScroll: { maxWidth: '100%' },
  table: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.border },
  tableRow: { flexDirection: 'row' },
  cell: { width: 180, padding: 10, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border },
  tableHeader: { backgroundColor: colors.raised },
});
