import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient, type Connection } from '../src/lib/client';
import { persistentInputFrame, persistentPtySocketUrl } from '../src/lib/terminal';

const fixture = JSON.parse(await readFile('/tmp/opencoode-live-connection.json', 'utf8')) as { connection: Connection; directory: string };
const client = createClient(fixture.connection, (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20_000) }));
const api = client.experimental.persistentPty;
assert.equal((await client.server.info()).capabilities?.persistentPty, true, 'The fixture must support persistent terminals');
const session = await client.session.create({ location: { directory: fixture.directory }, title: 'Persistent terminal integration check' });
let terminalID: string | undefined;
let socket: WebSocket | undefined;

async function until(check: () => boolean | Promise<boolean>, description: string) {
  const deadline = Date.now() + 10_000;
  while (!await check()) {
    if (Date.now() >= deadline) throw new Error(`Timed out: ${description}`);
    await delay(25);
  }
}

try {
  const terminal = await api.create({ sessionID: session.id, args: [], env: { TERM: 'xterm-256color' }, title: 'Persistent Unicode check', cwd: fixture.directory, size: { cols: 80, rows: 24 } });
  terminalID = terminal.id;
  assert.equal(terminal.sessionID, session.id);
  assert.ok((await api.list({ sessionID: session.id })).some(item => item.id === terminal.id));
  const firstSnapshot = await api.snapshot({ ptyID: terminal.id });
  assert.equal(typeof firstSnapshot.checkpoint, 'string');
  const attachmentID = crypto.randomUUID();
  let output = '';
  let attached = false;
  let restored = false;
  let controller = false;
  let offset = firstSnapshot.info.output.tail;
  let latest = Date.now();
  let socketError: Error | undefined;
  async function attach(cursor: number) {
    attached = false;
    restored = false;
    controller = false;
    const token = await api.connectToken({ ptyID: terminal.id, 'x-opencode-ticket': '1' });
    socket = new WebSocket(persistentPtySocketUrl(fixture.connection.url, terminal.id, token.ticket, { cursor, attachmentID, role: 'observer' }));
    socket.binaryType = 'arraybuffer';
    const decoder = new TextDecoder();
    socket.onerror = () => { socketError = new Error('The persistent terminal WebSocket failed'); };
    socket.onmessage = event => {
      try {
        latest = Date.now();
        if (event.data instanceof ArrayBuffer) {
          output += decoder.decode(event.data, { stream: true });
          offset += event.data.byteLength;
        } else if (typeof event.data === 'string') {
          const message = JSON.parse(event.data) as { type: string; inputProtocol?: number; role?: string; endOffset?: number; attachmentID?: string };
          if (message.type === 'attached') {
            assert.equal(message.inputProtocol, 1);
            assert.equal(message.role, 'observer');
            attached = true;
          }
          if (message.type === 'controller_changed') controller = message.attachmentID === attachmentID;
          if (message.type === 'replay_complete') {
            if (message.endOffset !== undefined) offset = message.endOffset;
            restored = true;
          }
        }
      } catch (failure) {
        socketError = failure instanceof Error ? failure : new Error('Invalid persistent terminal response');
      }
    };
    await until(() => {
      if (socketError) throw socketError;
      return attached && restored && socket?.readyState === WebSocket.OPEN;
    }, 'persistent terminal attachment and replay');
  }
  await attach(offset);
  assert.equal(controller, false, 'A new viewer must not take desktop control');
  socket!.send(persistentInputFrame({ cols: 80, rows: 24 }));
  await until(() => controller, 'explicit terminal control');
  socket!.send(persistentInputFrame({ cols: 80, rows: 24 }, new TextEncoder().encode("printf '\\nOC_PERSISTENT_α🙂世界_END\\n'\r")));
  await until(() => output.includes('\r\nOC_PERSISTENT_α🙂世界_END\r\n'), 'persistent terminal Unicode output');
  await until(() => Date.now() - latest > 350, 'persistent terminal output drain');
  const snapshot = await api.snapshot({ ptyID: terminal.id });
  assert.ok(snapshot.text.includes('OC_PERSISTENT_α🙂世界_END'));
  assert.equal(snapshot.info.output.tail, offset, 'Persistent output offsets must count bytes');
  assert.ok(Buffer.from(snapshot.checkpoint, 'base64').byteLength > 0);
  socket!.close();
  output = '';
  await attach(snapshot.info.output.tail);
  assert.equal(output.includes('OC_PERSISTENT'), false, 'Reconnection must not repeat prior output');
  socket!.send(persistentInputFrame({ cols: 80, rows: 24 }));
  await until(() => controller, 'terminal control after reconnection');
  const resized = await api.update({ ptyID: terminal.id, attachmentID, size: { cols: 96, rows: 30 } });
  assert.deepEqual(resized.size, { cols: 96, rows: 30 });
  const readable = await api.read({ sessionID: session.id, lines: 20 });
  assert.equal(readable?.ptyID, terminal.id);
  console.log('PASS: persistent terminal create/list, observer mode, explicit control, input, Unicode byte offsets, snapshot, reconnect, resize, and screen read');
} finally {
  socket?.close();
  try {
    if (terminalID) await api.remove({ ptyID: terminalID });
  } finally {
    await client.session.remove({ sessionID: session.id });
  }
}
console.log('PASS: persistent terminal and its test session removed');
