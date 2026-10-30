import { ClientError, isUnauthorizedError, OpenCode } from '@opencode/client';

export type Connection = {
  id: string;
  name: string;
  url: string;
  token?: string;
  username?: string;
};

export type Client = ReturnType<typeof OpenCode.make>;
const invalidServerMessage = 'This address did not return an OpenCode 2 API. The server address or OpenCode version is incorrect.';
let redeemedPairing: { code: string; token: string; urls: string[]; expiresAt: number } | undefined;

export function clearPairingRetry(): void {
  redeemedPairing = undefined;
}

export function normalizeConnection(input: Omit<Connection, 'id'> & { id?: string }): Connection {
  let url: URL;
  try {
    url = new URL(input.url.trim());
  } catch {
    throw new Error('Enter a full server URL, such as http://192.168.1.20:4096');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Use an HTTP or HTTPS server URL');
  }
  if (url.username || url.password) throw new Error('Enter the server password in the password field');
  if (url.search || url.hash) throw new Error('Remove the query and fragment from the server URL');
  const username = input.username?.trim() || 'opencode';
  if (username.includes(':')) throw new Error('The username cannot contain a colon');
  return {
    id: input.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: input.name.trim() || url.hostname,
    url: url.toString().replace(/\/+$/, ''),
    token: input.token || undefined,
    username,
  };
}

export function authorizationHeader(connection: Connection): string | undefined {
  if (!connection.token) return undefined;
  const bytes = new TextEncoder().encode(`${connection.username || 'opencode'}:${connection.token}`);
  return `Basic ${btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))}`;
}

export function createClient(connection: Connection, fetchOverride: typeof globalThis.fetch = globalThis.fetch): Client {
  const authorization = authorizationHeader(connection);
  return OpenCode.make({
    baseUrl: connection.url,
    fetch: fetchOverride,
    headers: authorization ? { Authorization: authorization } : undefined,
  });
}

function pairingAddress(connection: Connection) {
  const url = new URL(connection.url);
  const match = /^(.*)\/auth\/connect\/([^/]+)\/?$/.exec(url.pathname);
  if (!match) return;
  let code: string;
  try { code = decodeURIComponent(match[2]); } catch { throw new Error('This pairing link is invalid. Create a new link in OpenCode.'); }
  if (!/^[A-Za-z0-9_-]+$/.test(code)) throw new Error('This pairing link is invalid. Create a new link in OpenCode.');
  return { code, url: `${url.origin}${match[1]}`.replace(/\/+$/, '') };
}

function pairingFailure(error: unknown): unknown {
  if (!error || typeof error !== 'object' || !('errors' in error) || !Array.isArray(error.errors)) return error;
  return error.errors.find(isUnauthorizedError) ?? error.errors[0] ?? new Error('The server is unreachable. Check your network and try again.');
}

async function checkConnection(next: Connection, fetchOverride: typeof globalThis.fetch, signal: AbortSignal) {
  const info = await createClient(next, fetchOverride).server.info({ signal });
  if (!info || typeof info !== 'object' || typeof info.version !== 'string') throw new Error(invalidServerMessage);
  if (!/^2\./.test(info.version)) throw new Error(`This app requires OpenCode 2. The server reports ${info.version}`);
  if (typeof info.pid !== 'number' || !Number.isFinite(info.pid) || !Array.isArray(info.urls) || !info.urls.every(url => typeof url === 'string') || !info.paths || typeof info.paths.tmp !== 'string') throw new Error(invalidServerMessage);
  return { connection: next, info };
}

export async function connect(connection: Connection, fetchOverride: typeof globalThis.fetch = globalThis.fetch, alternatives: Connection[] = []) {
  const signal = AbortSignal.timeout(15_000);
  const next = normalizeConnection(connection);
  const pairing = pairingAddress(next);
  if (!pairing) return checkConnection(next, fetchOverride, signal);
  const candidates = [next, ...alternatives.map(normalizeConnection)].map(pairingAddress);
  if (candidates.some(candidate => !candidate || candidate.code !== pairing.code)) {
    throw new Error('These pairing addresses do not share one code. Scan the OpenCode QR code again.');
  }
  const urls = [...new Set(candidates.flatMap(candidate => candidate ? [candidate.url] : []))];
  if (redeemedPairing && redeemedPairing.expiresAt <= Date.now()) clearPairingRetry();
  let cached = redeemedPairing?.code === pairing.code ? redeemedPairing : undefined;
  const cachedUrls = cached?.urls;
  const knownAliases = cachedUrls ? urls.filter(url => cachedUrls.includes(url)) : [];
  if (cached && !knownAliases.length) cached = undefined;
  if (!cached) {
    try {
      cached = await Promise.any(urls.map(async url => {
        const paired = await createClient({ ...next, url, token: undefined }, fetchOverride).server.connect(
          { code: pairing.code }, { headers: { Accept: 'application/json' }, signal },
        );
        if (!paired || typeof paired.token !== 'string' || !paired.token) throw new Error(invalidServerMessage);
        const session = { code: pairing.code, token: paired.token, urls, expiresAt: Date.now() + 5 * 60_000 };
        redeemedPairing = session;
        return session;
      }));
    } catch (error) { throw pairingFailure(error); }
  }
  const allowed = knownAliases.length ? knownAliases : urls;
  const token = cached.token;
  const checks = allowed.map(url => checkConnection({ ...next, url, token, username: 'opencode' }, fetchOverride, signal));
  let paired: Awaited<ReturnType<typeof checkConnection>>;
  try { paired = await Promise.any(checks); }
  catch (error) {
    const failure = pairingFailure(error);
    if (isUnauthorizedError(failure)) throw new Error('OpenCode rejected the paired connection. Create a new pairing link on your computer.');
    throw failure;
  }
  if (paired.connection.url === allowed[0]) return paired;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      checks[0].catch(() => paired),
      new Promise<typeof paired>(resolve => { timer = setTimeout(() => resolve(paired), 1000); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'The server request failed';
}

export function connectionErrorMessage(error: unknown, connection: Pick<Connection, 'url'>): string {
  if (isUnauthorizedError(error)) {
    if (/\/auth\/connect\/[^/]+\/?$/.test(connection.url)) {
      return 'This pairing link expired or was already used. A new pairing link from OpenCode is required.';
    }
    return 'The server rejected this password. The current server password or a new pairing link is required.';
  }
  if (error instanceof ClientError) {
    const cause = error.cause;
    if (cause && typeof cause === 'object' && 'name' in cause && (cause.name === 'TimeoutError' || cause.name === 'AbortError')) {
      return 'The server did not respond within 15 seconds. OpenCode must run at the selected address on a reachable network.';
    }
    if (error.reason === 'Transport') {
      return 'The server is unreachable. It requires the correct address and a connection through your local network or private VPN.';
    }
    if (error.reason === 'UnsupportedContentType' || error.reason === 'MalformedResponse') {
      return invalidServerMessage;
    }
    if (error.reason === 'UnexpectedStatus' && cause && typeof cause === 'object' && 'status' in cause && typeof cause.status === 'number') {
      return `The server returned HTTP ${cause.status}. Its address or proxy configuration requires a check.`;
    }
  }
  return errorMessage(error);
}
