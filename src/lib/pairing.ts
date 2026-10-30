import { normalizeConnection, type Connection } from './client';

const codePattern = /^[A-Za-z0-9_-]+$/;
const invalidPairing = 'Scan a server pairing QR code or paste the complete pairing link.';
const legacyPairing = 'This link uses an older pairing format. Create a new pairing link on the server.';

export function parsePairingPayload(input: string): Connection[] {
  const value = input.trim();
  if (value.startsWith('{')) {
    let payload: unknown;
    try { payload = JSON.parse(value); } catch { throw new Error(invalidPairing); }
    if (!payload || typeof payload !== 'object' ||
      !('code' in payload) || typeof payload.code !== 'string' || !codePattern.test(payload.code) ||
      !('urls' in payload) || !Array.isArray(payload.urls) || !payload.urls.length ||
      !payload.urls.every(url => typeof url === 'string')) throw new Error(invalidPairing);
    const code = payload.code;
    let servers: Connection[];
    try { servers = payload.urls.map(url => normalizeConnection({ name: '', url })); }
    catch { throw new Error('This pairing QR code contains an invalid server address. Create a new pairing code on the server.'); }
    return [...new Map(servers.map(server => [server.url, server])).values()].map(server => ({
      ...server, url: `${server.url}/auth/connect/${code}`, token: undefined,
    }));
  }
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(invalidPairing); }
  if (url.pathname === '/connect' && (url.hash.length > 1 || url.searchParams.has('data'))) throw new Error(legacyPairing);
  const code = /\/auth\/connect\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  if (!code || !codePattern.test(code)) throw new Error(invalidPairing);
  try { return [normalizeConnection({ name: '', url: value })]; }
  catch { throw new Error(invalidPairing); }
}
