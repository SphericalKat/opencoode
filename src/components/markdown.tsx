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
import type { ComponentType, NamedExoticComponent } from "react";
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

const createStyles = (colors: ThemeColors, beta: boolean) => ({
  ...StyleSheet.create({
    bold: { fontWeight: "700" },
    cell: {
      borderBottomWidth: 1,
      borderColor: colors.border,
      borderRightWidth: 1,
      flexShrink: 0,
      minWidth: 0,
      padding: 10,
    },
    code: {
      backgroundColor: colors.bg,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      minWidth: 0,
      overflow: "hidden",
    },
    codeContent: { paddingBottom: 12, paddingHorizontal: 12 },
    codeHeader: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      justifyContent: "space-between",
      paddingHorizontal: 12,
    },
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
    group: { gap: 8, minWidth: 0 },
    heading: { fontWeight: "700" },
    inlineCode: {
      backgroundColor: colors.raised,
      fontFamily: mono,
      fontSize: 14,
    },
    italic: { fontStyle: "italic" },
    language: {
      color: colors.muted,
      flexShrink: 1,
      fontFamily: mono,
      fontSize: 12,
    },
    link: { color: colors.blue, textDecorationLine: "underline" },
    list: { gap: 6, minWidth: 0 },
    // Keep an auto flex basis so native layout measures wrapped list text at its final width.
    listContent: { flexGrow: 1, flexShrink: 1, gap: 6, minWidth: 0 },
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
    muted: { color: colors.muted },
    paragraph: { gap: beta ? 16 : 0, minWidth: 0 },
    quote: {
      borderLeftColor: colors.border,
      borderLeftWidth: 3,
      gap: 10,
      minWidth: 0,
      paddingLeft: 12,
    },
    root: { flexShrink: 1, gap: 12, maxWidth: "100%", minWidth: 0 },
    rule: { backgroundColor: colors.border, height: 1, marginVertical: 4 },
    strike: { textDecorationLine: "line-through" },
    table: {
      borderColor: colors.border,
      borderLeftWidth: 1,
      borderTopWidth: 1,
    },
    tableContainer: { minWidth: 0, width: "100%" },
    tableHeader: { backgroundColor: colors.raised },
    tableHint: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 19,
      paddingTop: 4,
    },
    tableRow: { alignItems: "stretch", flexDirection: "row" },
    tableScroll: { minWidth: 0, width: "100%" },
    text: {
      color: colors.text,
      flexShrink: 1,
      fontFamily: sans,
      fontSize: beta ? 15 : 17,
      lineHeight: beta ? 23 : 26,
      ...Platform.select({ web: { overflowWrap: "anywhere" } as TextStyle }),
    },
  }),
  headingLineHeights: beta
    ? [27, 26, 25, 24, 23, 23]
    : [32, 31, 30, 29, 28, 27],
  headingSizes: beta ? [22, 21, 20, 19, 18, 18] : [24, 22, 20, 18, 16, 14],
});

const useMarkdownStyles = () => {
  const { colors } = useTheme();
  const beta = useBetaLayout();
  return useMemo(() => createStyles(colors, beta), [colors, beta]);
};

interface Node {
  token: Token;
  children: Node[];
}

const sameNode = (left: Node, right: Node): boolean => {
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
    (left.children === right.children ||
      (left.children.length === right.children.length &&
        left.children.every((child, index) =>
          sameNode(child, right.children[index])
        )))
  );
};

const sameNodes = (left: Node[], right: Node[]): boolean =>
  left === right ||
  (left.length === right.length &&
    left.every((node, index) => sameNode(node, right[index])));

const tree = (tokens: Token[]): Node[] => {
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
};

const MAX_CONTROL_CODE = 0x20;
const DELETE_CODE = 0x7f;

const hasControlOrSpace = (value: string): boolean => {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= MAX_CONTROL_CODE || code === DELETE_CODE) {
      return true;
    }
  }
  return false;
};

const safeUrl = (value: string | number | null): string | undefined => {
  if (typeof value !== "string" || hasControlOrSpace(value)) {
    return undefined;
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
  } catch {
    return undefined;
  }
  return undefined;
};

const ignoreError = () => null;

const inlineStyleName = (
  type: string
): "bold" | "inlineCode" | "italic" | "strike" | undefined => {
  switch (type) {
    case "strong_open": {
      return "bold";
    }
    case "em_open": {
      return "italic";
    }
    case "s_open": {
      return "strike";
    }
    case "code_inline": {
      return "inlineCode";
    }
    default: {
      return undefined;
    }
  }
};

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
                    void Linking.openURL(uri).catch(ignoreError);
                  }
                : undefined
            }
          >
            {label}
          </Text>
        );
      }
      const styleName = inlineStyleName(token.type);
      const style = styleName ? styles[styleName] : undefined;
      return (
        <Text key={index} selectable={selectable} style={style}>
          {content}
        </Text>
      );
    });
  },
  (previous, next) => sameNodes(previous.nodes, next.nodes)
);

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

type SyntaxColorKey =
  | "syntaxComment"
  | "syntaxConstant"
  | "syntaxKeyword"
  | "syntaxNumber"
  | "syntaxProperty"
  | "syntaxString"
  | "syntaxType";

const syntaxColorKeys = new Map<string, SyntaxColorKey>([
  ["comment", "syntaxComment"],
  ["prolog", "syntaxComment"],
  ["doctype", "syntaxComment"],
  ["string", "syntaxString"],
  ["char", "syntaxString"],
  ["attr-value", "syntaxString"],
  ["keyword", "syntaxKeyword"],
  ["atrule", "syntaxKeyword"],
  ["selector", "syntaxKeyword"],
  ["number", "syntaxNumber"],
  ["boolean", "syntaxNumber"],
  ["property", "syntaxProperty"],
  ["function", "syntaxProperty"],
  ["attr-name", "syntaxProperty"],
  ["class-name", "syntaxType"],
  ["builtin", "syntaxType"],
  ["tag", "syntaxType"],
  ["constant", "syntaxConstant"],
  ["symbol", "syntaxConstant"],
  ["variable", "syntaxConstant"],
]);

const highlightCode = (
  code: string,
  language: string,
  colors: ThemeColors
): React.ReactNode[] | null => {
  const grammar = Prism.languages[supportedLanguages[language.toLowerCase()]];
  if (!grammar) {
    return null;
  }
  const colorFor = (type: string) => {
    const colorKey = syntaxColorKeys.get(type);
    return colorKey ? colors[colorKey] : undefined;
  };
  let key = 0;
  const flatten = (
    token: string | Prism.Token,
    inherited?: string
  ): React.ReactNode[] => {
    if (typeof token === "string") {
      const textKey = key;
      key += 1;
      return [
        <Text
          key={textKey}
          style={inherited ? { color: inherited } : undefined}
        >
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
};

const copyLabel = (feedback?: { failed: boolean }): string => {
  if (feedback?.failed) {
    return "Retry copy";
  }
  return feedback ? "Copied" : "Copy";
};

const CodeView = ({ code, language }: { code: string; language: string }) => {
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
          title={copyLabel(currentFeedback)}
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
};

const Code = memo(CodeView);

const tableTextAlign = (
  alignment: string | number | null
): "center" | "left" | "right" => {
  if (alignment === "text-align:right") {
    return "right";
  }
  if (alignment === "text-align:center") {
    return "center";
  }
  return "left";
};

const MarkdownTable = ({ node, muted }: { node: Node; muted?: boolean }) => {
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
        const textAlign = tableTextAlign(cell.token.attrGet("style"));
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
};

// Block content arrives as children so ListItem does not reference Block, which renders ListItem.
const ListItemView = ({
  marker,
  markerWidth,
  muted,
  children,
}: {
  node: Node;
  marker: string;
  markerWidth: number;
  muted?: boolean;
  children: React.ReactNode;
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
      <View style={styles.listContent}>{children}</View>
    </View>
  );
};

const ListItem = memo(
  ListItemView,
  (previous, next) =>
    previous.marker === next.marker &&
    previous.markerWidth === next.markerWidth &&
    previous.muted === next.muted &&
    sameNode(previous.node, next.node)
);

interface BlockProps {
  node: Node;
  muted?: boolean;
}

const BlockView = ({
  node,
  muted,
  Child,
}: BlockProps & { Child: ComponentType<BlockProps> }) => {
  const styles = useMarkdownStyles();
  const selectable = useContext(SelectionContext);
  const { token, children } = node;
  const prose = [styles.text, muted && styles.muted];
  const renderBlocks = (items: Node[]) =>
    items.map((item, index) => <Child key={index} node={item} muted={muted} />);
  switch (token.type) {
    case "inline": {
      return (
        <Text selectable={selectable} style={prose}>
          <Inline nodes={children} />
        </Text>
      );
    }
    case "paragraph_open": {
      return <View style={styles.paragraph}>{renderBlocks(children)}</View>;
    }
    case "heading_open": {
      const level = Number(token.tag.slice(1));
      const fontSize = styles.headingSizes[level - 1] ?? styles.headingSizes[5];
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
          <Inline nodes={children.flatMap((child) => child.children)} />
        </Text>
      );
    }
    case "fence":
    case "code_block": {
      return (
        <Code
          code={token.content}
          language={token.info.trim().split(/\s+/u)[0]}
        />
      );
    }
    case "blockquote_open": {
      return <View style={styles.quote}>{renderBlocks(children)}</View>;
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
            >
              {renderBlocks(item.children)}
            </ListItem>
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
      if (children.length) {
        return <View style={styles.group}>{renderBlocks(children)}</View>;
      }
      if (token.content) {
        return (
          <Text selectable={selectable} style={prose}>
            {token.content}
          </Text>
        );
      }
      return null;
    }
  }
};

const Block: NamedExoticComponent<BlockProps> = memo(
  function Block({ node, muted }: BlockProps) {
    return <BlockView node={node} muted={muted} Child={Block} />;
  },
  (previous, next) =>
    previous.muted === next.muted && sameNode(previous.node, next.node)
);

const Blocks = ({ nodes, muted }: { nodes: Node[]; muted?: boolean }) =>
  nodes.map((node, index) => <Block key={index} node={node} muted={muted} />);

const MarkdownView = ({
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
};

export const Markdown = memo(MarkdownView);
