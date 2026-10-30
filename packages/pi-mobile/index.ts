import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { getSupportedThinkingLevels, type Api, type Model } from '@earendil-works/pi-ai';
import { SessionManager, VERSION, type ExtensionAPI, type ExtensionCommandContext, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import qr from 'qrcode-terminal';
import { PI_MOBILE_PROTOCOL, type PiCommand, type PiContent, type PiEvent, type PiEventBatch, type PiMessage, type PiModel, type PiSession, type PiSnapshot, type PiToolActivity } from './protocol.ts';

const bridgeKey = Symbol.for('opencoode.pi-mobile.bridge.v1');
const processState = globalThis as typeof globalThis & { [bridgeKey]?: MobileBridge };
const maxBody = 5 * 1024 * 1024;
const maxEvents = 512;
const maxEventBytes = 2 * 1024 * 1024;
type Waiting = NonNullable<PiSnapshot['waiting']>;
type RawMessage = { role: string; content?: unknown; timestamp?: number; toolCallId?: string; toolName?: string; isError?: boolean; errorMessage?: string; display?: boolean };
type Poll = { response: ServerResponse; after: number; timer: ReturnType<typeof setTimeout>; address: string };

class RequestError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, key: string, limit = 100_000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) throw new RequestError(400, `Invalid ${key}`);
  return value;
}

function command(value: unknown): PiCommand {
  if (!object(value)) throw new RequestError(400, 'Expected a command');
  switch (value.type) {
    case 'prompt': {
      const prompt = typeof value.text === 'string' && value.text.length <= 1_000_000 ? value.text : undefined;
      if (prompt === undefined) throw new RequestError(400, 'Invalid prompt text');
      if (value.delivery !== undefined && value.delivery !== 'steer' && value.delivery !== 'followUp') throw new RequestError(400, 'Invalid prompt delivery');
      let images: Extract<PiCommand, { type: 'prompt' }>['images'];
      if (value.images !== undefined) {
        if (!Array.isArray(value.images) || value.images.length > 16) throw new RequestError(400, 'Invalid images');
        images = value.images.map(image => {
          if (!object(image) || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(String(image.mimeType))) throw new RequestError(400, 'Invalid image type');
          const data = text(image.data, 'image data', maxBody);
          if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new RequestError(400, 'Invalid image data');
          return { mimeType: image.mimeType as string, data };
        });
      }
      if (!prompt.trim() && !images?.length) throw new RequestError(400, 'The prompt is empty');
      return { type: 'prompt', text: prompt, delivery: value.delivery, images };
    }
    case 'abort': case 'new': return { type: value.type };
    case 'compact':
      return { type: 'compact', instructions: value.instructions === undefined ? undefined : text(value.instructions, 'compaction instructions') };
    case 'model': return { type: 'model', provider: text(value.provider, 'provider', 256), id: text(value.id, 'model', 512) };
    case 'thinking': return { type: 'thinking', level: text(value.level, 'thinking level', 32) };
    case 'rename': return { type: 'rename', name: text(value.name, 'session name', 200) };
    case 'switch': return { type: 'switch', sessionID: text(value.sessionID, 'session ID', 128) };
    case 'fork': return { type: 'fork', entryID: text(value.entryID, 'entry ID', 128) };
    default: throw new RequestError(400, 'Unknown command');
  }
}

function modelInfo(model: Model<Api>): PiModel {
  return { id: model.id, provider: model.provider, name: model.name, reasoning: model.reasoning, contextWindow: model.contextWindow, thinkingLevels: getSupportedThinkingLevels(model) };
}

function content(value: unknown): PiContent[] {
  if (typeof value === 'string') return [{ type: 'text', text: value }];
  if (!Array.isArray(value)) return [];
  return value.flatMap((part): PiContent[] => {
    if (!object(part)) return [];
    if (part.type === 'text' && typeof part.text === 'string') return [{ type: 'text', text: part.text }];
    if (part.type === 'thinking' && typeof part.thinking === 'string') return [{ type: 'thinking', thinking: part.thinking }];
    if (part.type === 'image' && typeof part.data === 'string' && typeof part.mimeType === 'string') return [{ type: 'image', data: part.data, mimeType: part.mimeType }];
    if (part.type === 'toolCall' && typeof part.id === 'string' && typeof part.name === 'string') return [{ type: 'toolCall', id: part.id, name: part.name, arguments: object(part.arguments) ? structuredClone(part.arguments) : {} }];
    return [];
  });
}

function messageInfo(raw: RawMessage, id: string): PiMessage | undefined {
  if (raw.role !== 'user' && raw.role !== 'assistant' && raw.role !== 'toolResult' && raw.role !== 'custom') return undefined;
  return { id, role: raw.role, content: content(raw.content), timestamp: raw.timestamp ?? 0, toolCallId: raw.toolCallId, toolName: raw.toolName, isError: raw.isError, errorMessage: raw.errorMessage };
}

function output(result: unknown): string {
  return object(result) ? content(result.content).flatMap(part => part.type === 'text' ? [part.text] : []).join('\n') : '';
}

function privateAddress(address: string): boolean {
  const normalized = address.replace(/^::ffff:/, '');
  if (normalized === '::1') return true;
  const parts = normalized.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127);
}

function localAddresses(): string[] {
  return [...new Set(Object.values(networkInterfaces()).flatMap(entries => entries ?? []).filter(entry => entry.family === 'IPv4' && privateAddress(entry.address)).map(entry => entry.address))];
}

function equalSecret(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (request.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new RequestError(415, 'Use application/json');
  if (Number(request.headers['content-length'] ?? 0) > maxBody) throw new RequestError(413, 'The request exceeds 5 MB');
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const cleanup = () => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('aborted', onAborted);
    };
    const onError = () => { cleanup(); reject(new RequestError(400, 'The request did not complete')); };
    const onAborted = () => onError();
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBody) {
        cleanup();
        request.resume();
        reject(new RequestError(413, 'The request exceeds 5 MB'));
      } else chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new RequestError(400, 'Invalid JSON')); }
    };
    request.on('data', onData);
    request.on('end', onEnd);
    request.on('error', onError);
    request.on('aborted', onAborted);
  });
}

class MobileBridge {
  readonly instanceID = randomUUID();
  private pi: ExtensionAPI;
  private context?: ExtensionContext;
  private commandContext?: ExtensionCommandContext;
  private server?: Server;
  private port = 0;
  private token = randomBytes(32).toString('base64url');
  private pairing?: { code: string; expires: number };
  private pairingTimer?: ReturnType<typeof setTimeout>;
  private addresses: string[] = [];
  private cursor = 0;
  private events: { cursor: number; event: PiEvent; bytes: number }[] = [];
  private eventBytes = 0;
  private eventFloor = 0;
  private polls = new Set<Poll>();
  private live = new Map<string, PiMessage>();
  private activeMessages = new Map<string, string>();
  private messageIDs = new WeakMap<object, string>();
  private entryAliases = new Map<string, string>();
  private customMessages = new Map<string, unknown>();
  private tools = new Map<string, PiToolActivity>();
  private prompts: Waiting[] = [];
  private sessionID?: string;
  private running = false;
  private compacting = false;
  private dirtyMessages = new Map<string, PiMessage>();
  private flushTimer?: ReturnType<typeof setTimeout>;
  private sessionTimer?: ReturnType<typeof setTimeout>;
  private handoffTimer?: ReturnType<typeof setTimeout>;
  private queue: Promise<void> = Promise.resolve();
  private queued = 0;
  private closed = false;

  constructor(pi: ExtensionAPI) { this.pi = pi; }

  bind(pi: ExtensionAPI) { this.pi = pi; }

  attach(context: ExtensionContext) {
    clearTimeout(this.handoffTimer);
    this.context = context;
    const id = context.sessionManager.getSessionId();
    if (this.sessionID !== id) {
      this.sessionID = id;
      this.commandContext = undefined;
      this.live.clear();
      this.activeMessages.clear();
      this.messageIDs = new WeakMap();
      this.entryAliases.clear();
      for (const entry of context.sessionManager.getEntries()) {
        if (entry.type === 'custom_message') this.entryAliases.set(entry.id, entry.id);
      }
      this.customMessages.clear();
      this.tools.clear();
      this.prompts = [];
      this.dirtyMessages.clear();
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
      this.running = !context.isIdle();
      this.compacting = false;
      this.emit({ type: 'reset' });
    }
  }

  private current(): ExtensionContext {
    if (!this.context) throw new RequestError(409, 'Pi is changing sessions. Try again');
    return this.context;
  }

  private session(): PiSession {
    const ctx = this.current();
    return {
      id: ctx.sessionManager.getSessionId(), name: ctx.sessionManager.getSessionName() ?? '', cwd: ctx.cwd,
      idle: !this.running && !this.compacting && ctx.isIdle() && !ctx.hasPendingMessages(),
      model: ctx.model ? modelInfo(ctx.model) : undefined, thinkingLevel: this.pi.getThinkingLevel(), context: ctx.getContextUsage(),
    };
  }

  sessionChanged(context: ExtensionContext) { this.attach(context); this.emit({ type: 'session', session: this.session() }); }

  treeChanged(context: ExtensionContext) {
    this.attach(context);
    this.live.clear();
    this.activeMessages.clear();
    this.customMessages.clear();
    this.tools.clear();
    this.dirtyMessages.clear();
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    this.emit({ type: 'reset' });
    this.emit({ type: 'session', session: this.session() });
  }

  activity(context: ExtensionContext, running: boolean) {
    this.attach(context);
    this.running = running;
    this.flushMessages();
    this.emit({ type: 'session', session: this.session() });
  }

  compaction(context: ExtensionContext, active: boolean) {
    this.attach(context);
    this.compacting = active;
    this.emit({ type: 'session', session: this.session() });
    if (!active) {
      this.emit({ type: 'reset' });
      clearTimeout(this.sessionTimer);
      this.sessionTimer = setTimeout(() => {
        if (this.context && !this.closed) this.emit({ type: 'session', session: this.session() });
      }, 0);
    }
  }

  waiting(context: ExtensionContext, prompt: Waiting, active: boolean) {
    this.attach(context);
    if (active) this.prompts.push(prompt);
    else {
      const index = this.prompts.findLastIndex(item => item.kind === prompt.kind && item.title === prompt.title);
      if (index >= 0) this.prompts.splice(index, 1);
    }
    this.emit({ type: 'waiting', waiting: this.prompts.at(-1) });
  }

  message(context: ExtensionContext, raw: RawMessage, stage: 'start' | 'update' | 'end') {
    this.attach(context);
    if (raw.role === 'custom' && raw.display === false) return;
    const key = raw.role === 'assistant' ? 'assistant' : `${raw.role}:${raw.timestamp ?? 0}:${raw.toolCallId ?? ''}`;
    const id = this.activeMessages.get(key) ?? this.messageIDs.get(raw) ?? `live:${randomUUID()}`;
    const message = messageInfo(raw, id);
    if (!message) return;
    this.messageIDs.set(raw, id);
    this.live.set(id, message);
    if (raw.role === 'custom') this.customMessages.set(id, raw.content);
    if (stage === 'end') this.activeMessages.delete(key);
    else this.activeMessages.set(key, id);
    if (stage === 'update') {
      this.dirtyMessages.set(id, message);
      this.flushTimer ??= setTimeout(() => this.flushMessages(), 32);
    } else {
      this.dirtyMessages.delete(id);
      this.emit({ type: 'message', message });
    }
  }

  tool(context: ExtensionContext, event: { toolCallId: string; toolName: string; args?: unknown; partialResult?: unknown; result?: unknown; isError?: boolean }, stage: 'start' | 'update' | 'end') {
    this.attach(context);
    const previous = this.tools.get(event.toolCallId);
    const tool: PiToolActivity = {
      id: event.toolCallId, name: event.toolName, input: object(event.args) ? structuredClone(event.args) : previous?.input ?? {},
      output: stage === 'start' ? undefined : output(stage === 'end' ? event.result : event.partialResult),
      status: stage === 'end' ? event.isError ? 'error' : 'completed' : 'running',
    };
    this.tools.set(tool.id, tool);
    this.emit({ type: 'tool', tool });
  }

  private flushMessages() {
    clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    for (const message of this.dirtyMessages.values()) this.emit({ type: 'message', message });
    this.dirtyMessages.clear();
  }

  private emit(event: PiEvent) {
    if (this.closed) return;
    const bytes = Buffer.byteLength(JSON.stringify(event));
    this.events.push({ cursor: ++this.cursor, event, bytes });
    this.eventBytes += bytes;
    while (this.events.length > maxEvents || this.eventBytes > maxEventBytes) {
      const removed = this.events.shift()!;
      this.eventBytes -= removed.bytes;
      this.eventFloor = removed.cursor;
    }
    for (const poll of [...this.polls]) this.finishPoll(poll);
  }

  private batch(after: number): PiEventBatch {
    const reset = after > this.cursor || after < this.eventFloor;
    return { cursor: this.cursor, instanceID: this.instanceID, events: reset ? [] : this.events.filter(item => item.cursor > after).map(item => item.event), ...(reset ? { reset: true } : {}) };
  }

  private snapshot(): PiSnapshot {
    const ctx = this.current();
    const messages: PiMessage[] = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === 'message') {
        const alias = this.entryAliases.get(entry.id) ?? this.messageIDs.get(entry.message) ?? entry.id;
        this.entryAliases.set(entry.id, alias);
        const message = messageInfo(entry.message, alias);
        if (message) messages.push(message);
        this.live.delete(alias);
      } else if (entry.type === 'custom_message') {
        let alias = this.entryAliases.get(entry.id);
        if (!alias) {
          alias = [...this.customMessages].find(([, rawContent]) => rawContent === entry.content)?.[0] ?? entry.id;
          this.entryAliases.set(entry.id, alias);
        }
        const timestamp = this.live.get(alias)?.timestamp ?? Date.parse(entry.timestamp);
        this.live.delete(alias);
        this.customMessages.delete(alias);
        if (entry.display) messages.push({ id: alias, role: 'custom', content: content(entry.content), timestamp });
      }
    }
    messages.push(...this.live.values());
    const session = this.session();
    const tools = new Map<string, PiToolActivity>();
    for (const message of messages) {
      for (const part of message.content) {
        if (part.type === 'toolCall') tools.set(part.id, { id: part.id, name: part.name, input: part.arguments, status: session.idle ? 'error' : 'running' });
      }
      if (message.role === 'toolResult' && message.toolCallId) {
        const previous = tools.get(message.toolCallId);
        tools.set(message.toolCallId, { id: message.toolCallId, name: message.toolName ?? previous?.name ?? '', input: previous?.input ?? {}, output: message.content.flatMap(part => part.type === 'text' ? [part.text] : []).join('\n'), status: message.isError ? 'error' : 'completed' });
      }
    }
    for (const tool of this.tools.values()) tools.set(tool.id, tool);
    return { cursor: this.cursor, instanceID: this.instanceID, session, messages, tools: [...tools.values()], waiting: this.prompts.at(-1) };
  }

  async start(context: ExtensionCommandContext) {
    this.attach(context);
    this.commandContext = context;
    this.addresses = localAddresses();
    if (!this.server) {
      const server = createServer((request, response) => {
        void this.request(request, response).catch(error => {
          if (!response.headersSent && !response.destroyed) this.reply(response, error instanceof RequestError ? error.status : 500, { error: error instanceof RequestError ? error.message : 'Pi could not complete the request' });
        });
      });
      this.server = server;
      server.maxConnections = 64;
      server.maxHeadersCount = 32;
      server.requestTimeout = 10_000;
      server.headersTimeout = 10_000;
      server.keepAliveTimeout = 5_000;
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '0.0.0.0', () => { server.off('error', reject); resolve(); });
      }).catch(error => { this.server = undefined; throw error; });
      server.on('error', () => { void this.close(); });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Pi could not open the mobile listener');
      this.port = address.port;
    }
    const code = randomBytes(16).toString('base64url');
    this.pairing = { code, expires: Date.now() + 300_000 };
    clearTimeout(this.pairingTimer);
    const urls = this.addresses.filter(address => !address.startsWith('127.')).map(address => `http://${address}:${this.port}`);
    if (!urls.length) urls.push(`http://127.0.0.1:${this.port}`);
    const payload = JSON.stringify({ urls, code });
    qr.generate(payload, { small: true }, qrText => {
      context.ui.setWidget('opencoode-mobile-pairing', [qrText, 'Scan this QR code in OpenCoode. The code expires in five minutes.', ...urls.map(url => `${url}/auth/connect/${code}`), 'Use /mobile stop to disconnect the phone.']);
    });
    context.ui.setStatus('opencoode-mobile', 'Mobile: ready');
    this.pairingTimer = setTimeout(() => {
      this.pairing = undefined;
      this.context?.ui.setWidget('opencoode-mobile-pairing', undefined);
    }, 300_000);
  }

  private reply(response: ServerResponse, status: number, body: unknown) {
    response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(JSON.stringify(body));
  }

  private finishPoll(poll: Poll) {
    clearTimeout(poll.timer);
    this.polls.delete(poll);
    if (!poll.response.destroyed) this.reply(poll.response, 200, this.batch(poll.after));
  }

  private async request(request: IncomingMessage, response: ServerResponse) {
    if (this.closed) throw new RequestError(503, 'The mobile listener is stopped');
    const address = request.socket.remoteAddress ?? '';
    if (!privateAddress(address) || request.headers.origin !== undefined || request.headers['sec-fetch-site'] !== undefined) throw new RequestError(403, 'Use the OpenCoode mobile app on the private network');
    const allowedHosts = [...this.addresses, 'localhost', '127.0.0.1'].map(host => `${host}:${this.port}`);
    if (!allowedHosts.includes(request.headers.host ?? '')) throw new RequestError(403, 'Invalid server address');
    const url = new URL(request.url ?? '/', `http://127.0.0.1:${this.port}`);
    if (request.method === 'GET' && url.pathname === '/opencoode/info') {
      this.reply(response, 200, { backend: 'pi', protocol: PI_MOBILE_PROTOCOL });
      return;
    }
    const pairingCode = /^\/auth\/connect\/([A-Za-z0-9_-]{22})$/.exec(url.pathname)?.[1];
    if ((request.method === 'GET' || request.method === 'POST') && pairingCode) {
      if (!this.pairing || this.pairing.expires <= Date.now() || !equalSecret(pairingCode, this.pairing.code)) throw new RequestError(401, 'The pairing code expired or was already used. Run /mobile in Pi');
      this.pairing = undefined;
      clearTimeout(this.pairingTimer);
      this.context?.ui.setWidget('opencoode-mobile-pairing', undefined);
      this.context?.ui.setStatus('opencoode-mobile', 'Mobile: paired');
      this.reply(response, 200, { token: this.token });
      return;
    }
    const expected = `Basic ${Buffer.from(`opencode:${this.token}`).toString('base64')}`;
    if (!equalSecret(request.headers.authorization ?? '', expected)) throw new RequestError(401, 'Pair the phone with /mobile in Pi');
    if (request.method === 'GET' && url.pathname === '/pi/info') {
      this.reply(response, 200, { backend: 'pi', protocol: PI_MOBILE_PROTOCOL, version: VERSION, instanceID: this.instanceID, session: this.session() });
    } else if (request.method === 'GET' && url.pathname === '/pi/snapshot') {
      this.reply(response, 200, this.snapshot());
    } else if (request.method === 'GET' && url.pathname === '/pi/events') {
      const rawAfter = url.searchParams.get('after');
      const after = Number(rawAfter);
      if (rawAfter === null || !/^\d+$/.test(rawAfter) || !Number.isSafeInteger(after)) throw new RequestError(400, 'Invalid event cursor');
      if (url.searchParams.get('instance') !== this.instanceID) {
        this.reply(response, 200, { cursor: this.cursor, instanceID: this.instanceID, events: [], reset: true } satisfies PiEventBatch);
        return;
      }
      const batch = this.batch(after);
      if (batch.reset || batch.events.length) this.reply(response, 200, batch);
      else {
        if (this.polls.size >= 16 || [...this.polls].filter(poll => poll.address === address).length >= 4) throw new RequestError(429, 'Too many event requests');
        const poll: Poll = { response, after, address, timer: setTimeout(() => this.finishPoll(poll), 25_000) };
        this.polls.add(poll);
        response.once('close', () => { clearTimeout(poll.timer); this.polls.delete(poll); });
      }
    } else if (request.method === 'GET' && url.pathname === '/pi/models') {
      this.reply(response, 200, { models: this.current().modelRegistry.getAvailable().map(modelInfo) });
    } else if (request.method === 'GET' && url.pathname === '/pi/sessions') {
      const ctx = this.current();
      const sessions = await SessionManager.list(ctx.cwd, ctx.sessionManager.getSessionDir());
      this.reply(response, 200, { sessions: sessions.filter(session => session.cwd === ctx.cwd).map(session => ({ id: session.id, name: session.name ?? session.firstMessage ?? '', cwd: session.cwd, updated: session.modified.getTime(), active: session.id === this.sessionID })) });
    } else if (request.method === 'POST' && url.pathname === '/pi/command') {
      const parsed = command(await readJson(request));
      if (this.closed) throw new RequestError(503, 'The mobile listener is stopped');
      if (parsed.type === 'abort') this.current().abort();
      else await this.enqueue(parsed);
      this.reply(response, 200, { ok: true });
    } else throw new RequestError(404, 'Unknown Pi endpoint');
  }

  private enqueue(value: PiCommand): Promise<void> {
    if (this.queued >= 16) throw new RequestError(429, 'Too many commands');
    const sessionID = this.current().sessionManager.getSessionId();
    this.queued++;
    const result = this.queue.then(() => {
      if (this.current().sessionManager.getSessionId() !== sessionID) throw new RequestError(409, 'The active Pi session changed. Send the command again');
      return this.execute(value);
    });
    this.queue = result.catch(() => {}).finally(() => { this.queued--; });
    return result;
  }

  private async execute(value: PiCommand) {
    if (this.closed) throw new RequestError(503, 'The mobile listener is stopped');
    const ctx = this.current();
    const sessionID = ctx.sessionManager.getSessionId();
    if (this.prompts.length) throw new RequestError(409, 'Pi needs a response in the terminal. Complete the terminal dialog first');
    if (value.type === 'prompt') {
      if (this.compacting) throw new RequestError(409, 'Wait for compaction to finish');
      const wasIdle = this.session().idle;
      if (!wasIdle && !value.delivery) throw new RequestError(409, 'Pi is busy. Choose steer or follow-up');
      const model = ctx.model;
      if (!model) throw new RequestError(400, 'Select a model in Pi before a prompt');
      if (value.images?.length && !model.input.includes('image')) throw new RequestError(400, 'The selected model does not accept images');
      if (wasIdle) {
        const pi = this.pi;
        let authenticated: boolean;
        try { authenticated = (await ctx.modelRegistry.getApiKeyAndHeaders(model)).ok; }
        catch { throw new RequestError(400, 'Pi could not authenticate the selected model. Check its provider credentials in the terminal'); }
        if (this.closed) throw new RequestError(503, 'The mobile listener is stopped');
        const current = this.current();
        if (this.pi !== pi || current.sessionManager.getSessionId() !== sessionID || current.model?.provider !== model.provider || current.model?.id !== model.id) throw new RequestError(409, 'The Pi session or model changed. Send the prompt again');
        if (!authenticated) throw new RequestError(400, 'Pi could not authenticate the selected model. Check its provider credentials in the terminal');
        if (this.prompts.length) throw new RequestError(409, 'Pi needs a response in the terminal. Complete the terminal dialog first');
        if (this.compacting) throw new RequestError(409, 'Wait for compaction to finish');
        if (!this.session().idle && !value.delivery) throw new RequestError(409, 'Pi is busy. Choose steer or follow-up');
      }
      const parts = [{ type: 'text' as const, text: value.text }, ...(value.images ?? []).map(image => ({ type: 'image' as const, ...image }))];
      this.pi.sendUserMessage(parts, { deliverAs: value.delivery, expandPromptTemplates: true });
      return;
    }
    if (!this.session().idle) throw new RequestError(409, 'Wait for Pi to finish the current response');
    switch (value.type) {
      case 'compact':
        this.compacting = true;
        ctx.compact({ customInstructions: value.instructions, onComplete: () => this.compaction(this.current(), false), onError: () => this.compaction(this.current(), false) });
        this.emit({ type: 'session', session: this.session() });
        return;
      case 'model': {
        const model = ctx.modelRegistry.getAvailable().find(model => model.provider === value.provider && model.id === value.id);
        if (!model) throw new RequestError(400, 'The model is unavailable');
        if (!await this.pi.setModel(model)) throw new RequestError(400, 'Pi has no authentication for this model');
        break;
      }
      case 'thinking': {
        const level = ctx.model && getSupportedThinkingLevels(ctx.model).find(level => level === value.level);
        if (!level) throw new RequestError(400, 'The model does not support this thinking level');
        this.pi.setThinkingLevel(level);
        break;
      }
      case 'rename': this.pi.setSessionName(value.name); break;
      case 'new': case 'switch': case 'fork': {
        const commandCtx = this.commandContext;
        if (!commandCtx) throw new RequestError(409, 'Run /mobile in this Pi session before session controls');
        const withSession = async (fresh: ExtensionCommandContext) => { this.attach(fresh); this.commandContext = fresh; this.emit({ type: 'session', session: this.session() }); };
        let result: { cancelled: boolean };
        if (value.type === 'new') result = await commandCtx.newSession({ withSession });
        else if (value.type === 'switch') {
          const sessions = await SessionManager.list(ctx.cwd, ctx.sessionManager.getSessionDir());
          const target = sessions.find(session => session.id === value.sessionID && session.cwd === ctx.cwd);
          if (!target) throw new RequestError(404, 'The session does not exist in this project');
          if (this.current().sessionManager.getSessionId() !== sessionID || !this.session().idle) throw new RequestError(409, 'The Pi session changed or started a response. Send the command again');
          result = await commandCtx.switchSession(target.path, { withSession });
        } else {
          this.snapshot();
          const entry = ctx.sessionManager.getBranch().find(entry => entry.id === value.entryID || this.entryAliases.get(entry.id) === value.entryID);
          if (!entry || entry.type !== 'message' || entry.message.role !== 'user') throw new RequestError(400, 'Fork from a user message in the active session');
          result = await commandCtx.fork(entry.id, { withSession });
        }
        if (result.cancelled) throw new RequestError(409, 'Pi cancelled the session change');
        return;
      }
    }
    this.emit({ type: 'session', session: this.session() });
  }

  shutdown(reason: 'quit' | 'reload' | 'new' | 'resume' | 'fork') {
    this.context?.ui.setWidget('opencoode-mobile-pairing', undefined);
    this.context?.ui.setStatus('opencoode-mobile', undefined);
    this.context = undefined;
    this.commandContext = undefined;
    if (reason === 'quit' || reason === 'reload') return this.close();
    clearTimeout(this.handoffTimer);
    this.handoffTimer = setTimeout(() => { void this.close(); }, 30_000);
  }

  async close() {
    this.closed = true;
    this.pairing = undefined;
    this.token = '';
    clearTimeout(this.pairingTimer);
    clearTimeout(this.flushTimer);
    clearTimeout(this.sessionTimer);
    clearTimeout(this.handoffTimer);
    this.context?.ui.setWidget('opencoode-mobile-pairing', undefined);
    this.context?.ui.setStatus('opencoode-mobile', undefined);
    for (const poll of this.polls) {
      clearTimeout(poll.timer);
      if (!poll.response.destroyed) this.reply(poll.response, 503, { error: 'The mobile listener stopped' });
    }
    this.polls.clear();
    const server = this.server;
    this.server = undefined;
    if (processState[bridgeKey] === this) delete processState[bridgeKey];
    if (server) await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
  }
}

export default function mobile(pi: ExtensionAPI) {
  processState[bridgeKey]?.bind(pi);
  const bridge = () => processState[bridgeKey];
  pi.registerCommand('mobile', {
    description: 'Pair OpenCoode with this Pi session. Use /mobile stop to disconnect',
    handler: async (args, ctx) => {
      if (ctx.mode !== 'tui') { ctx.ui.notify('Use /mobile in an interactive Pi terminal', 'error'); return; }
      if (args.trim() === 'stop') { await bridge()?.close(); ctx.ui.notify('I stopped the mobile connection'); return; }
      if (args.trim()) { ctx.ui.notify('Use /mobile or /mobile stop', 'error'); return; }
      const server = bridge() ?? new MobileBridge(pi);
      processState[bridgeKey] = server;
      try { await server.start(ctx); }
      catch (error) { await server.close(); ctx.ui.notify(error instanceof Error ? error.message : 'Pi could not start the mobile listener', 'error'); }
    },
  });
  pi.on('session_start', (_event, ctx) => bridge()?.sessionChanged(ctx));
  pi.on('session_info_changed', (_event, ctx) => bridge()?.sessionChanged(ctx));
  pi.on('session_tree', (_event, ctx) => bridge()?.treeChanged(ctx));
  pi.on('session_shutdown', (event) => bridge()?.shutdown(event.reason));
  pi.on('agent_start', (_event, ctx) => bridge()?.activity(ctx, true));
  pi.on('agent_settled', (_event, ctx) => bridge()?.activity(ctx, false));
  pi.on('session_before_compact', (_event, ctx) => bridge()?.compaction(ctx, true));
  pi.on('session_compact', (_event, ctx) => bridge()?.compaction(ctx, false));
  pi.on('session_compact_failed', (_event, ctx) => bridge()?.compaction(ctx, false));
  pi.on('ui_prompt_start', (event, ctx) => bridge()?.waiting(ctx, { kind: event.kind, title: event.title }, true));
  pi.on('ui_prompt_end', (event, ctx) => bridge()?.waiting(ctx, { kind: event.kind, title: event.title }, false));
  pi.on('message_start', (event, ctx) => bridge()?.message(ctx, event.message, 'start'));
  pi.on('message_update', (event, ctx) => bridge()?.message(ctx, event.message, 'update'));
  pi.on('message_end', (event, ctx) => bridge()?.message(ctx, event.message, 'end'));
  pi.on('tool_execution_start', (event, ctx) => bridge()?.tool(ctx, event, 'start'));
  pi.on('tool_execution_update', (event, ctx) => bridge()?.tool(ctx, event, 'update'));
  pi.on('tool_execution_end', (event, ctx) => bridge()?.tool(ctx, event, 'end'));
  pi.on('model_select', (_event, ctx) => bridge()?.sessionChanged(ctx));
  pi.on('thinking_level_select', (_event, ctx) => bridge()?.sessionChanged(ctx));
}
