import type {
  JsonValue,
  ModelInfo,
  SessionInfo,
  SessionMessageAssistant,
  SessionMessageAssistantTool,
  SessionMessageInfo,
  ToolContent,
} from "@opencode/client";
import { File } from "expo-file-system";

import type {
  PiContent,
  PiCommand,
  PiEventBatch,
  PiMessage,
  PiModel,
  PiSnapshot,
  PiToolActivity,
} from "../../packages/pi-mobile/protocol";
import type {
  ChatBackend,
  ChatBackendSnapshot,
  ChatCore,
} from "./chat-backend";
import type { Connection } from "./client";
import { createPiClient } from "./pi-client";
import type { PiClient } from "./pi-client";

const imageLimit = 3_000_000;
const bodyLimit = 5_000_000;
const imageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);
type MessageCache = WeakMap<
  PiMessage,
  { model: string; dependencies: unknown[]; message: SessionMessageInfo }
>;

function json(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (Array.isArray(value)) {
    return value.map(json);
  }
  if (typeof value === "object" && value) {
    return jsonObject(value);
  }
  return null;
}

function jsonObject(value: object): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, json(item)])
  );
}

function textOf(message: PiMessage): string {
  return message.content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n");
}

function activityNotice(snapshot: PiSnapshot): string | undefined {
  return snapshot.waiting
    ? `${snapshot.waiting.title || "Pi needs input"}. Continue in the Pi terminal.`
    : undefined;
}

function resultContent(
  content?: PiContent[],
  output?: string
): [ToolContent, ...ToolContent[]] {
  const parts: ToolContent[] =
    content?.flatMap((part): ToolContent[] => {
      if (part.type === "text") {
        return [{ text: part.text, type: "text" }];
      }
      if (part.type === "image") {
        return [
          {
            mime: part.mimeType,
            type: "file",
            uri: `data:${part.mimeType};base64,${part.data}`,
          },
        ];
      }
      return [];
    }) ?? [];
  if (output !== undefined) {
    const images = parts.filter((part) => part.type === "file");
    return [{ text: output, type: "text" }, ...images];
  }
  const [first, ...rest] = parts;
  return [first ?? { text: "", type: "text" }, ...rest];
}

function toolPart(
  id: string,
  name: string,
  input: Record<string, unknown>,
  created: number,
  activity?: PiToolActivity,
  result?: PiMessage
): SessionMessageAssistantTool {
  const argumentsValue = jsonObject(activity?.input ?? input);
  const content = resultContent(
    result?.content ?? activity?.content,
    activity?.output
  );
  const failed = activity?.status === "error" || result?.isError;
  return {
    id,
    name,
    state: failed
      ? {
          content,
          error: {
            message:
              result?.errorMessage ||
              activity?.output ||
              (result && textOf(result)) ||
              "Pi reported a tool error",
            type: "tool-error",
          },
          input: argumentsValue,
          status: "error",
        }
      : activity?.status === "completed" || result
        ? {
            content,
            input: argumentsValue,
            status: "completed",
          }
        : {
            input: argumentsValue,
            metadata:
              activity?.output === undefined ? {} : { output: activity.output },
            status: "running",
          },
    time: { created },
    type: "tool",
  };
}

function normalize(
  snapshot: PiSnapshot,
  cache: MessageCache
): ChatBackendSnapshot {
  const { session } = snapshot;
  const model = session.model
    ? {
        id: session.model.id,
        providerID: session.model.provider,
        variant: session.thinkingLevel,
      }
    : undefined;
  let created = 0;
  let updated = 0;
  for (const message of snapshot.messages) {
    if (message.timestamp > 0) {
      if (!created || message.timestamp < created) {
        created = message.timestamp;
      }
      if (message.timestamp > updated) {
        updated = message.timestamp;
      }
    }
  }
  const sessionInfo: SessionInfo = {
    cost: 0,
    id: session.id,
    location: { directory: session.cwd },
    model,
    projectID: session.cwd,
    time: { created, updated },
    title: session.name,
    tokens: { cache: { read: 0, write: 0 }, input: 0, output: 0, reasoning: 0 },
  };
  const activities = new Map(snapshot.tools.map((tool) => [tool.id, tool]));
  const results = new Map(
    snapshot.messages.flatMap((message) =>
      message.role === "toolResult" && message.toolCallId
        ? [[message.toolCallId, message] as const]
        : []
    )
  );
  const calls = new Set(
    snapshot.messages.flatMap((message) =>
      message.content.flatMap((part) =>
        part.type === "toolCall" ? [part.id] : []
      )
    )
  );
  const messages: SessionMessageInfo[] = [];
  for (const message of snapshot.messages) {
    const modelKey =
      message.role === "assistant" && model
        ? `${model.providerID}/${model.id}/${model.variant}`
        : "";
    const dependencies = message.content.flatMap((part) =>
      part.type === "toolCall"
        ? [activities.get(part.id), results.get(part.id)]
        : []
    );
    const cached =
      message.role === "toolResult" ? undefined : cache.get(message);
    if (
      cached?.model === modelKey &&
      cached.dependencies.length === dependencies.length &&
      dependencies.every(
        (dependency, index) => dependency === cached.dependencies[index]
      )
    ) {
      messages.push(cached.message);
      continue;
    }
    const index = messages.length;
    if (message.role === "user") {
      const files = message.content.flatMap((part) =>
        part.type === "image"
          ? [
              {
                data: part.data,
                mime: part.mimeType,
                source: { type: "inline" as const },
              },
            ]
          : []
      );
      messages.push({
        id: message.id,
        text: textOf(message),
        time: { created: message.timestamp },
        type: "user",
        ...(files.length ? { files } : {}),
      });
    } else if (message.role === "assistant") {
      const content: SessionMessageAssistant["content"] =
        message.content.flatMap((part): SessionMessageAssistant["content"] => {
          if (part.type === "text") {
            return [{ text: part.text, type: "text" }];
          }
          if (part.type === "thinking") {
            return [{ text: part.thinking, type: "reasoning" }];
          }
          if (part.type === "toolCall") {
            return [
              toolPart(
                part.id,
                part.name,
                part.arguments,
                message.timestamp,
                activities.get(part.id),
                results.get(part.id)
              ),
            ];
          }
          return [];
        });
      messages.push({
        agent: "pi",
        content,
        id: message.id,
        model: model ?? { id: "", providerID: "" },
        time: { created: message.timestamp },
        type: "assistant",
        ...(message.errorMessage
          ? {
              error: { message: message.errorMessage, type: "pi-error" },
              finish: "error" as const,
            }
          : {}),
      });
    } else if (
      message.role === "custom" ||
      !message.toolCallId ||
      !calls.has(message.toolCallId)
    ) {
      const text = textOf(message);
      if (text || message.errorMessage) {
        messages.push({
          id: message.id,
          text: [text, message.errorMessage].filter(Boolean).join("\n\n"),
          time: { created: message.timestamp },
          type: "system",
        });
      }
    }
    const normalized = messages[index];
    if (normalized && message.role !== "toolResult") {
      cache.set(message, {
        dependencies,
        message: normalized,
        model: modelKey,
      });
    }
  }
  const lastAssistantIndex = messages.findLastIndex(
    (message) => message.type === "assistant"
  );
  const lastAssistant = messages[lastAssistantIndex];
  if (lastAssistant?.type === "assistant") {
    const orphanTools = snapshot.tools
      .filter((activity) => !calls.has(activity.id))
      .map((activity) =>
        toolPart(
          activity.id,
          activity.name,
          activity.input,
          lastAssistant.time.created,
          activity,
          results.get(activity.id)
        )
      );
    if (orphanTools.length) {
      messages[lastAssistantIndex] = {
        ...lastAssistant,
        content: [...lastAssistant.content, ...orphanTools],
      };
    }
  }
  messages.sort(
    (left, right) =>
      left.time.created - right.time.created || left.id.localeCompare(right.id)
  );
  return {
    active: !session.idle,
    activityNotice: activityNotice(snapshot),
    messages,
    session: sessionInfo,
    status: session.idle ? { type: "idle" } : { type: "busy" },
    ...(snapshot.waiting
      ? {
          waiting: {
            kind:
              snapshot.waiting.kind === "confirm"
                ? ("approval" as const)
                : ("question" as const),
            title: "Continue in the Pi terminal",
          },
        }
      : {}),
  };
}

function normalizeModel(model: PiModel): ModelInfo {
  return {
    capabilities: { input: ["text"], output: ["text"], tools: true },
    cost: [],
    enabled: true,
    id: model.id,
    limit: { context: model.contextWindow, output: 0 },
    modelID: model.id,
    name: model.name,
    providerID: model.provider,
    status: "active",
    time: { released: 0 },
    variants: model.thinkingLevels.map((id) => ({ id })),
  };
}

function applyBatch(snapshot: PiSnapshot, batch: PiEventBatch): PiSnapshot {
  const messages = new Map(
    snapshot.messages.map((message) => [message.id, message])
  );
  const tools = new Map(snapshot.tools.map((tool) => [tool.id, tool]));
  let session = snapshot.session;
  let waiting = snapshot.waiting;
  for (const event of batch.events) {
    if (event.type === "message") {
      messages.set(event.message.id, event.message);
    }
    if (event.type === "tool") {
      tools.set(event.tool.id, event.tool);
    }
    if (event.type === "session") {
      session = event.session;
    }
    if (event.type === "waiting") {
      waiting = event.waiting;
    }
  }
  return {
    cursor: batch.cursor,
    instanceID: batch.instanceID,
    messages: [...messages.values()],
    session,
    tools: [...tools.values()],
    waiting,
  };
}

async function imageAttachment(file: {
  uri: string;
  name?: string;
}): Promise<{ mimeType: string; data: string }> {
  const dataURI = /^data:([^;,]+);base64,([\s\S]*)$/.exec(file.uri);
  const extension = (file.name || file.uri).split(".").pop()?.toLowerCase();
  const mimeType =
    dataURI?.[1] ??
    (extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : extension === "gif"
            ? "image/gif"
            : "");
  if (!imageTypes.has(mimeType)) {
    throw new Error("Attach a PNG, JPEG, WebP, or GIF image");
  }
  let data = dataURI?.[2];
  if (data === undefined) {
    if (/^https?:\/\//i.test(file.uri)) {
      throw new Error("Attach an image from this device");
    }
    const source = new File(file.uri);
    if (!source.exists) {
      throw new Error(
        `${file.name || "An attached image"} is no longer on this device. Remove it and attach it again.`
      );
    }
    if (source.size > imageLimit) {
      throw new Error(
        `${file.name || "An image"} exceeds the 3 MB image limit`
      );
    }
    data = await source.base64();
  }
  if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
    throw new Error("The image data is invalid. Attach the image again.");
  }
  if (Math.ceil((data.length * 3) / 4) > imageLimit) {
    throw new Error(`${file.name || "An image"} exceeds the 3 MB image limit`);
  }
  return { data, mimeType };
}

export function makePiChatBackend(
  connection: Connection,
  pi: PiClient = createPiClient(connection)
): ChatBackend {
  let snapshot: PiSnapshot | undefined;
  let received = 0;
  let version = 0;
  const requests = new Map<AbortSignal | undefined, Promise<PiSnapshot>>();
  const messageCache: MessageCache = new WeakMap();
  const normalized = (value: PiSnapshot) => normalize(value, messageCache);

  async function load(
    signal?: AbortSignal,
    fresh = false
  ): Promise<PiSnapshot> {
    if (signal?.aborted) {
      throw (
        signal.reason ??
        new DOMException("The request was aborted", "AbortError")
      );
    }
    if (!fresh && snapshot && Date.now() - received < 250) {
      return snapshot;
    }
    const pending = requests.get(signal);
    if (pending) {
      return pending;
    }
    const startVersion = version;
    const request = pi.snapshot(signal).then((value) => {
      if (
        version === startVersion ||
        !snapshot ||
        (snapshot.instanceID === value.instanceID &&
          value.cursor >= snapshot.cursor)
      ) {
        snapshot = value;
        received = Date.now();
        version++;
      }
      return snapshot ?? value;
    });
    requests.set(signal, request);
    try {
      return await request;
    } finally {
      if (requests.get(signal) === request) {
        requests.delete(signal);
      }
    }
  }

  async function current(
    sessionID: string,
    signal?: AbortSignal
  ): Promise<PiSnapshot> {
    const value = await load(signal);
    if (value.session.id !== sessionID) {
      throw new Error(
        "The active Pi session changed. Open the current session again."
      );
    }
    return value;
  }

  async function command(
    sessionID: string,
    value: PiCommand,
    signal?: AbortSignal
  ): Promise<void> {
    await current(sessionID, signal);
    const bound = { ...value, expectedSessionID: sessionID };
    if (
      new TextEncoder().encode(JSON.stringify(bound)).byteLength > bodyLimit
    ) {
      throw new Error(
        "The message exceeds the 5 MB limit. Remove an image or shorten the text."
      );
    }
    await pi.command(bound, signal);
    received = 0;
  }

  const core: ChatCore = {
    message: {
      list: async ({ sessionID, type }, options) => {
        const value = normalized(await current(sessionID, options?.signal));
        return {
          cursor: {},
          data: type
            ? value.messages.filter((message) => message.type === type)
            : value.messages,
        };
      },
    },
    model: {
      list: async (_input, options) => {
        const [models, value] = await Promise.all([
          pi.models(options?.signal),
          load(options?.signal),
        ]);
        return {
          data: models.map(normalizeModel),
          location: { directory: value.session.cwd },
        };
      },
    },
    session: {
      active: async (options) => {
        const value = await load(options?.signal);
        return value.session.idle
          ? {}
          : { [value.session.id]: { type: "running" } };
      },
      compact: async ({ sessionID }, options) =>
        command(sessionID, { type: "compact" }, options?.signal),
      fork: async ({ sessionID, before }, options) => {
        const value = await current(sessionID, options?.signal);
        if (
          !before ||
          !value.messages.some(
            (message) => message.id === before && message.role === "user"
          )
        ) {
          throw new Error("Select a user message to fork the Pi session");
        }
        await command(
          sessionID,
          { entryID: before, type: "fork" },
          options?.signal
        );
        return normalized(await load(options?.signal, true)).session;
      },
      get: async ({ sessionID }, options) =>
        normalized(await current(sessionID, options?.signal)).session,
      interrupt: async ({ sessionID }, options) =>
        command(sessionID, { type: "abort" }, options?.signal),
      prompt: async (input, options) => {
        const before = await current(input.sessionID, options?.signal);
        if (before.waiting) {
          throw new Error(
            "Continue in the Pi terminal before you send another message"
          );
        }
        if (input.agents?.length || input.skills?.length) {
          throw new Error("Pi does not support these message attachments");
        }
        const images = await Promise.all(
          (input.files ?? []).map(imageAttachment)
        );
        const after = await current(input.sessionID, options?.signal);
        const value: Extract<PiCommand, { type: "prompt" }> = {
          text: input.text,
          type: "prompt",
          ...(!after.session.idle
            ? { delivery: input.delivery === "queue" ? "followUp" : "steer" }
            : {}),
          ...(images.length ? { images } : {}),
        };
        await command(input.sessionID, value, options?.signal);
      },
      switchModel: async ({ sessionID, model }, options) => {
        const before = await current(sessionID, options?.signal);
        if (!before.session.idle || before.waiting) {
          throw new Error("Stop the current work before you change the model");
        }
        if (
          before.session.model?.id !== model.id ||
          before.session.model.provider !== model.providerID
        ) {
          await command(
            sessionID,
            { id: model.id, provider: model.providerID, type: "model" },
            options?.signal
          );
        }
        if (model.variant !== undefined) {
          await command(
            sessionID,
            { level: model.variant, type: "thinking" },
            options?.signal
          );
        }
      },
      update: async (input, options) => {
        if (
          input.archived !== undefined ||
          input.metadata !== undefined ||
          input.permissions !== undefined
        ) {
          throw new Error("Pi supports session names only");
        }
        if (input.title !== undefined) {
          await command(
            input.sessionID,
            { name: input.title, type: "rename" },
            options?.signal
          );
        }
      },
    },
  };

  return {
    get activityNotice() {
      return snapshot ? activityNotice(snapshot) : undefined;
    },
    canForkMessage: (message) => message.type === "user",
    capabilities: {
      agents: false,
      archive: false,
      attachments: true,
      background: false,
      children: false,
      commands: false,
      compact: true,
      context: false,
      defaultVariant: false,
      delivery: true,
      diff: false,
      export: false,
      files: false,
      forkMessage: true,
      forkSession: false,
      forms: false,
      inbox: false,
      instructions: false,
      move: false,
      permissions: false,
      remove: false,
      rename: true,
      resources: false,
      schedules: false,
      shell: false,
      sideQuestion: false,
      skills: false,
      statistics: false,
    },
    core,
    kind: "pi",
    async *subscribe({ signal }) {
      const controller = new AbortController();
      const abort = () => controller.abort(signal?.reason);
      if (signal?.aborted) {
        abort();
      } else {
        signal?.addEventListener("abort", abort, { once: true });
      }
      try {
        while (!controller.signal.aborted) {
          let value = await load(controller.signal, true);
          if (controller.signal.aborted) {
            return;
          }
          yield normalized(value);
          for await (const batch of pi.events(
            value.cursor,
            value.instanceID,
            controller.signal
          )) {
            if (controller.signal.aborted) {
              return;
            }
            if (
              batch.reset ||
              batch.instanceID !== value.instanceID ||
              batch.events.some(
                (event) =>
                  event.type === "reset" ||
                  (event.type === "session" &&
                    event.session.id !== value.session.id)
              )
            ) {
              break;
            }
            if (
              snapshot?.instanceID === batch.instanceID &&
              snapshot.cursor > value.cursor
            ) {
              value = snapshot;
            }
            if (value.cursor > batch.cursor) {
              continue;
            }
            value = applyBatch(value, batch);
            snapshot = value;
            received = Date.now();
            version++;
            if (batch.events.length) {
              yield normalized(value);
            }
          }
        }
      } finally {
        controller.abort();
        signal?.removeEventListener("abort", abort);
      }
    },
  };
}
