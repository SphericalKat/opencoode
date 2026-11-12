import type {
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionMessageInfo,
  SessionStatus,
} from "@opencode/client";

export interface AgentActivity {
  kind:
    | "idle"
    | "working"
    | "thinking"
    | "writing"
    | "tool"
    | "retry"
    | "approval"
    | "question"
    | "compaction"
    | "shell"
    | "error";
  label: string;
  messageID?: string;
  partIndex?: number;
  retry?: { attempt: number; at: number; message: string };
}

export const toolActivityLabel = (
  tool: SessionMessageAssistantTool
): string => {
  const name = tool.name.replace(/^.*[.:]/u, "").replaceAll(/[_-]/gu, " ");
  if (tool.state.status === "streaming") {
    return `Preparing ${["shell", "bash"].includes(name) ? "command" : name}`;
  }
  const labels: Record<string, [string, string]> = {
    bash: ["Running command", "Ran command"],
    edit: ["Editing file", "Edited file"],
    execute: ["Running code", "Ran code"],
    glob: ["Finding files", "Found files"],
    grep: ["Searching files", "Searched files"],
    patch: ["Applying patch", "Applied patch"],
    read: ["Reading file", "Read file"],
    shell: ["Running command", "Ran command"],
    subagent: ["Running subagent", "Subagent finished"],
    webfetch: ["Fetching page", "Fetched page"],
    websearch: ["Searching the web", "Searched the web"],
    write: ["Writing file", "Wrote file"],
  };
  return tool.state.status === "completed"
    ? labels[name]?.[1] || `${name} completed`
    : labels[name]?.[0] || `Running ${name}`;
};

const pendingInputActivity = (
  permissionCount: number,
  formCount: number
): AgentActivity | undefined => {
  if (permissionCount) {
    return {
      kind: "approval",
      label:
        permissionCount === 1
          ? "Approval needed"
          : `${permissionCount} approvals needed`,
    };
  }
  if (formCount) {
    return { kind: "question", label: "Waiting for your answer" };
  }
  return undefined;
};

const currentRetry = (
  status: SessionStatus | null,
  assistant: SessionMessageAssistant | undefined
): AgentActivity["retry"] => {
  if (status?.type === "retry") {
    return {
      at: status.next,
      attempt: status.attempt,
      message: status.message,
    };
  }
  if (!status && assistant?.retry) {
    return {
      at: assistant.retry.at,
      attempt: assistant.retry.attempt,
      message: assistant.retry.error.message,
    };
  }
  return undefined;
};

const messageActivity = (
  current: SessionMessageInfo | undefined
): AgentActivity | undefined => {
  if (current?.type === "assistant" && current.error) {
    return { kind: "error", label: "Agent encountered an error" };
  }
  if (current?.type === "compaction" && current.status === "running") {
    return { kind: "compaction", label: "Compacting context" };
  }
  if (current?.type === "shell" && current.status === "running") {
    return { kind: "shell", label: "Running command" };
  }
  return undefined;
};

const assistantActivity = (
  assistant: SessionMessageAssistant
): AgentActivity | undefined => {
  const partIndex = assistant.content.length - 1;
  const part = assistant.content[partIndex];
  const location = { messageID: assistant.id, partIndex };
  const tool = assistant.content.findLast(
    (candidate) =>
      candidate.type === "tool" &&
      (candidate.state.status === "streaming" ||
        candidate.state.status === "running")
  );
  if (tool?.type === "tool") {
    return {
      kind: "tool",
      label: toolActivityLabel(tool),
      messageID: assistant.id,
    };
  }
  if (part?.type === "reasoning" && part.time?.completed === undefined) {
    return { kind: "thinking", label: "Thinking", ...location };
  }
  if (
    part?.type === "text" &&
    part.text.trim() &&
    assistant.time.streamed === undefined
  ) {
    return { kind: "writing", label: "Writing", ...location };
  }
  return undefined;
};

export const sessionActivity = (
  messages: SessionMessageInfo[],
  active: boolean,
  status: SessionStatus | null,
  permissionCount: number,
  formCount: number
): AgentActivity => {
  const pending = pendingInputActivity(permissionCount, formCount);
  if (pending) {
    return pending;
  }
  if (!active) {
    return { kind: "idle", label: "" };
  }
  const current = messages.findLast((message) =>
    ["assistant", "idle", "user", "shell", "compaction"].includes(message.type)
  );
  const assistant: SessionMessageAssistant | undefined =
    current?.type === "assistant" &&
    current.time.completed === undefined &&
    !current.error
      ? current
      : undefined;
  const retry = currentRetry(status, assistant);
  if (retry) {
    return { kind: "retry", label: "Retrying", retry };
  }
  const fromMessage = messageActivity(current);
  if (fromMessage) {
    return fromMessage;
  }
  const fromAssistant = assistant ? assistantActivity(assistant) : undefined;
  return fromAssistant ?? { kind: "working", label: "Working" };
};
