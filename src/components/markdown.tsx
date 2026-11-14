import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ComponentType, NamedExoticComponent } from "react";
import {
  Linking,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { TextStyle } from "react-native";

import { copyText } from "../lib/clipboard";
import { withAlpha } from "../lib/color";
import { MessageActionsContext } from "../lib/message-actions";
import { splitReveal } from "../lib/stream-reveal";
import type { RevealChunk } from "../lib/stream-reveal";
import { highlightSegments } from "../lib/syntax";
import type { SyntaxSegment } from "../lib/syntax";
import { useTheme } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { inlineCodeKind, tableColumnWidths } from "../lib/transcript";
import { EdgeFade, useScrollEdges } from "./edge-fade";
import { FadeSpan } from "./fade-span";
import { IconButton } from "./icon-button";
import { elevation } from "./surface";
import { mono, monoMedium, sans } from "./ui";
import { useStreamReveal } from "./use-stream-reveal";

const parser = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
  maxNesting: 40,
});
const SelectionContext = createContext(true);

const MEASURE_WIDTH = 10_000;

const createStyles = (colors: ThemeColors) => ({
  ...StyleSheet.create({
    bold: { fontWeight: "700" },
    code: {
      backgroundColor: colors.codeBackground,
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      minWidth: 0,
      overflow: "hidden",
      position: "relative",
    },
    codeContent: { padding: 12 },
    copyButton: { position: "absolute", right: 4, top: 4 },
    copyFace: { backgroundColor: withAlpha(colors.codeBackground, 0.92) },
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
      backgroundColor: withAlpha(colors.text, 0.08),
      color: colors.text,
      fontFamily: monoMedium,
      fontWeight: "400",
    },
    inlineCodePath: { backgroundColor: "transparent", color: colors.codePath },
    italic: { fontStyle: "italic" },
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
    paragraph: { gap: 16, minWidth: 0 },
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
    tableBody: { borderRadius: 4, backgroundColor: colors.bg },
    tableCell: { flexShrink: 0, minWidth: 0, paddingHorizontal: 12 },
    tableCellBody: { paddingVertical: 10 },
    tableCellHeader: { paddingVertical: 8 },
    tableContainer: { minWidth: 0, width: "100%" },
    tableFrame: {
      backgroundColor: colors.panel,
      borderColor: colors.borderMuted,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      minWidth: 0,
      padding: 2,
      width: "100%",
    },
    tableMeasure: {
      left: 0,
      opacity: 0,
      position: "absolute",
      top: 0,
      width: MEASURE_WIDTH,
    },
    tableRow: { alignItems: "stretch", flexDirection: "row" },
    tableRowDivider: {
      borderBottomColor: colors.borderMuted,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tableScroll: { minWidth: 0, width: "100%" },
    tableText: {
      fontFamily: sans,
      fontSize: 13,
      fontVariant: ["tabular-nums"],
      lineHeight: 18,
    },
    tableTextBody: { color: colors.text, fontWeight: "400" },
    tableTextHeader: { color: colors.muted, fontWeight: "500" },
    text: {
      color: colors.text,
      flexShrink: 1,
      fontFamily: sans,
      fontSize: 14,
      lineHeight: 22,
      ...Platform.select({ web: { overflowWrap: "anywhere" } as TextStyle }),
    },
  }),
  headingLineHeights: [27, 26, 25, 24, 23, 23],
  headingSizes: [22, 21, 20, 19, 18, 18],
});

const useMarkdownStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors]);
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

interface Span {
  start: number;
  end: number;
}

const unrevealedTypes = new Set(["code_block", "fence", "table_open"]);

interface Measure {
  atomic: Span[];
  pieces: string[];
  spans: Map<Token, Span>;
}

// Offsets count rendered characters, not markdown source, so a reveal chunk
// lines up with the text the user sees.
const measure = (nodes: Node[], into: Measure, start: number): number => {
  let offset = start;
  for (const { token, children } of nodes) {
    const nodeStart = offset;
    if (children.length) {
      offset = measure(children, into, offset);
    } else if (token.type === "softbreak" || token.type === "hardbreak") {
      into.pieces.push("\n");
      offset += 1;
    } else if (token.type !== "inline") {
      into.pieces.push(token.content);
      offset += token.content.length;
    }
    const span = { end: offset, start: nodeStart };
    into.spans.set(token, span);
    if (unrevealedTypes.has(token.type)) {
      into.atomic.push(span);
    }
  }
  return offset;
};

const measureNodes = (nodes: Node[]) => {
  const into: Measure = { atomic: [], pieces: [], spans: new Map() };
  measure(nodes, into, 0);
  return { atomic: into.atomic, spans: into.spans, text: into.pieces.join("") };
};

interface Reveal {
  chunks: RevealChunk[];
  color: string;
  from: number;
  limit: number;
  spans: Map<Token, Span>;
}

const revealFor = (node: Node, reveal?: Reveal): Reveal | undefined =>
  reveal &&
  !unrevealedTypes.has(node.token.type) &&
  (reveal.spans.get(node.token)?.end ?? 0) > reveal.from
    ? reveal
    : undefined;

// Buffered text past the reveal limit is not rendered yet.
const unreleased = (node: Node, reveal?: Reveal): boolean =>
  !!reveal && (reveal.spans.get(node.token)?.start ?? 0) >= reveal.limit;

const revealText = (
  text: string,
  token: Token,
  selectable: boolean,
  reveal?: Reveal
): React.ReactNode => {
  const start = reveal?.spans.get(token)?.start;
  if (!(reveal && text) || start === undefined) {
    return text;
  }
  if (start + text.length <= reveal.from) {
    return text;
  }
  const released = text.slice(0, Math.max(0, reveal.limit - start));
  return splitReveal(released, start, reveal.chunks).map((piece) =>
    piece.startedAt === undefined ? (
      piece.text
    ) : (
      <FadeSpan
        key={piece.startedAt}
        text={piece.text}
        color={reveal.color}
        selectable={selectable}
      />
    )
  );
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

// Returns undefined for nodes that need their own Text element.
const plainLeaf = (
  node: Node,
  selectable: boolean,
  reveal?: Reveal
): React.ReactNode | undefined => {
  if (unreleased(node, reveal)) {
    return null;
  }
  const { token } = node;
  if (token.type === "text") {
    return revealText(token.content, token, selectable, reveal);
  }
  if (token.type === "softbreak" || token.type === "hardbreak") {
    return "\n";
  }
  return undefined;
};

const INLINE_CODE_SCALE = 0.9;
const DEFAULT_CODE_SIZE = 13.5;
const TABLE_CODE_SIZE = 12;
const ZERO_WIDTH_SPACE = "\u200B";
const hyphenPattern = /-(?=[^-])/gu;

const inlineStyle = (
  styles: ReturnType<typeof createStyles>,
  styleName: ReturnType<typeof inlineStyleName>,
  kind: ReturnType<typeof inlineCodeKind>,
  codeSize: number
) => {
  if (styleName !== "inlineCode") {
    return styleName && styles[styleName];
  }
  return [
    styles.inlineCode,
    { fontSize: codeSize },
    kind === "path" && styles.inlineCodePath,
  ];
};

// Android does not break a line after a hyphen inside a word, so a long path
// would split mid-segment. A zero-width space adds the break opportunity.
const breakablePath = (content: React.ReactNode) =>
  typeof content === "string"
    ? content.replaceAll(hyphenPattern, `-${ZERO_WIDTH_SPACE}`)
    : content;

const Inline = memo(
  function Inline({
    nodes,
    reveal,
    codeSize = DEFAULT_CODE_SIZE,
  }: {
    nodes: Node[];
    reveal?: Reveal;
    codeSize?: number;
  }) {
    const styles = useMarkdownStyles();
    const { colors } = useTheme();
    const selectable = useContext(SelectionContext);
    const selectMessage = useContext(MessageActionsContext);
    return nodes.map((node, index) => {
      const leaf = plainLeaf(node, selectable, reveal);
      if (leaf !== undefined) {
        return leaf;
      }
      const { token, children } = node;
      const isLink = token.type === "link_open" || token.type === "image";
      const uri = isLink
        ? safeUrl(token.attrGet(token.type === "image" ? "src" : "href"))
        : undefined;
      const nodeReveal = revealFor(node, reveal);
      const contentReveal =
        uri && nodeReveal ? { ...nodeReveal, color: colors.blue } : nodeReveal;
      const content = children.length ? (
        <Inline nodes={children} reveal={contentReveal} codeSize={codeSize} />
      ) : (
        revealText(token.content, token, selectable, contentReveal)
      );
      if (isLink) {
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
      const kind =
        styleName === "inlineCode" ? inlineCodeKind(token.content) : undefined;
      const style = inlineStyle(styles, styleName, kind, codeSize);
      return (
        <Text key={index} selectable={selectable} style={style}>
          {kind === "path" ? breakablePath(content) : content}
        </Text>
      );
    });
  },
  (previous, next) =>
    previous.reveal === next.reveal &&
    previous.codeSize === next.codeSize &&
    sameNodes(previous.nodes, next.nodes)
);

const highlightCode = (
  code: string,
  language: string,
  colors: ThemeColors
): React.ReactNode[] | null => {
  const segments = highlightSegments(code, language, colors);
  if (!segments) {
    return null;
  }
  let key = 0;
  return segments.map((segment) => {
    const segmentKey = key;
    key += 1;
    return (
      <Text key={segmentKey} style={segmentStyle(segment)}>
        {segment.text}
      </Text>
    );
  });
};

const segmentStyle = (segment: SyntaxSegment): TextStyle | undefined => {
  if (!segment.color && !segment.bold) {
    return undefined;
  }
  return {
    ...(segment.color ? { color: segment.color } : null),
    ...(segment.bold ? { fontWeight: "700" } : null),
  };
};

type CopyStatus = "idle" | "copied" | "failed";

const copiedDurationMs = 2000;

export const CodeCard = ({
  code,
  highlighted,
  selectable,
}: {
  code: string;
  highlighted?: React.ReactNode[] | null;
  selectable: boolean;
}) => {
  const styles = useMarkdownStyles();
  const { colors } = useTheme();
  const selectMessage = useContext(MessageActionsContext);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  useEffect(() => {
    if (copyStatus !== "copied") {
      return;
    }
    const timer = setTimeout(() => setCopyStatus("idle"), copiedDurationMs);
    return () => clearTimeout(timer);
  }, [copyStatus]);
  const copied = copyStatus === "copied";
  const edges = useScrollEdges("x");
  return (
    <View style={styles.code}>
      <ScrollView
        horizontal
        nestedScrollEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.codeContent}
        {...edges.handlers}
      >
        {/* A long-press handler makes this Text the JS responder instead of
            the message row. On Android the row would otherwise intercept
            every move, and this ScrollView could never start a drag. */}
        <Text
          selectable={selectable}
          onLongPress={
            !selectable && Platform.OS !== "web" ? selectMessage : undefined
          }
          style={styles.codeText}
        >
          {highlighted ?? code}
        </Text>
      </ScrollView>
      {edges.start && <EdgeFade side="left" color={colors.codeBackground} />}
      {edges.end && <EdgeFade side="right" color={colors.codeBackground} />}
      <View style={styles.copyButton}>
        <IconButton
          icon={copied ? "check" : "copy"}
          size={24}
          color={colors.muted}
          accessibilityLabel={copied ? "Copied" : "Copy code"}
          onPress={() => {
            void copyText(code)
              .then(() => setCopyStatus("copied"))
              .catch(() => setCopyStatus("failed"));
          }}
          style={styles.copyFace}
        />
      </View>
      {copyStatus === "failed" && (
        <Text
          selectable={selectable}
          accessibilityRole="alert"
          style={styles.copyError}
        >
          Copy failed.{" "}
          {selectable ? "Select the text or try again." : "Try again."}
        </Text>
      )}
    </View>
  );
};

const CodeView = ({ code, language }: { code: string; language: string }) => {
  const { colors } = useTheme();
  const selectable = useContext(SelectionContext);
  const highlighted = useMemo(
    () => highlightCode(code, language, colors),
    [code, language, colors]
  );
  return (
    <CodeCard code={code} highlighted={highlighted} selectable={selectable} />
  );
};

const Code = memo(CodeView);
// markdown-it ends fenced content with a newline, which renders as an empty
// last line.
const fenceTrailingNewline = /\n$/u;

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

const tokenSeparator = /[\s/-]+/u;
const CELL_PADDING = 24;
const MIN_COLUMN_WIDTH = 48;
const FRAME_INSET = 4;

const plainText = (nodes: Node[]): string =>
  nodes
    .map((node) =>
      node.children.length ? plainText(node.children) : node.token.content
    )
    .join("");

const cellInline = (cell: Node) =>
  cell.children.flatMap((child) => child.children);

const minContentWidth = (text: string, maxContent: number) => {
  const longest = Math.max(
    0,
    ...text.split(tokenSeparator).map((token) => token.length)
  );
  const estimate =
    Math.ceil((maxContent * longest) / Math.max(1, text.length)) + CELL_PADDING;
  return Math.min(Math.max(estimate, MIN_COLUMN_WIDTH), maxContent);
};

interface TableCell {
  key: string;
  column: number;
  header: boolean;
  align: "center" | "left" | "right";
  inline: Node[];
  text: string;
}

const tableRows = (node: Node): TableCell[][] =>
  node.children.flatMap((section, sectionIndex) =>
    section.children.map((row, rowIndex) =>
      row.children.map((cell, column) => ({
        align: tableTextAlign(cell.token.attrGet("style")),
        column,
        header: cell.token.type === "th_open",
        inline: cellInline(cell),
        key: `${sectionIndex}:${rowIndex}:${column}`,
        text: plainText(cellInline(cell)),
      }))
    )
  );

const TableCellView = ({
  cell,
  muted,
  selectable,
  width,
  onLayoutWidth,
}: {
  cell: TableCell;
  muted?: boolean;
  selectable: boolean;
  width?: number;
  onLayoutWidth?: (key: string, width: number) => void;
}) => {
  const styles = useMarkdownStyles();
  return (
    <View
      onLayout={
        onLayoutWidth
          ? (event) => onLayoutWidth(cell.key, event.nativeEvent.layout.width)
          : undefined
      }
      style={[
        styles.tableCell,
        cell.header ? styles.tableCellHeader : styles.tableCellBody,
        width === undefined ? { alignSelf: "flex-start" } : { width },
      ]}
    >
      <Text
        selectable={selectable}
        style={[
          styles.tableText,
          cell.header ? styles.tableTextHeader : styles.tableTextBody,
          muted && styles.muted,
          { textAlign: cell.align },
        ]}
      >
        <Inline nodes={cell.inline} codeSize={TABLE_CODE_SIZE} />
      </Text>
    </View>
  );
};

const MarkdownTable = ({ node, muted }: { node: Node; muted?: boolean }) => {
  const styles = useMarkdownStyles();
  const { colors, scheme } = useTheme();
  const selectable = useContext(SelectionContext);
  const selectMessage = useContext(MessageActionsContext);
  const [frameWidth, setFrameWidth] = useState(0);
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const rows = useMemo(() => tableRows(node), [node]);
  const columnCount = Math.max(1, ...rows.map((row) => row.length));
  const available = Math.max(
    0,
    frameWidth - FRAME_INSET - StyleSheet.hairlineWidth * 2
  );

  const tableEdges = useScrollEdges("x");
  const recordWidth = useCallback((key: string, layoutWidth: number) => {
    // Layout widths are fractional. Rounding down leaves a cell a fraction
    // narrower than its text, which wraps the last character.
    const width = Math.ceil(layoutWidth);
    setMeasured((previous) =>
      previous[key] === width ? previous : { ...previous, [key]: width }
    );
  }, []);

  const layout = useMemo(() => {
    const maxContent = Array.from({ length: columnCount }, () => 0);
    const minContent = Array.from({ length: columnCount }, () => 0);
    for (const row of rows) {
      for (const cell of row) {
        const cellMax = measured[cell.key];
        if (cellMax === undefined) {
          return;
        }
        maxContent[cell.column] = Math.max(maxContent[cell.column], cellMax);
        minContent[cell.column] = Math.max(
          minContent[cell.column],
          minContentWidth(cell.text, cellMax)
        );
      }
    }
    if (available <= 0) {
      return;
    }
    return tableColumnWidths({ available, maxContent, minContent });
  }, [available, columnCount, measured, rows]);

  const widths = layout?.widths;
  const contentWidth = widths
    ? widths.reduce((total, width) => total + width, 0)
    : undefined;
  const headerRows = rows.filter((row) => row[0]?.header);
  const bodyRows = rows.filter((row) => !row[0]?.header);

  const renderRow = (row: TableCell[], divider: boolean, key: string) => (
    <View
      key={key}
      style={[styles.tableRow, divider && styles.tableRowDivider]}
    >
      {row.map((cell) => (
        <TableCellView
          key={cell.key}
          cell={cell}
          muted={muted}
          selectable={selectable}
          width={widths?.[cell.column]}
        />
      ))}
    </View>
  );

  return (
    <View
      style={styles.tableContainer}
      onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
    >
      <View
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.tableMeasure}
      >
        {rows.flat().map((cell) => (
          <TableCellView
            key={cell.key}
            cell={cell}
            muted={muted}
            selectable={false}
            onLayoutWidth={recordWidth}
          />
        ))}
      </View>
      <View style={[styles.tableFrame, !layout && { opacity: 0 }]}>
        <ScrollView
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ width: contentWidth }}
          style={styles.tableScroll}
          {...tableEdges.handlers}
        >
          {/* The table claims the JS responder so the message row does not.
            On Android the row would otherwise intercept every move, and this
            ScrollView could never start a drag. */}
          <Pressable
            accessible={false}
            importantForAccessibility="no"
            focusable={false}
            disabled={!selectMessage || Platform.OS === "web"}
            onLongPress={selectMessage}
            style={{ width: contentWidth }}
          >
            {headerRows.map((row, index) =>
              renderRow(row, false, `head-${index}`)
            )}
            <View
              style={[
                styles.tableBody,
                { boxShadow: elevation(scheme).raised },
              ]}
            >
              {bodyRows.map((row, index) =>
                renderRow(row, index < bodyRows.length - 1, `body-${index}`)
              )}
            </View>
          </Pressable>
        </ScrollView>
        {tableEdges.start && <EdgeFade side="left" color={colors.bg} />}
        {tableEdges.end && <EdgeFade side="right" color={colors.bg} />}
      </View>
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
  reveal?: Reveal;
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
    previous.reveal === next.reveal &&
    sameNode(previous.node, next.node)
);

interface BlockProps {
  node: Node;
  muted?: boolean;
  reveal?: Reveal;
}

const BlockView = ({
  node,
  muted,
  reveal,
  Child,
}: BlockProps & { Child: ComponentType<BlockProps> }) => {
  const styles = useMarkdownStyles();
  const selectable = useContext(SelectionContext);
  const { token, children } = node;
  const prose = [styles.text, muted && styles.muted];
  const renderBlocks = (items: Node[]) =>
    items.map((item, index) =>
      unreleased(item, reveal) ? null : (
        <Child
          key={index}
          node={item}
          muted={muted}
          reveal={revealFor(item, reveal)}
        />
      )
    );
  switch (token.type) {
    case "inline": {
      return (
        <Text selectable={selectable} style={prose}>
          <Inline nodes={children} reveal={reveal} />
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
          <Inline
            nodes={children.flatMap((child) => child.children)}
            reveal={reveal}
            codeSize={Math.round(fontSize * INLINE_CODE_SCALE)}
          />
        </Text>
      );
    }
    case "fence":
    case "code_block": {
      return (
        <Code
          code={token.content.replace(fenceTrailingNewline, "")}
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
          {children.map((item, itemIndex) =>
            unreleased(item, reveal) ? null : (
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
                reveal={revealFor(item, reveal)}
              >
                {renderBlocks(item.children)}
              </ListItem>
            )
          )}
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
  function Block({ node, muted, reveal }: BlockProps) {
    return (
      <BlockView node={node} muted={muted} reveal={reveal} Child={Block} />
    );
  },
  (previous, next) =>
    previous.muted === next.muted &&
    previous.reveal === next.reveal &&
    sameNode(previous.node, next.node)
);

const Blocks = ({
  nodes,
  muted,
  reveal,
}: {
  nodes: Node[];
  muted?: boolean;
  reveal?: Reveal;
}) =>
  nodes.map((node, index) =>
    unreleased(node, reveal) ? null : (
      <Block
        key={index}
        node={node}
        muted={muted}
        reveal={revealFor(node, reveal)}
      />
    )
  );

const MarkdownView = ({
  text,
  muted,
  selectable = true,
  streaming = false,
}: {
  text: string;
  muted?: boolean;
  selectable?: boolean;
  streaming?: boolean;
}) => {
  const styles = useMarkdownStyles();
  const { colors } = useTheme();
  const nodes = useMemo(() => {
    try {
      return tree(parser.parse(text, {}));
    } catch {
      return null;
    }
  }, [text]);
  const measured = useMemo(
    () => (nodes ? measureNodes(nodes) : { atomic: [], spans: null, text }),
    [nodes, text]
  );
  const { chunks, shown } = useStreamReveal(measured, streaming);
  const color = muted ? colors.muted : colors.text;
  const { spans } = measured;
  const settled = !chunks.length && shown >= measured.text.length;
  const reveal = useMemo<Reveal | undefined>(
    () =>
      spans && !settled
        ? {
            chunks,
            color,
            from: chunks[0]?.start ?? shown,
            limit: shown,
            spans,
          }
        : undefined,
    [spans, settled, chunks, color, shown]
  );
  return (
    <SelectionContext.Provider value={selectable}>
      <View style={styles.root}>
        {nodes ? (
          <Blocks nodes={nodes} muted={muted} reveal={reveal} />
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
