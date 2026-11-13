import type {
  OpenCodeEvent,
  SessionMessageAssistant,
  SessionMessageInfo,
} from "@opencode/client";

export const mergeMessages = (
  ...pages: SessionMessageInfo[][]
): SessionMessageInfo[] => {
  const messages = new Map<string, SessionMessageInfo>();
  for (const page of pages) {
    for (const message of page) {
      messages.set(message.id, message);
    }
  }
  const sorted = [...messages.values()];
  sorted.sort(
    (a, b) => a.time.created - b.time.created || a.id.localeCompare(b.id)
  );
  return sorted;
};

export type ComposerSubmission =
  | { type: "prompt"; text: string }
  | { type: "shell"; command: string }
  | { type: "command"; name: string; text: string };

export const parseComposer = (
  text: string,
  commandNames: string[]
): ComposerSubmission => {
  const trimmed = text.trim();
  if (trimmed.startsWith("!") && trimmed.slice(1).trim()) {
    return { command: trimmed.slice(1).trim(), type: "shell" };
  }
  const command = /^\/(?<name>[^\s]+)(?:\s+(?<text>[\s\S]*))?$/u.exec(trimmed);
  if (command && commandNames.includes(command[1])) {
    return { name: command[1], text: command[2] ?? "", type: "command" };
  }
  return { text: trimmed, type: "prompt" };
};

export const serverFileUri = (path: string): string => {
  if (path.startsWith("file://")) {
    return path;
  }
  if (!path.startsWith("/")) {
    throw new Error("The server file path must be absolute");
  }
  return `file://${path.split("/").map(encodeURIComponent).join("/")}`;
};

export const isAssistantProgress = (event: OpenCodeEvent): boolean =>
  [
    "session.text.started",
    "session.text.delta",
    "session.reasoning.started",
    "session.reasoning.delta",
    "session.tool.input.started",
    "session.tool.input.delta",
    "session.tool.called",
    "session.step.started",
    "session.step.streamed",
    "session.step.ended",
    "session.step.failed",
  ].includes(event.type);

type LiveEvent<T extends OpenCodeEvent["type"]> = Extract<
  OpenCodeEvent,
  { type: T }
>;

interface LiveTarget {
  current: SessionMessageAssistant;
  mutable: () => SessionMessageAssistant;
  fragment: (kind: "text" | "reasoning", ordinal: number) => number;
}

const applyFragmentStarted = (
  event: LiveEvent<"session.text.started" | "session.reasoning.started">,
  { fragment, mutable }: LiveTarget
) => {
  const kind = event.type === "session.text.started" ? "text" : "reasoning";
  if (fragment(kind, event.data.ordinal) < 0) {
    mutable().content.push(
      kind === "reasoning"
        ? { text: "", time: { created: event.created }, type: kind }
        : { text: "", type: kind }
    );
  }
};

const applyFragmentText = (
  event: LiveEvent<
    | "session.text.delta"
    | "session.reasoning.delta"
    | "session.text.ended"
    | "session.reasoning.ended"
  >,
  { fragment, mutable }: LiveTarget
) => {
  const kind = event.type.startsWith("session.text.") ? "text" : "reasoning";
  let index = fragment(kind, event.data.ordinal);
  const assistant = mutable();
  if (index < 0) {
    assistant.content.push(
      kind === "reasoning"
        ? { text: "", time: { created: event.created }, type: kind }
        : { text: "", type: kind }
    );
    index = assistant.content.length - 1;
  }
  const part = assistant.content[index];
  if (part.type === "text" || part.type === "reasoning") {
    assistant.content[index] = {
      ...part,
      text:
        "delta" in event.data ? part.text + event.data.delta : event.data.text,
      ...(part.type === "reasoning" && event.type === "session.reasoning.ended"
        ? {
            time: {
              completed: event.created,
              created: part.time?.created ?? event.created,
            },
          }
        : {}),
    };
  }
};

const applyToolInputStarted = (
  event: LiveEvent<"session.tool.input.started">,
  { current, mutable }: LiveTarget
) => {
  if (
    !current.content.some(
      (part) => part.type === "tool" && part.id === event.data.id
    )
  ) {
    mutable().content.push({
      id: event.data.id,
      name: event.data.name,
      state: { input: "", status: "streaming" },
      time: { created: event.created },
      type: "tool",
    });
  }
};

type ToolEvent = LiveEvent<
  | "session.tool.input.delta"
  | "session.tool.input.ended"
  | "session.tool.called"
  | "session.tool.progress"
  | "session.tool.success"
  | "session.tool.failed"
>;

type ToolPart = Extract<
  SessionMessageAssistant["content"][number],
  {
    type: "tool";
  }
>;

const toolEventApplies = (event: ToolEvent, part: ToolPart): boolean => {
  if (
    (event.type === "session.tool.input.delta" ||
      event.type === "session.tool.input.ended") &&
    part.state.status !== "streaming"
  ) {
    return false;
  }
  if (
    event.type === "session.tool.progress" &&
    part.state.status !== "running"
  ) {
    return false;
  }
  return true;
};

const applyToolInputEvent = (event: ToolEvent, tool: ToolPart) => {
  if (
    event.type === "session.tool.input.delta" &&
    tool.state.status === "streaming"
  ) {
    tool.state = {
      input: tool.state.input + event.data.delta,
      status: "streaming",
    };
  }
  if (
    event.type === "session.tool.input.ended" &&
    tool.state.status === "streaming"
  ) {
    tool.state = { input: event.data.text, status: "streaming" };
  }
  if (event.type === "session.tool.called") {
    tool.executed = event.data.executed;
    tool.state = {
      input: event.data.input,
      metadata: {},
      status: "running",
    };
    tool.time.ran = event.created;
  }
  if (
    event.type === "session.tool.progress" &&
    tool.state.status === "running"
  ) {
    tool.state = {
      ...tool.state,
      metadata: { ...tool.state.metadata, ...event.data },
    };
  }
};

const applyToolResultEvent = (event: ToolEvent, tool: ToolPart) => {
  if (event.type === "session.tool.success") {
    tool.state = {
      content: event.data.content,
      input: typeof tool.state.input === "string" ? {} : tool.state.input,
      metadata: event.data.metadata,
      status: "completed",
    };
    tool.time.completed = event.created;
  }
  if (event.type === "session.tool.failed") {
    tool.state = {
      content: event.data.content,
      error: event.data.error,
      input: typeof tool.state.input === "string" ? {} : tool.state.input,
      metadata: event.data.metadata,
      status: "error",
    };
    tool.time.completed = event.created;
  }
};

const applyToolEvent = (event: ToolEvent, { current, mutable }: LiveTarget) => {
  const index = current.content.findIndex(
    (part) => part.type === "tool" && part.id === event.data.id
  );
  const part = current.content[index];
  if (!part || part.type !== "tool") {
    return;
  }
  if (!toolEventApplies(event, part)) {
    return;
  }
  const tool = { ...part, time: { ...part.time } };
  applyToolInputEvent(event, tool);
  applyToolResultEvent(event, tool);
  mutable().content[index] = tool;
};

const applyStepEvent = (
  event: LiveEvent<
    | "session.step.streamed"
    | "session.step.ended"
    | "session.step.failed"
    | "session.retry.scheduled"
  >,
  { mutable }: LiveTarget
) => {
  switch (event.type) {
    case "session.step.streamed": {
      mutable().time.streamed = event.created;
      break;
    }
    case "session.step.ended": {
      const assistant = mutable();
      assistant.time.completed = event.created;
      assistant.finish = event.data.finish;
      assistant.cost = event.data.cost;
      assistant.tokens = event.data.tokens;
      break;
    }
    case "session.step.failed": {
      const assistant = mutable();
      assistant.time.completed = event.created;
      assistant.finish = "error";
      assistant.error = event.data.error;
      break;
    }
    case "session.retry.scheduled": {
      mutable().retry = {
        at: event.data.at,
        attempt: event.data.attempt,
        error: event.data.error,
      };
      break;
    }
    default: {
      break;
    }
  }
};

const applyLiveEvent = (event: OpenCodeEvent, target: LiveTarget) => {
  switch (event.type) {
    case "session.text.started":
    case "session.reasoning.started": {
      applyFragmentStarted(event, target);
      break;
    }
    case "session.text.delta":
    case "session.reasoning.delta":
    case "session.text.ended":
    case "session.reasoning.ended": {
      applyFragmentText(event, target);
      break;
    }
    case "session.tool.input.started": {
      applyToolInputStarted(event, target);
      break;
    }
    case "session.tool.input.delta":
    case "session.tool.input.ended":
    case "session.tool.called":
    case "session.tool.progress":
    case "session.tool.success":
    case "session.tool.failed": {
      applyToolEvent(event, target);
      break;
    }
    case "session.step.streamed":
    case "session.step.ended":
    case "session.step.failed":
    case "session.retry.scheduled": {
      applyStepEvent(event, target);
      break;
    }
    default: {
      break;
    }
  }
};

export const projectLiveEvents = (
  messages: SessionMessageInfo[],
  events: OpenCodeEvent[],
  sessionID: string
): SessionMessageInfo[] => {
  if (!events.length) {
    return messages;
  }
  const indices = new Map(
    messages.map((message, index) => [message.id, index])
  );
  const changed = new Set<string>();
  let next = messages;
  let inserted = false;
  const store = (assistant: SessionMessageAssistant) => {
    if (next === messages) {
      next = [...messages];
    }
    const index = indices.get(assistant.id);
    if (index === undefined) {
      indices.set(assistant.id, next.length);
      next.push(assistant);
      inserted = true;
    } else {
      next[index] = assistant;
    }
    changed.add(assistant.id);
    return assistant;
  };
  for (const event of events) {
    if (
      !("sessionID" in event.data) ||
      event.data.sessionID !== sessionID ||
      !("assistantMessageID" in event.data)
    ) {
      continue;
    }
    const messageID = event.data.assistantMessageID;
    if (event.type === "session.step.started") {
      store({
        agent: event.data.agent,
        content: [],
        id: messageID,
        model: event.data.model,
        time: { created: event.data.started },
        type: "assistant",
      });
      continue;
    }
    const index = indices.get(messageID);
    const current = index === undefined ? undefined : next[index];
    if (!current || current.type !== "assistant") {
      continue;
    }
    const mutable = () =>
      changed.has(messageID)
        ? current
        : store({
            ...current,
            content: [...current.content],
            time: { ...current.time },
          });
    if (current.retry && isAssistantProgress(event)) {
      delete mutable().retry;
    }
    const fragment = (kind: "text" | "reasoning", ordinal: number) => {
      let count = 0;
      return current.content.findIndex((part) => {
        if (part.type !== kind) {
          return false;
        }
        const matches = count === ordinal;
        count += 1;
        return matches;
      });
    };
    applyLiveEvent(event, { current, fragment, mutable });
  }
  if (inserted) {
    next.sort(
      (a, b) => a.time.created - b.time.created || a.id.localeCompare(b.id)
    );
  }
  return next;
};

export const projectLiveEvent = (
  messages: SessionMessageInfo[],
  event: OpenCodeEvent,
  sessionID: string
): SessionMessageInfo[] => projectLiveEvents(messages, [event], sessionID);
