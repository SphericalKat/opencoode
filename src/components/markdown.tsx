import * as Clipboard from "expo-clipboard";
import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import Prism from "prismjs";
import React, {
  createContext,
  memo,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  Linking,
  PixelRatio,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { TextStyle } from "react-native";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";

import { useBetaLayout } from "../lib/beta-layout";
import { MessageActionsContext } from "../lib/message-actions";
import { useTheme } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { Button, mono, sans } from "./ui";

const parser = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
  maxNesting: 40,
});
const SelectionContext = createContext(true);

function useMarkdownStyles() {
  const { colors } = useTheme();
  const beta = useBetaLayout();
  return useMemo(() => createStyles(colors, beta), [colors, beta]);
}

interface Node {
  token: Token;
  children: Node[];
}

function sameNode(left: Node, right: Node): boolean {
  if (left === right) {
    return true;
  }
  const a = left.token;
  const b = right.token;
  return (
    a.type === b.type &&
    a.tag === b.tag &&
    a.content === b.content &&
    a.info === b.info &&
    (a.attrs?.length ?? 0) === (b.attrs?.length ?? 0) &&
    (!a.attrs ||
      a.attrs.every(([key, value], index) => {
        const attribute = b.attrs?.[index];
        return attribute?.[0] === key && attribute[1] === value;
      })) &&
    sameNodes(left.children, right.children)
  );
}

function sameNodes(left: Node[], right: Node[]): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((node, index) => sameNode(node, right[index])))
  );
}

function tree(tokens: Token[]): Node[] {
  const root: Node[] = [];
  const stack = [root];
  for (const token of tokens) {
    if (token.nesting === -1) {
      if (stack.length > 1) {
        stack.pop();
      }
      continue;
    }
    const node = {
      children: token.children ? tree(token.children) : [],
      token,
    };
    stack.at(-1)?.push(node);
    if (token.nesting === 1) {
      stack.push(node.children);
    }
  }
  return root;
}

function safeUrl(value: string | number | null): string | undefined {
  if (typeof value !== "string" || /[\u0000-\u0020\u007F]/.test(value)) {
    return;
  }
  try {
    const url = new URL(value);
    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname
    ) {
      return url.href;
    }
    if (url.protocol === "mailto:" && url.pathname) {
      return url.href;
    }
  } catch {}
}

const Inline = memo(
  function Inline({ nodes }: { nodes: Node[] }) {
    const styles = useMarkdownStyles();
    const selectable = useContext(SelectionContext);
    const selectMessage = useContext(MessageActionsContext);
    return nodes.map(({ token, children }, index) => {
      if (token.type === "text") {
        return token.content;
      }
      if (token.type === "softbreak" || token.type === "hardbreak") {
        return "\n";
      }
      const content = children.length ? (
        <Inline nodes={children} />
      ) : (
        token.content
      );
      if (token.type === "link_open" || token.type === "image") {
        const uri = safeUrl(
          token.attrGet(token.type === "image" ? "src" : "href")
        );
        const label =
          token.type === "image" ? (
            <>Image: {content || "Open image"}</>
          ) : (
            content
          );
        return (
          <Text
            key={index}
            selectable={selectable}
            accessibilityRole={uri ? "link" : undefined}
            accessibilityHint={uri ? `Open ${uri}` : undefined}
            style={uri && styles.link}
            onLongPress={
              uri && Platform.OS !== "web" ? selectMessage : undefined
            }
            onPress={
              uri
                ? () => {
                    void Linking.openURL(uri).catch(() => {});
                  }
                : undefined
            }
          >
            {label}
          </Text>
        );
      }
      const style =
        token.type === "strong_open"
          ? styles.bold
          : token.type === "em_open"
            ? styles.italic
            : token.type === "s_open"
              ? styles.strike
              : token.type === "code_inline"
                ? styles.inlineCode
                : undefined;
      return (
        <Text key={index} selectable={selectable} style={style}>
          {content}
        </Text>
      );
    });
  },
  (previous, next) => sameNodes(previous.nodes, next.nodes)
);

const Code = memo(({ code, language }: { code: string; language: string }) => {
  const styles = useMarkdownStyles();
  const { colors } = useTheme();
  const selectable = useContext(SelectionContext);
  const highlighted = useMemo(
    () => highlightCode(code, language, colors),
    [code, language, colors]
  );
  const [feedback, setFeedback] = useState<{ code: string; failed: boolean }>();
  const currentFeedback = feedback?.code === code ? feedback : undefined;
  return (
    <View style={styles.code}>
      <View style={styles.codeHeader}>
        <Text selectable={selectable} style={styles.language}>
          {language || "TEXT"}
        </Text>
        <Button
          title={
            currentFeedback?.failed
              ? "Retry copy"
              : currentFeedback
                ? "Copied"
                : "Copy"
          }
          compact
          variant="ghost"
          accessibilityLabel="Copy code"
          onPress={() => {
            void Clipboard.setStringAsync(code)
              .then(() => setFeedback({ code, failed: false }))
              .catch(() => setFeedback({ code, failed: true }));
          }}
        />
      </View>
      {currentFeedback?.failed && (
        <Text
          selectable={selectable}
          accessibilityRole="alert"
          style={styles.copyError}
        >
          Copy failed.{" "}
          {selectable ? "Select the text or try again." : "Try again."}
        </Text>
      )}
      <ScrollView horizontal contentContainerStyle={styles.codeContent}>
        <Text selectable={selectable} style={styles.codeText}>
          {highlighted ?? code}
        </Text>
      </ScrollView>
    </View>
  );
});

const supportedLanguages: Record<string, string> = {
  bash: "bash",
  c: "c",
  "c#": "csharp",
  "c++": "cpp",
  cpp: "cpp",
  csharp: "csharp",
  css: "css",
  go: "go",
  html: "markup",
  java: "java",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  kotlin: "kotlin",
  kt: "kotlin",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  sh: "bash",
  shell: "bash",
  sql: "sql",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
  xml: "markup",
  yaml: "yaml",
  yml: "yaml",
};

function highlightCode(
  code: string,
  language: string,
  colors: ThemeColors
): React.ReactNode[] | null {
  const grammar = Prism.languages[supportedLanguages[language.toLowerCase()]];
  if (!grammar) {
    return null;
  }
  const colorFor = (type: string) => {
    if (type === "comment" || type === "prolog" || type === "doctype") {
      return colors.syntaxComment;
    }
    if (type === "string" || type === "char" || type === "attr-value") {
      return colors.syntaxString;
    }
    if (type === "keyword" || type === "atrule" || type === "selector") {
      return colors.syntaxKeyword;
    }
    if (type === "number" || type === "boolean") {
      return colors.syntaxNumber;
    }
    if (type === "property" || type === "function" || type === "attr-name") {
      return colors.syntaxProperty;
    }
    if (type === "class-name" || type === "builtin" || type === "tag") {
      return colors.syntaxType;
    }
    if (type === "constant" || type === "symbol" || type === "variable") {
      return colors.syntaxConstant;
    }
    return;
  };
  let key = 0;
  const flatten = (
    token: string | Prism.Token,
    inherited?: string
  ): React.ReactNode[] => {
    if (typeof token === "string") {
      return [
        <Text key={key++} style={inherited ? { color: inherited } : undefined}>
          {token}
        </Text>,
      ];
    }
    const color = colorFor(token.type) ?? inherited;
    return (
      Array.isArray(token.content) ? token.content : [token.content]
    ).flatMap((child) => flatten(child, color));
  };
  try {
    return Prism.tokenize(code, grammar).flatMap((token) => flatten(token));
  } catch {
    return null;
  }
}

function Blocks({ nodes, muted }: { nodes: Node[]; muted?: boolean }) {
  return nodes.map((node, index) => (
    <Block key={index} node={node} muted={muted} />
  ));
}

function MarkdownTable({ node, muted }: { node: Node; muted?: boolean }) {
  const styles = useMarkdownStyles();
  const selectable = useContext(SelectionContext);
  const [availableWidth, setAvailableWidth] = useState(0);
  const rows = node.children.flatMap((section) => section.children);
  const columnCount = Math.max(1, ...rows.map((row) => row.children.length));
  const columnWidth = Math.max(
    120,
    Math.floor(((availableWidth || columnCount * 120 + 1) - 1) / columnCount)
  );
  const contentWidth = columnWidth * columnCount + 1;
  const renderRow = (row: Node, rowIndex: number) => (
    <View key={rowIndex} style={styles.tableRow}>
      {row.children.map((cell, cellIndex) => {
        const isHeader = cell.token.type === "th_open";
        const alignment = cell.token.attrGet("style");
        const textAlign =
          alignment === "text-align:right"
            ? "right"
            : alignment === "text-align:center"
              ? "center"
              : "left";
        return (
          <View
            key={cellIndex}
            style={[
              styles.cell,
              { width: columnWidth },
              isHeader && styles.tableHeader,
            ]}
          >
            <Text
              selectable={selectable}
              style={[
                styles.text,
                muted && styles.muted,
                { textAlign },
                isHeader && styles.bold,
              ]}
            >
              <Inline
                nodes={cell.children.flatMap((child) => child.children)}
              />
            </Text>
          </View>
        );
      })}
    </View>
  );
  return (
    <View
      style={styles.tableContainer}
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        persistentScrollbar
        showsHorizontalScrollIndicator
        contentContainerStyle={{ width: contentWidth }}
        style={styles.tableScroll}
      >
        <View style={[styles.table, { width: contentWidth }]}>
          {rows.map(renderRow)}
        </View>
      </ScrollView>
      {contentWidth > availableWidth && availableWidth > 0 && (
        <Text style={[styles.tableHint, muted && styles.muted]}>
          Swipe to see more columns
        </Text>
      )}
    </View>
  );
}

const ListItem = memo(
  ({
    node,
    marker,
    markerWidth,
    muted,
  }: {
    node: Node;
    marker: string;
    markerWidth: number;
    muted?: boolean;
  }) => {
    const styles = useMarkdownStyles();
    const selectable = useContext(SelectionContext);
    return (
      <View style={styles.listItem}>
        <Text
          selectable={selectable}
          style={[
            styles.text,
            muted && styles.muted,
            styles.marker,
            { minWidth: markerWidth },
          ]}
        >
          {marker}
        </Text>
        <View style={styles.listContent}>
          <Blocks nodes={node.children} muted={muted} />
        </View>
      </View>
    );
  },
  (previous, next) =>
    previous.marker === next.marker &&
    previous.markerWidth === next.markerWidth &&
    previous.muted === next.muted &&
    sameNode(previous.node, next.node)
);

const Block = memo(
  ({ node, muted }: { node: Node; muted?: boolean }) => {
    const styles = useMarkdownStyles();
    const selectable = useContext(SelectionContext);
    const { token, children } = node;
    const prose = [styles.text, muted && styles.muted];
    switch (token.type) {
      case "inline": {
        return (
          <Text selectable={selectable} style={prose}>
            <Inline nodes={children} />
          </Text>
        );
      }
      case "paragraph_open": {
        return (
          <View style={styles.paragraph}>
            <Blocks nodes={children} muted={muted} />
          </View>
        );
      }
      case "heading_open": {
        const level = Number(token.tag.slice(1));
        const fontSize =
          styles.headingSizes[level - 1] ?? styles.headingSizes[5];
        return (
          <Text
            selectable={selectable}
            accessibilityRole="header"
            style={[
              prose,
              styles.heading,
              {
                fontSize,
                lineHeight:
                  styles.headingLineHeights[level - 1] ??
                  styles.headingLineHeights[5],
              },
            ]}
          >
            <Inline nodes={children.flatMap((node) => node.children)} />
          </Text>
        );
      }
      case "fence":
      case "code_block": {
        return (
          <Code
            code={token.content}
            language={token.info.trim().split(/\s+/)[0]}
          />
        );
      }
      case "blockquote_open": {
        return (
          <View style={styles.quote}>
            <Blocks nodes={children} muted={muted} />
          </View>
        );
      }
      case "bullet_list_open":
      case "ordered_list_open": {
        const start = Number(token.attrGet("start") || 1);
        const markerWidth =
          (token.type === "ordered_list_open"
            ? Math.max(20, `${start + children.length - 1}.`.length * 10)
            : 20) * PixelRatio.getFontScale();
        return (
          <View style={styles.list}>
            {children.map((item, itemIndex) => (
              <ListItem
                key={itemIndex}
                node={item}
                marker={
                  token.type === "ordered_list_open"
                    ? `${start + itemIndex}.`
                    : "•"
                }
                markerWidth={markerWidth}
                muted={muted}
              />
            ))}
          </View>
        );
      }
      case "hr": {
        return <View style={styles.rule} />;
      }
      case "table_open": {
        return <MarkdownTable node={node} muted={muted} />;
      }
      default: {
        return children.length ? (
          <View style={styles.group}>
            <Blocks nodes={children} muted={muted} />
          </View>
        ) : token.content ? (
          <Text selectable={selectable} style={prose}>
            {token.content}
          </Text>
        ) : null;
      }
    }
  },
  (previous, next) =>
    previous.muted === next.muted && sameNode(previous.node, next.node)
);

export const Markdown = memo(
  ({
    text,
    muted,
    selectable = true,
  }: {
    text: string;
    muted?: boolean;
    selectable?: boolean;
  }) => {
    const styles = useMarkdownStyles();
    const nodes = useMemo(() => {
      try {
        return tree(parser.parse(text, {}));
      } catch {
        return null;
      }
    }, [text]);
    return (
      <SelectionContext.Provider value={selectable}>
        <View style={styles.root}>
          {nodes ? (
            <Blocks nodes={nodes} muted={muted} />
          ) : (
            <Text
              selectable={selectable}
              style={[styles.text, muted && styles.muted]}
            >
              {text}
            </Text>
          )}
        </View>
      </SelectionContext.Provider>
    );
  }
);

const createStyles = (colors: ThemeColors, beta: boolean) => ({
  ...StyleSheet.create({
    root: { flexShrink: 1, gap: 12, maxWidth: "100%", minWidth: 0 },
    text: {
      color: colors.text,
      flexShrink: 1,
      fontFamily: sans,
      fontSize: beta ? 15 : 17,
      lineHeight: beta ? 23 : 26,
      ...Platform.select({ web: { overflowWrap: "anywhere" } as TextStyle }),
    },
    muted: { color: colors.muted },
    paragraph: { gap: beta ? 16 : 0, minWidth: 0 },
    heading: { fontWeight: "700" },
    bold: { fontWeight: "700" },
    italic: { fontStyle: "italic" },
    strike: { textDecorationLine: "line-through" },
    link: { color: colors.blue, textDecorationLine: "underline" },
    inlineCode: {
      backgroundColor: colors.raised,
      fontFamily: mono,
      fontSize: 14,
    },
    quote: {
      borderLeftColor: colors.border,
      borderLeftWidth: 3,
      gap: 10,
      minWidth: 0,
      paddingLeft: 12,
    },
    list: { gap: 6, minWidth: 0 },
    listItem: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 8,
      minWidth: 0,
    },
    marker: {
      flexShrink: 0,
      fontVariant: ["tabular-nums"],
      textAlign: "right",
    },
    // Keep an auto flex basis so native layout measures wrapped list text at its final width.
    listContent: { flexGrow: 1, flexShrink: 1, gap: 6, minWidth: 0 },
    rule: { backgroundColor: colors.border, height: 1, marginVertical: 4 },
    group: { gap: 8, minWidth: 0 },
    code: {
      backgroundColor: colors.bg,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      minWidth: 0,
      overflow: "hidden",
    },
    codeHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
      paddingHorizontal: 12,
    },
    language: {
      color: colors.muted,
      flexShrink: 1,
      fontFamily: mono,
      fontSize: 12,
    },
    codeContent: { paddingBottom: 12, paddingHorizontal: 12 },
    codeText: {
      color: colors.text,
      fontFamily: mono,
      fontSize: 13,
      lineHeight: 20,
    },
    copyError: {
      color: colors.danger,
      fontFamily: sans,
      fontSize: 13,
      paddingBottom: 8,
      paddingHorizontal: 12,
    },
    tableContainer: { minWidth: 0, width: "100%" },
    tableScroll: { minWidth: 0, width: "100%" },
    table: {
      borderColor: colors.border,
      borderLeftWidth: 1,
      borderTopWidth: 1,
    },
    tableRow: { alignItems: "stretch", flexDirection: "row" },
    cell: {
      borderBottomWidth: 1,
      borderColor: colors.border,
      borderRightWidth: 1,
      flexShrink: 0,
      minWidth: 0,
      padding: 10,
    },
    tableHeader: { backgroundColor: colors.raised },
    tableHint: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 19,
      paddingTop: 4,
    },
  }),
  headingLineHeights: beta
    ? [27, 26, 25, 24, 23, 23]
    : [32, 31, 30, 29, 28, 27],
  headingSizes: beta ? [22, 21, 20, 19, 18, 18] : [24, 22, 20, 18, 16, 14],
});
