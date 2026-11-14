import type {
  JsonValue,
  SessionMessageAssistantTool,
  SessionMessageInfo,
} from "@opencode/client";

type Arguments = Record<string, JsonValue>;
type ModelSwitchMessage = Extract<
  SessionMessageInfo,
  { type: "model-switched" }
>;

const hashSuffixPattern = /^(?<path>.*?)#L\d+(?:C\d+)?(?:-L?\d+(?:C\d+)?)?$/iu;
const colonSuffixPattern = /^(?<path>.*?):\d+(?::\d+)?(?:-\d+(?::\d+)?)?:?$/u;
const driveLetterPattern = /^[a-z]:?$/iu;

export const parsePathLineSuffix = (input: string): { path: string } => {
  const hashPath = hashSuffixPattern.exec(input)?.groups?.path;
  if (hashPath !== undefined) {
    return { path: hashPath };
  }
  const colonPath = colonSuffixPattern.exec(input)?.groups?.path;
  if (colonPath !== undefined && !driveLetterPattern.test(colonPath)) {
    return { path: colonPath };
  }
  return { path: input };
};

const extensionlessFileNames = new Set([
  "CHANGELOG",
  "CODEOWNERS",
  "Containerfile",
  "Dockerfile",
  "Gemfile",
  "Justfile",
  "LICENSE",
  "Makefile",
  "Procfile",
  "README",
  "Rakefile",
  "Vagrantfile",
]);

const httpUrlPattern = /^https?:\/\//iu;
const urlStartPattern = /https?:\/\//u;
const schemeUrlPattern = /^[a-z][a-z0-9+.-]*:\/\//iu;
const whitespacePattern = /\s/u;
const codeCharacterPattern = /[{}<>"'`;=|&*,]/u;
const networkSharePattern = /^[\\/]{2}/u;
const pathSeparatorPattern = /[./\\]/u;
const letterPattern = /[a-z]/iu;

export const inlineCodeKind = (text: string): "path" | "url" | undefined => {
  if (httpUrlPattern.test(text)) {
    return "url";
  }
  if (
    !text ||
    whitespacePattern.test(text) ||
    schemeUrlPattern.test(text) ||
    codeCharacterPattern.test(text) ||
    networkSharePattern.test(text)
  ) {
    return;
  }
  const { path } = parsePathLineSuffix(text);
  if (extensionlessFileNames.has(path)) {
    return "path";
  }
  if (pathSeparatorPattern.test(path) && letterPattern.test(path)) {
    return "path";
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

// A JSON string that itself holds JSON is unwrapped once.
const readJson = (value: string): unknown => {
  const first = parseJson(value);
  return typeof first === "string" ? parseJson(first.trim()) : first;
};

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const errorEnvelopeMessage = (
  envelope: Record<string, unknown>
): string | undefined => {
  const error = isRecord(envelope.error) ? envelope.error : undefined;
  const type = nonEmptyString(error?.type);
  const message = nonEmptyString(error?.message);
  if (type && message) {
    return `${type}: ${message}`;
  }
  return (
    message ??
    type ??
    nonEmptyString(error?.code) ??
    nonEmptyString(envelope.message) ??
    nonEmptyString(envelope.error)
  );
};

export const unwrapErrorMessage = (message: string): string => {
  const text = message.replace(/^Error:\s*/u, "").trim();
  const whole = readJson(text);
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  const json =
    whole === undefined && start !== -1 && end > start
      ? readJson(text.slice(start, end + 1))
      : whole;
  if (!isRecord(json)) {
    return message;
  }
  return errorEnvelopeMessage(json) ?? message;
};

export const splitErrorTitle = (
  message: string
): { title?: string; detail: string } => {
  const url = message.search(urlStartPattern);
  const separator = message.slice(0, url === -1 ? undefined : url).indexOf(":");
  if (separator === -1) {
    return { detail: message };
  }
  return {
    detail: message.slice(separator + 1),
    title: message.slice(0, separator + 1),
  };
};

export const isInterruptedError = (error?: { type: string }): boolean => {
  const type = error?.type.toLowerCase() ?? "";
  return type.includes("abort") || type.includes("interrupt");
};

const hasFailure = (error?: { type: string }): boolean =>
  error !== undefined && !isInterruptedError(error);

const failedIdleIsDuplicate = (
  messages: SessionMessageInfo[],
  index: number
): boolean => {
  const previous = messages[index - 1];
  if (
    previous?.type === "compaction" &&
    previous.status === "failed" &&
    hasFailure(previous.error)
  ) {
    return true;
  }
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = messages[cursor];
    if (candidate.type === "user") {
      return false;
    }
    if (candidate.type === "assistant") {
      return hasFailure(candidate.error);
    }
    if (candidate.type === "idle") {
      return false;
    }
  }
  return false;
};

export const visibleTranscriptMessages = (
  messages: SessionMessageInfo[]
): SessionMessageInfo[] =>
  messages.filter((message, index) => {
    if (message.type !== "idle") {
      return true;
    }
    return (
      message.error !== undefined && !failedIdleIsDuplicate(messages, index)
    );
  });

const nameOf = (name: string): string =>
  name
    .replace(/^.*[.:]/u, "")
    .replaceAll(/[_-]/gu, "")
    .toLowerCase();

const toolNames: Record<string, string> = {
  applypatch: "Patch",
  bash: "Shell",
  edit: "Edit",
  editfile: "Edit",
  execute: "Execute",
  fetch: "Web fetch",
  glob: "Glob",
  grep: "Grep",
  list: "List",
  ls: "List",
  patch: "Patch",
  read: "Read",
  readfile: "Read",
  shell: "Shell",
  subagent: "Agent",
  task: "Task",
  webfetch: "Web fetch",
  websearch: "Web search",
  write: "Write",
  writefile: "Write",
};

export const toolDisplayName = (name: string): string =>
  toolNames[nameOf(name)] ??
  name.replace(/^.*[.:]/u, "").replaceAll(/[_-]/gu, " ");

export interface ToolRow {
  title: string;
  subtitle?: string;
  args: string[];
  matches?: string;
  expandable: boolean;
  kind: "read" | "search" | "other";
}

const text = (
  input: Arguments | undefined,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = input?.[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
};

const baseName = (path: string | undefined): string | undefined => {
  if (!path) {
    return;
  }
  const trimmed = path.replace(/[/\\]+$/u, "");
  return (
    trimmed.slice(
      Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\")) + 1
    ) || undefined
  );
};

const relativePath = (
  path: string | undefined,
  directory: string
): string | undefined => {
  if (!path || path === directory) {
    return;
  }
  const prefix = `${directory}/`;
  return directory && path.startsWith(prefix)
    ? path.slice(prefix.length)
    : path;
};

const number = (value: JsonValue | undefined): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const matchCount = (count: number | undefined): string | undefined => {
  if (count === undefined) {
    return;
  }
  return `${count} ${count === 1 ? "match" : "matches"}`;
};

const hasOutput = (tool: SessionMessageAssistantTool): boolean => {
  const { state } = tool;
  if (state.status === "streaming") {
    return false;
  }
  if (state.status === "running") {
    return (
      typeof state.metadata.output === "string" &&
      state.metadata.output.length > 0
    );
  }
  return (state.content ?? []).some(
    (item) => item.type === "text" && item.text.length > 0
  );
};

const pathInput = (input: Arguments): string | undefined =>
  text(input, "filePath", "file_path", "path");

const prefixed = (key: string, value: string | undefined): string[] =>
  value ? [`${key}=${value}`] : [];

const searchInfo = (
  name: string,
  input: Arguments,
  metadata: Arguments | undefined,
  directory: string
): Pick<ToolRow, "args" | "matches" | "subtitle"> => {
  const subtitle = relativePath(text(input, "path"), directory);
  const pattern = text(input, "pattern");
  if (name === "Glob") {
    return {
      args: prefixed("pattern", pattern),
      matches: matchCount(number(metadata?.count)),
      subtitle,
    };
  }
  if (name === "Grep") {
    return {
      args: [
        ...prefixed("pattern", pattern),
        ...prefixed("include", text(input, "include")),
      ],
      matches: matchCount(number(metadata?.matches)),
      subtitle,
    };
  }
  return { args: [], subtitle };
};

const otherSubtitle = (name: string, input: Arguments): string | undefined => {
  switch (name) {
    case "Shell": {
      return text(input, "description", "command");
    }
    case "Web fetch": {
      return text(input, "url");
    }
    case "Web search": {
      return text(input, "query");
    }
    case "Agent":
    case "Task": {
      return text(input, "description", "prompt");
    }
    case "Edit":
    case "Write":
    case "Patch": {
      return baseName(pathInput(input));
    }
    case "Execute": {
      return text(input, "description");
    }
    default: {
      return text(
        input,
        "description",
        "command",
        "filePath",
        "file_path",
        "path",
        "pattern",
        "url",
        "query"
      );
    }
  }
};

export const toolRow = (
  tool: SessionMessageAssistantTool,
  directory: string
): ToolRow => ({
  title: toolDisplayName(tool.name),
  ...toolRowBody(tool, directory),
});

const toolRowBody = (
  tool: SessionMessageAssistantTool,
  directory: string
): Omit<ToolRow, "title"> => {
  const title = toolDisplayName(tool.name);
  const { state } = tool;
  const streaming = state.status === "streaming";
  const input: Arguments | undefined = streaming ? undefined : state.input;
  const metadata =
    streaming || !("metadata" in state) ? undefined : state.metadata;
  const isRead = title === "Read";
  const isSearch = title === "List" || title === "Glob" || title === "Grep";
  if (!isRead && !isSearch) {
    return {
      args: [],
      expandable: true,
      kind: "other",
      subtitle: input ? otherSubtitle(title, input) : undefined,
    };
  }
  const expandable = state.status !== "error" && hasOutput(tool);
  if (!input) {
    return { args: [], expandable, kind: isRead ? "read" : "search" };
  }
  if (isRead) {
    const offset = number(input.offset);
    const limit = number(input.limit);
    return {
      args: [
        ...(offset === undefined ? [] : [`offset=${offset}`]),
        ...(limit === undefined ? [] : [`limit=${limit}`]),
      ],
      expandable,
      kind: "read",
      subtitle: baseName(pathInput(input)),
    };
  }
  return {
    ...searchInfo(title, input, metadata, directory),
    expandable,
    kind: "search",
  };
};

const sameModel = (
  a: { id: string; providerID: string },
  b: { id: string; providerID: string }
): boolean => a.id === b.id && a.providerID === b.providerID;

export const modelSwitchLabel = (
  message: ModelSwitchMessage,
  modelName?: string
): { label: string; variant?: string } => {
  const { model, previous } = message;
  if (previous && sameModel(previous, model)) {
    const { variant } = model;
    return {
      label: `Switched variant to ${!variant || variant === "default" ? "Default" : variant}`,
    };
  }
  return {
    label: `Switched to ${modelName ?? model.id}`,
    variant: model.variant === "default" ? undefined : model.variant,
  };
};

export const agentSwitchLabel = (agent: string): string =>
  `Switched to ${agent.charAt(0).toUpperCase()}${agent.slice(1)}`;

const minimumColumnWidth = 48;

const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

const floorToAvailable = (widths: number[], available: number): number[] => {
  const floored = widths.map((width) => Math.floor(width));
  if (floored.length > 0) {
    floored[floored.length - 1] += available - sum(floored);
  }
  return floored;
};

export const tableColumnWidths = ({
  available,
  maxContent,
  minContent,
}: {
  maxContent: number[];
  minContent: number[];
  available: number;
}): { widths: number[]; scroll: boolean } => {
  const max = maxContent.map((value) => Math.max(value, minimumColumnWidth));
  const min = minContent.map((value, index) =>
    Math.min(
      Math.max(value, minimumColumnWidth),
      max[index] ?? minimumColumnWidth
    )
  );
  const maxTotal = sum(max);
  if (maxTotal <= available) {
    const extra = available - maxTotal;
    return {
      scroll: false,
      widths: floorToAvailable(
        max.map((value) => value + (extra * value) / maxTotal),
        available
      ),
    };
  }
  const minTotal = sum(min);
  if (minTotal <= available) {
    const spread = sum(max.map((value, index) => value - (min[index] ?? 0)));
    const extra = available - minTotal;
    return {
      scroll: false,
      widths: floorToAvailable(
        min.map((value, index) =>
          spread === 0
            ? value
            : value + (extra * ((max[index] ?? 0) - value)) / spread
        ),
        available
      ),
    };
  }
  return { scroll: true, widths: min };
};
