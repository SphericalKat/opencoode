import Prism from "prismjs";
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
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-toml";

import type { ThemeColors } from "./theme";

export interface SyntaxSegment {
  text: string;
  color?: string;
  bold?: boolean;
}

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
  markdown: "markdown",
  py: "python",
  python: "python",
  rs: "rust",
  rust: "rust",
  sh: "bash",
  shell: "bash",
  sql: "sql",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
  xml: "markup",
  yaml: "yaml",
  yml: "yaml",
};

const extensionLanguages: Record<string, string> = {
  ...supportedLanguages,
  cc: "cpp",
  cjs: "javascript",
  cts: "typescript",
  h: "c",
  hpp: "cpp",
  htm: "markup",
  markdown: "markdown",
  md: "markdown",
  mdx: "markdown",
  mjs: "javascript",
  mts: "typescript",
  svg: "markup",
  toml: "toml",
  kts: "kotlin",
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
  ["title", "syntaxKeyword"],
  ["code-snippet", "syntaxString"],
  ["code", "syntaxString"],
  ["url", "syntaxKeyword"],
]);

const boldTypes = new Set(["title", "bold"]);
const extensionPattern = /\.(?<extension>[^./\\]+)$/u;

export const languageForPath = (path: string): string | undefined => {
  const basename = path.split(/[/\\]/u).pop() ?? path;
  const extension = extensionPattern
    .exec(basename)
    ?.groups?.extension?.toLowerCase();
  return extension ? extensionLanguages[extension] : undefined;
};

const flatten = (
  token: string | Prism.Token,
  colors: ThemeColors,
  inherited: { color?: string; bold?: boolean }
): SyntaxSegment[] => {
  if (typeof token === "string") {
    const segment: SyntaxSegment = { text: token };
    if (inherited.color) {
      segment.color = inherited.color;
    }
    if (inherited.bold) {
      segment.bold = true;
    }
    return [segment];
  }
  const colorKey = syntaxColorKeys.get(token.type);
  const next = {
    bold: inherited.bold || boldTypes.has(token.type),
    color: (colorKey ? colors[colorKey] : undefined) ?? inherited.color,
  };
  return (
    Array.isArray(token.content) ? token.content : [token.content]
  ).flatMap((child) => flatten(child as string | Prism.Token, colors, next));
};

export const highlightSegments = (
  code: string,
  language: string | undefined,
  colors: ThemeColors
): SyntaxSegment[] | null => {
  const grammar = language
    ? Prism.languages[supportedLanguages[language.toLowerCase()] ?? ""]
    : undefined;
  if (!grammar) {
    return null;
  }
  try {
    return Prism.tokenize(code, grammar).flatMap((token) =>
      flatten(token, colors, {})
    );
  } catch {
    return null;
  }
};

const splitLines = (segments: SyntaxSegment[]): SyntaxSegment[][] => {
  const lines: SyntaxSegment[][] = [[]];
  for (const segment of segments) {
    const parts = segment.text.split("\n");
    for (const [index, text] of parts.entries()) {
      if (index > 0) {
        lines.push([]);
      }
      if (text) {
        lines.at(-1)?.push({ ...segment, text });
      }
    }
  }
  return lines;
};

const fenceOpenPattern = /^\s*(?<fence>`{3,}|~{3,})\s*(?<info>[\w+#-]*)/u;
const markdownLanguages = new Set(["markdown", "md", "mdx"]);

interface Fence {
  language: string;
  start: number;
  end: number;
}

// Prism's markdown grammar only matches fences at the start of a line, so an
// indented fence inside a list item is not nested. This finds every fence by
// line so its body can use the language from its info string.
const findFences = (lines: string[]): Fence[] => {
  const fences: Fence[] = [];
  let open: { fence: string; language: string; start: number } | undefined;
  for (const [index, line] of lines.entries()) {
    const match = fenceOpenPattern.exec(line);
    const fence = match?.groups?.fence ?? "";
    const info = match?.groups?.info ?? "";
    if (open) {
      const closes = fence.startsWith(open.fence) && !info;
      if (closes) {
        fences.push({ end: index, language: open.language, start: open.start });
        open = undefined;
      }
    } else if (match) {
      open = { fence, language: info.toLowerCase(), start: index + 1 };
    }
  }
  return fences;
};

const nestFences = (
  code: string,
  lines: SyntaxSegment[][],
  colors: ThemeColors
) => {
  const rawLines = code.split("\n");
  if (rawLines.length !== lines.length) {
    return lines;
  }
  const result = [...lines];
  for (const fence of findFences(rawLines)) {
    const body = rawLines.slice(fence.start, fence.end).join("\n");
    const segments = highlightSegments(body, fence.language, colors);
    if (!segments) {
      continue;
    }
    const nested = splitLines(segments);
    for (const [offset, line] of nested.entries()) {
      result[fence.start + offset] = line;
    }
  }
  return result;
};

export const highlightLines = (
  code: string,
  language: string | undefined,
  colors: ThemeColors
): SyntaxSegment[][] | null => {
  const segments = highlightSegments(code, language, colors);
  if (!segments) {
    return null;
  }
  const lines = splitLines(segments);
  return language && markdownLanguages.has(language.toLowerCase())
    ? nestFences(code, lines, colors)
    : lines;
};
