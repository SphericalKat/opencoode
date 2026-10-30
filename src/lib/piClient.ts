import type { Connection } from './client';
import type {
  PiCommand, PiContent, PiEvent, PiEventBatch, PiMessage, PiModel, PiServerInfo,
  PiSession, PiSessionSummary, PiSnapshot, PiToolActivity,
} from '../../packages/pi-mobile/protocol';

type ObjectValue = Record<string, unknown>;

function object(value: unknown): value is ObjectValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function number(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function cursor(value: unknown): value is number {
  return number(value) && Number.isSafeInteger(value) && value >= 0;
}

function model(value: unknown): value is PiModel {
  return object(value) && typeof value.id === 'string' && typeof value.provider === 'string'
    && typeof value.name === 'string' && typeof value.reasoning === 'boolean' && number(value.contextWindow)
    && Array.isArray(value.thinkingLevels) && value.thinkingLevels.every(level => typeof level === 'string');
}

function session(value: unknown): value is PiSession {
  if (!object(value) || typeof value.id !== 'string' || typeof value.name !== 'string'
    || typeof value.cwd !== 'string' || typeof value.idle !== 'boolean' || typeof value.thinkingLevel !== 'string'
    || (value.model !== undefined && !model(value.model))) return false;
  return value.context === undefined || (object(value.context)
    && (value.context.tokens === null || number(value.context.tokens)) && number(value.context.contextWindow)
    && (value.context.percent === null || number(value.context.percent)));
}

function content(value: unknown): value is PiContent {
  if (!object(value)) return false;
  switch (value.type) {
    case 'text': return typeof value.text === 'string';
    case 'thinking': return typeof value.thinking === 'string';
    case 'toolCall': return typeof value.id === 'string' && typeof value.name === 'string' && object(value.arguments);
    case 'image': return typeof value.mimeType === 'string' && typeof value.data === 'string';
    default: return false;
  }
}

function message(value: unknown): value is PiMessage {
  return object(value) && typeof value.id === 'string'
    && typeof value.role === 'string' && ['user', 'assistant', 'toolResult', 'custom'].includes(value.role)
    && Array.isArray(value.content) && value.content.every(content) && number(value.timestamp)
    && (value.toolCallId === undefined || typeof value.toolCallId === 'string')
    && (value.toolName === undefined || typeof value.toolName === 'string')
    && (value.isError === undefined || typeof value.isError === 'boolean')
    && (value.errorMessage === undefined || typeof value.errorMessage === 'string');
}

function tool(value: unknown): value is PiToolActivity {
  return object(value) && typeof value.id === 'string' && typeof value.name === 'string' && object(value.input)
    && (value.output === undefined || typeof value.output === 'string')
    && typeof value.status === 'string' && ['running', 'completed', 'error'].includes(value.status);
}

function waiting(value: unknown): boolean {
  return value === undefined || (object(value) && typeof value.kind === 'string'
    && (value.title === undefined || typeof value.title === 'string'));
}

function event(value: unknown): value is PiEvent {
  if (!object(value)) return false;
  switch (value.type) {
    case 'message': return message(value.message);
    case 'tool': return tool(value.tool);
    case 'session': return session(value.session);
    case 'waiting': return waiting(value.waiting);
    case 'reset': return true;
    default: return false;
  }
}

function identity(value: ObjectValue): boolean {
  return typeof value.instanceID === 'string' && value.instanceID.length > 0;
}

function serverInfo(value: unknown): value is PiServerInfo {
  return object(value) && value.backend === 'pi' && value.protocol === 1
    && typeof value.version === 'string' && identity(value) && session(value.session);
}

function snapshot(value: unknown): value is PiSnapshot {
  return object(value) && cursor(value.cursor) && identity(value) && session(value.session)
    && Array.isArray(value.messages) && value.messages.every(message)
    && Array.isArray(value.tools) && value.tools.every(tool) && waiting(value.waiting);
}

function batch(value: unknown): value is PiEventBatch {
  return object(value) && cursor(value.cursor) && identity(value)
    && Array.isArray(value.events) && value.events.every(event)
    && (value.reset === undefined || typeof value.reset === 'boolean');
}

function sessionSummary(value: unknown): value is PiSessionSummary {
  return object(value) && typeof value.id === 'string' && typeof value.name === 'string'
    && typeof value.cwd === 'string' && number(value.updated) && typeof value.active === 'boolean';
}

export class PiConnectionError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'PiConnectionError';
  }
}

export function createPiClient(connection: Connection, fetchOverride: typeof globalThis.fetch = globalThis.fetch) {
  const baseURL = connection.url.replace(/\/+$/, '');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (connection.token) {
    const bytes = new TextEncoder().encode(`${connection.username || 'opencode'}:${connection.token}`);
    headers.Authorization = `Basic ${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`;
  }

  async function request<T>(path: string, valid: (value: unknown) => value is T, signal?: AbortSignal, command?: PiCommand, timeout = 15_000): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeout);
    try {
      const response = await fetchOverride(`${baseURL}${path}`, {
        method: command ? 'POST' : 'GET',
        headers: command ? { ...headers, 'Content-Type': 'application/json' } : headers,
        body: command ? JSON.stringify(command) : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 401) throw new PiConnectionError('Pi rejected this password. Enter the server password again.', 401);
        let detail = '';
        if (response.headers.get('content-type')?.includes('application/json')) {
          try {
            const body: unknown = await response.json();
            if (object(body) && typeof body.error === 'string' && !/[<>]/.test(body.error)) {
              detail = body.error;
              for (const secret of [connection.token, headers.Authorization]) {
                if (secret) detail = detail.split(secret).join('[redacted]');
              }
              detail = detail.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300);
            }
          } catch (error) {
            if (controller.signal.aborted) throw error;
          }
        }
        throw new PiConnectionError(detail || `Pi returned HTTP ${response.status}. Check the server address and try again.`, response.status);
      }
      let value: unknown;
      try { value = await response.json(); }
      catch (error) {
        if (controller.signal.aborted) throw error;
        throw new PiConnectionError('Pi returned an invalid JSON response. Check the server address and version.');
      }
      if (!valid(value)) throw new PiConnectionError('Pi returned an unsupported response. This app requires Pi mobile protocol 1.');
      return value;
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? new DOMException('The request was aborted', 'AbortError');
      if (timedOut) throw new PiConnectionError('Pi did not respond before the request timed out. Check your network and try again.');
      if (error instanceof PiConnectionError) throw error;
      throw new PiConnectionError('Pi is unreachable. Check the server address and your network.');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  return {
    info: (signal?: AbortSignal) => request('/pi/info', serverInfo, signal),
    snapshot: (signal?: AbortSignal) => request('/pi/snapshot', snapshot, signal),
    async models(signal?: AbortSignal): Promise<PiModel[]> {
      const result = await request('/pi/models', (value): value is { models: PiModel[] } =>
        object(value) && Array.isArray(value.models) && value.models.every(model), signal);
      return result.models;
    },
    async sessions(signal?: AbortSignal): Promise<PiSessionSummary[]> {
      const result = await request('/pi/sessions', (value): value is { sessions: PiSessionSummary[] } =>
        object(value) && Array.isArray(value.sessions) && value.sessions.every(sessionSummary), signal);
      return result.sessions;
    },
    async command(command: PiCommand, signal?: AbortSignal): Promise<void> {
      await request('/pi/command', (value): value is { ok: true } => object(value) && value.ok === true, signal, command);
    },
    async *events(after: number, instanceID: string, signal: AbortSignal): AsyncGenerator<PiEventBatch> {
      if (!cursor(after) || !instanceID) throw new PiConnectionError('Pi requires a valid event cursor and server identity.');
      while (!signal.aborted) {
        const query = new URLSearchParams({ after: String(after), instance: instanceID });
        const result = await request(`/pi/events?${query}`, batch, signal, undefined, 35_000);
        const reset = result.reset || result.instanceID !== instanceID || result.events.some(item => item.type === 'reset');
        if (!reset && result.cursor < after) throw new PiConnectionError('Pi returned an outdated event cursor. Reload the session.');
        yield result;
        if (reset) return;
        after = result.cursor;
      }
    },
  };
}

export type PiClient = ReturnType<typeof createPiClient>;
