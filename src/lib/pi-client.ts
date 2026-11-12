import type {
  PiCommand,
  PiContent,
  PiEvent,
  PiEventBatch,
  PiMessage,
  PiModel,
  PiServerInfo,
  PiSession,
  PiSessionSummary,
  PiSnapshot,
  PiToolActivity,
} from "../../packages/pi-mobile/protocol";
import type { Connection } from "./client";

type ObjectValue = Record<string, unknown>;

const object = (value: unknown): value is ObjectValue =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const number = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const cursor = (value: unknown): value is number =>
  number(value) && Number.isSafeInteger(value) && value >= 0;

const model = (value: unknown): value is PiModel =>
  object(value) &&
  typeof value.id === "string" &&
  typeof value.provider === "string" &&
  typeof value.name === "string" &&
  typeof value.reasoning === "boolean" &&
  number(value.contextWindow) &&
  Array.isArray(value.thinkingLevels) &&
  value.thinkingLevels.every((level) => typeof level === "string");

const session = (value: unknown): value is PiSession => {
  if (
    !object(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.cwd !== "string" ||
    typeof value.idle !== "boolean" ||
    typeof value.thinkingLevel !== "string" ||
    (value.model !== undefined && !model(value.model))
  ) {
    return false;
  }
  return (
    value.context === undefined ||
    (object(value.context) &&
      (value.context.tokens === null || number(value.context.tokens)) &&
      number(value.context.contextWindow) &&
      (value.context.percent === null || number(value.context.percent)))
  );
};

const content = (value: unknown): value is PiContent => {
  if (!object(value)) {
    return false;
  }
  switch (value.type) {
    case "text": {
      return typeof value.text === "string";
    }
    case "thinking": {
      return typeof value.thinking === "string";
    }
    case "toolCall": {
      return (
        typeof value.id === "string" &&
        typeof value.name === "string" &&
        object(value.arguments)
      );
    }
    case "image": {
      return (
        typeof value.mimeType === "string" && typeof value.data === "string"
      );
    }
    default: {
      return false;
    }
  }
};

const piMessage = (value: unknown): value is PiMessage =>
  object(value) &&
  typeof value.id === "string" &&
  typeof value.role === "string" &&
  ["user", "assistant", "toolResult", "custom"].includes(value.role) &&
  Array.isArray(value.content) &&
  value.content.every(content) &&
  number(value.timestamp) &&
  (value.toolCallId === undefined || typeof value.toolCallId === "string") &&
  (value.toolName === undefined || typeof value.toolName === "string") &&
  (value.isError === undefined || typeof value.isError === "boolean") &&
  (value.errorMessage === undefined || typeof value.errorMessage === "string");

const tool = (value: unknown): value is PiToolActivity =>
  object(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  object(value.input) &&
  (value.output === undefined || typeof value.output === "string") &&
  (value.content === undefined ||
    (Array.isArray(value.content) && value.content.every(content))) &&
  typeof value.status === "string" &&
  ["running", "completed", "error"].includes(value.status);

const waiting = (value: unknown): boolean =>
  value === undefined ||
  (object(value) &&
    typeof value.kind === "string" &&
    (value.title === undefined || typeof value.title === "string"));

const event = (value: unknown): value is PiEvent => {
  if (!object(value)) {
    return false;
  }
  switch (value.type) {
    case "message": {
      return piMessage(value.message);
    }
    case "tool": {
      return tool(value.tool);
    }
    case "session": {
      return session(value.session);
    }
    case "waiting": {
      return waiting(value.waiting);
    }
    case "reset": {
      return true;
    }
    default: {
      return false;
    }
  }
};

const identity = (value: ObjectValue): boolean =>
  typeof value.instanceID === "string" && value.instanceID.length > 0;

const serverInfo = (value: unknown): value is PiServerInfo =>
  object(value) &&
  value.backend === "pi" &&
  value.protocol === 1 &&
  typeof value.version === "string" &&
  identity(value) &&
  session(value.session);

const snapshot = (value: unknown): value is PiSnapshot =>
  object(value) &&
  cursor(value.cursor) &&
  identity(value) &&
  session(value.session) &&
  Array.isArray(value.messages) &&
  value.messages.every(piMessage) &&
  Array.isArray(value.tools) &&
  value.tools.every(tool) &&
  waiting(value.waiting);

const batch = (value: unknown): value is PiEventBatch =>
  object(value) &&
  cursor(value.cursor) &&
  identity(value) &&
  Array.isArray(value.events) &&
  value.events.every(event) &&
  (value.reset === undefined || typeof value.reset === "boolean");

const sessionSummary = (value: unknown): value is PiSessionSummary =>
  object(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.cwd === "string" &&
  number(value.updated) &&
  typeof value.active === "boolean";

export class PiConnectionError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = "PiConnectionError";
  }
}

const replaceControlCharacters = (text: string): string =>
  Array.from(text, (character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f ? " " : character;
  }).join("");

const requestFailure = (
  error: unknown,
  signal: AbortSignal | undefined,
  timedOut: boolean
): unknown => {
  if (signal?.aborted) {
    return (
      signal.reason ?? new DOMException("The request was aborted", "AbortError")
    );
  }
  if (timedOut) {
    return new PiConnectionError(
      "Pi did not respond before the request timed out. Check your network and try again."
    );
  }
  if (error instanceof PiConnectionError) {
    return error;
  }
  return new PiConnectionError(
    "Pi is unreachable. Check the server address and your network."
  );
};

const readJson = async (
  response: Response,
  controller: AbortController
): Promise<unknown> => {
  try {
    return await response.json();
  } catch (error) {
    if (controller.signal.aborted) {
      throw error;
    }
    throw new PiConnectionError(
      "Pi returned an invalid JSON response. Check the server address and version."
    );
  }
};

export const createPiClient = (
  connection: Connection,
  fetchOverride: typeof globalThis.fetch = globalThis.fetch
) => {
  const baseURL = connection.url.replace(/\/+$/u, "");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (connection.token) {
    const bytes = new TextEncoder().encode(
      `${connection.username || "opencode"}:${connection.token}`
    );
    headers.Authorization = `Basic ${btoa(Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(""))}`;
  }

  const redact = (text: string): string => {
    let detail = text;
    for (const secret of [connection.token, headers.Authorization]) {
      if (secret) {
        detail = detail.split(secret).join("[redacted]");
      }
    }
    return replaceControlCharacters(detail).trim().slice(0, 300);
  };

  const readErrorDetail = async (
    response: Response,
    controller: AbortController
  ): Promise<string> => {
    if (!response.headers.get("content-type")?.includes("application/json")) {
      return "";
    }
    try {
      const body: unknown = await response.json();
      if (
        object(body) &&
        typeof body.error === "string" &&
        !/[<>]/u.test(body.error)
      ) {
        return redact(body.error);
      }
    } catch (error) {
      if (controller.signal.aborted) {
        throw error;
      }
    }
    return "";
  };

  const fetchValid = async <T>(
    path: string,
    valid: (value: unknown) => value is T,
    controller: AbortController,
    command: PiCommand | undefined
  ): Promise<T> => {
    const response = await fetchOverride(`${baseURL}${path}`, {
      body: command ? JSON.stringify(command) : undefined,
      headers: command
        ? { ...headers, "Content-Type": "application/json" }
        : headers,
      method: command ? "POST" : "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401) {
        throw new PiConnectionError(
          "Pi rejected this password. Enter the server password again.",
          401
        );
      }
      const detail = await readErrorDetail(response, controller);
      throw new PiConnectionError(
        detail ||
          `Pi returned HTTP ${response.status}. Check the server address and try again.`,
        response.status
      );
    }
    const value = await readJson(response, controller);
    if (!valid(value)) {
      throw new PiConnectionError(
        "Pi returned an unsupported response. This app requires Pi mobile protocol 1."
      );
    }
    return value;
  };

  const request = async <T>(
    path: string,
    valid: (value: unknown) => value is T,
    signal?: AbortSignal,
    command?: PiCommand,
    timeout = 15_000
  ): Promise<T> => {
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) {
      abort();
    } else {
      signal?.addEventListener("abort", abort, { once: true });
    }
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeout);
    try {
      return await fetchValid(path, valid, controller, command);
    } catch (error) {
      throw requestFailure(error, signal, timedOut);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };

  return {
    async command(command: PiCommand, signal?: AbortSignal): Promise<void> {
      await request(
        "/pi/command",
        (value): value is { ok: true } => object(value) && value.ok === true,
        signal,
        command
      );
    },
    async *events(
      after: number,
      instanceID: string,
      signal: AbortSignal
    ): AsyncGenerator<PiEventBatch> {
      if (!cursor(after) || !instanceID) {
        throw new PiConnectionError(
          "Pi requires a valid event cursor and server identity."
        );
      }
      let position = after;
      while (!signal.aborted) {
        const query = new URLSearchParams({
          after: String(position),
          instance: instanceID,
        });
        const result = await request(
          `/pi/events?${query}`,
          batch,
          signal,
          undefined,
          35_000
        );
        const reset =
          result.reset ||
          result.instanceID !== instanceID ||
          result.events.some((item) => item.type === "reset");
        if (!reset && result.cursor < position) {
          throw new PiConnectionError(
            "Pi returned an outdated event cursor. Reload the session."
          );
        }
        yield result;
        if (reset) {
          return;
        }
        position = result.cursor;
      }
    },
    info: (signal?: AbortSignal) => request("/pi/info", serverInfo, signal),
    async models(signal?: AbortSignal): Promise<PiModel[]> {
      const result = await request(
        "/pi/models",
        (value): value is { models: PiModel[] } =>
          object(value) &&
          Array.isArray(value.models) &&
          value.models.every(model),
        signal
      );
      return result.models;
    },
    async sessions(signal?: AbortSignal): Promise<PiSessionSummary[]> {
      const result = await request(
        "/pi/sessions",
        (value): value is { sessions: PiSessionSummary[] } =>
          object(value) &&
          Array.isArray(value.sessions) &&
          value.sessions.every(sessionSummary),
        signal
      );
      return result.sessions;
    },
    snapshot: (signal?: AbortSignal) =>
      request("/pi/snapshot", snapshot, signal),
  };
};

export type PiClient = ReturnType<typeof createPiClient>;
