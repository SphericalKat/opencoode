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

const json = (value: unknown): JsonValue => {
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
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, json(item)])
    );
  }
  return null;
};

const jsonObject = (value: object): Record<string, JsonValue> =>
  Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, json(item)])
  );

const textOf = (message: PiMessage): string =>
  message.content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n\n");

const activityNotice = (snapshot: PiSnapshot): string | undefined =>
  snapshot.waiting
    ? `${snapshot.waiting.title || "Pi needs input"}. Continue in the Pi terminal.`
    : undefined;

const resultContent = (
  content?: PiContent[],
  output?: string
): [ToolContent, ...ToolContent[]] => {
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
};

const toolErrorMessage = (
  activity?: PiToolActivity,
  result?: PiMessage
): string =>
  result?.errorMessage ||
  activity?.output ||
  (result && textOf(result)) ||
  "Pi reported a tool error";

const toolState = (
  argumentsValue: Record<string, JsonValue>,
  content: [ToolContent, ...ToolContent[]],
  activity?: PiToolActivity,
  result?: PiMessage
): SessionMessageAssistantTool["state"] => {
  if (activity?.status === "error" || result?.isError) {
    return {
      content,
      error: {
        message: toolErrorMessage(activity, result),
        type: "tool-error",
      },
      input: argumentsValue,
      status: "error",
    };
  }
  if (activity?.status === "completed" || result) {
    return {
      content,
      input: argumentsValue,
      status: "completed",
    };
  }
  return {
    input: argumentsValue,
    metadata: activity?.output === undefined ? {} : { output: activity.output },
    status: "running",
  };
};

const toolPart = (
  id: string,
  name: string,
  input: Record<string, unknown>,
  created: number,
  activity?: PiToolActivity,
  result?: PiMessage
): SessionMessageAssistantTool => {
  const argumentsValue = jsonObject(activity?.input ?? input);
  const content = resultContent(
    result?.content ?? activity?.content,
    activity?.output
  );
  return {
    id,
    name,
    state: toolState(argumentsValue, content, activity, result),
    time: { created },
    type: "tool",
  };
};

type ToolActivities = Map<string, PiToolActivity>;
type ToolResults = Map<string, PiMessage>;

const timeRange = (messages: PiMessage[]) => {
  let created = 0;
  let updated = 0;
  for (const message of messages) {
    if (message.timestamp > 0) {
      if (!created || message.timestamp < created) {
        created = message.timestamp;
      }
      if (message.timestamp > updated) {
        updated = message.timestamp;
      }
    }
  }
  return { created, updated };
};

const userMessage = (message: PiMessage): SessionMessageInfo => {
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
  return {
    id: message.id,
    text: textOf(message),
    time: { created: message.timestamp },
    type: "user",
    ...(files.length ? { files } : {}),
  };
};

const assistantMessage = (
  message: PiMessage,
  model: SessionMessageAssistant["model"] | undefined,
  activities: ToolActivities,
  results: ToolResults
): SessionMessageInfo => {
  const content: SessionMessageAssistant["content"] = message.content.flatMap(
    (part): SessionMessageAssistant["content"] => {
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
    }
  );
  return {
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
  };
};

const systemMessage = (message: PiMessage): SessionMessageInfo | undefined => {
  const text = textOf(message);
  if (!(text || message.errorMessage)) {
    return undefined;
  }
  return {
    id: message.id,
    text: [text, message.errorMessage].filter(Boolean).join("\n\n"),
    time: { created: message.timestamp },
    type: "system",
  };
};

const isOrphanResult = (message: PiMessage, calls: Set<string>): boolean =>
  message.role === "custom" ||
  !message.toolCallId ||
  !calls.has(message.toolCallId);

const normalizeMessage = (
  message: PiMessage,
  model: SessionMessageAssistant["model"] | undefined,
  activities: ToolActivities,
  results: ToolResults,
  calls: Set<string>
): SessionMessageInfo | undefined => {
  if (message.role === "user") {
    return userMessage(message);
  }
  if (message.role === "assistant") {
    return assistantMessage(message, model, activities, results);
  }
  if (isOrphanResult(message, calls)) {
    return systemMessage(message);
  }
  return undefined;
};

const withOrphanTools = (
  messages: SessionMessageInfo[],
  snapshot: PiSnapshot,
  calls: Set<string>,
  results: ToolResults
) => {
  const lastAssistantIndex = messages.findLastIndex(
    (message) => message.type === "assistant"
  );
  const lastAssistant = messages[lastAssistantIndex];
  if (lastAssistant?.type !== "assistant") {
    return;
  }
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
};

const isCacheHit = (
  cached: MessageCache extends WeakMap<PiMessage, infer V>
    ? V | undefined
    : never,
  modelKey: string,
  dependencies: unknown[]
): boolean =>
  cached?.model === modelKey &&
  cached.dependencies.length === dependencies.length &&
  dependencies.every(
    (dependency, index) => dependency === cached.dependencies[index]
  );

const normalize = (
  snapshot: PiSnapshot,
  cache: MessageCache
): ChatBackendSnapshot => {
  const { session } = snapshot;
  const model = session.model
    ? {
        id: session.model.id,
        providerID: session.model.provider,
        variant: session.thinkingLevel,
      }
    : undefined;
  const { created, updated } = timeRange(snapshot.messages);
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
    if (cached && isCacheHit(cached, modelKey, dependencies)) {
      messages.push(cached.message);
      continue;
    }
    const normalized = normalizeMessage(
      message,
      model,
      activities,
      results,
      calls
    );
    if (normalized) {
      messages.push(normalized);
      if (message.role !== "toolResult") {
        cache.set(message, {
          dependencies,
          message: normalized,
          model: modelKey,
        });
      }
    }
  }
  withOrphanTools(messages, snapshot, calls, results);
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
};

const normalizeModel = (model: PiModel): ModelInfo => ({
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
});

const applyBatch = (snapshot: PiSnapshot, batch: PiEventBatch): PiSnapshot => {
  const messages = new Map(
    snapshot.messages.map((message) => [message.id, message])
  );
  const tools = new Map(snapshot.tools.map((tool) => [tool.id, tool]));
  let { session, waiting } = snapshot;
  for (const event of batch.events) {
    if (event.type === "message") {
      messages.set(event.message.id, event.message);
    }
    if (event.type === "tool") {
      tools.set(event.tool.id, event.tool);
    }
    if (event.type === "session") {
      ({ session } = event);
    }
    if (event.type === "waiting") {
      ({ waiting } = event);
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
};

const dataURIPattern = /^data:(?<mime>[^;,]+);base64,(?<data>[\s\S]*)$/u;
const remoteURIPattern = /^https?:\/\//iu;
const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/u;

const extensionMimeTypes: Record<string, string> = {
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const readImageFile = async (file: {
  uri: string;
  name?: string;
}): Promise<string> => {
  if (remoteURIPattern.test(file.uri)) {
    throw new Error("Attach an image from this device");
  }
  const source = new File(file.uri);
  if (!source.exists) {
    throw new Error(
      `${file.name || "An attached image"} is no longer on this device. Remove it and attach it again.`
    );
  }
  if (source.size > imageLimit) {
    throw new Error(`${file.name || "An image"} exceeds the 3 MB image limit`);
  }
  return await source.base64();
};

const imageAttachment = async (file: {
  uri: string;
  name?: string;
}): Promise<{ mimeType: string; data: string }> => {
  const dataURI = dataURIPattern.exec(file.uri);
  const extension = (file.name || file.uri).split(".").pop()?.toLowerCase();
  const mimeType =
    dataURI?.groups?.mime ??
    (extension === undefined ? undefined : extensionMimeTypes[extension]) ??
    "";
  if (!imageTypes.has(mimeType)) {
    throw new Error("Attach a PNG, JPEG, WebP, or GIF image");
  }
  const data = dataURI?.groups?.data ?? (await readImageFile(file));
  if (!data || data.length % 4 !== 0 || !base64Pattern.test(data)) {
    throw new Error("The image data is invalid. Attach the image again.");
  }
  if (Math.ceil((data.length * 3) / 4) > imageLimit) {
    throw new Error(`${file.name || "An image"} exceeds the 3 MB image limit`);
  }
  return { data, mimeType };
};

const isResetBatch = (batch: PiEventBatch, value: PiSnapshot): boolean =>
  batch.reset ||
  batch.instanceID !== value.instanceID ||
  batch.events.some(
    (event) =>
      event.type === "reset" ||
      (event.type === "session" && event.session.id !== value.session.id)
  );

export const makePiChatBackend = (
  connection: Connection,
  pi: PiClient = createPiClient(connection)
): ChatBackend => {
  let snapshot: PiSnapshot | undefined;
  let received = 0;
  let version = 0;
  const requests = new Map<AbortSignal | undefined, Promise<PiSnapshot>>();
  const messageCache: MessageCache = new WeakMap();
  const normalized = (value: PiSnapshot) => normalize(value, messageCache);

  const load = async (
    signal?: AbortSignal,
    fresh = false
  ): Promise<PiSnapshot> => {
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
        version += 1;
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
  };

  const current = async (
    sessionID: string,
    signal?: AbortSignal
  ): Promise<PiSnapshot> => {
    const value = await load(signal);
    if (value.session.id !== sessionID) {
      throw new Error(
        "The active Pi session changed. Open the current session again."
      );
    }
    return value;
  };

  const command = async (
    sessionID: string,
    value: PiCommand,
    signal?: AbortSignal
  ): Promise<void> => {
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
  };

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
      compact: ({ sessionID }, options) =>
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
      interrupt: ({ sessionID }, options) =>
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
          ...(after.session.idle
            ? {}
            : { delivery: input.delivery === "queue" ? "followUp" : "steer" }),
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
            if (isResetBatch(batch, value)) {
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
            version += 1;
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
};
