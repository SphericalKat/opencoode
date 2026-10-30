import assert from 'node:assert/strict';
import test from 'node:test';
import { persistentInputFrame, persistentPtySocketUrl, ptyControlCursor, ptySocketUrl, terminalEvent } from '../src/lib/terminal';

test('terminal reconnection preserves directory and output position without password credentials', () => {
  const url = new URL(ptySocketUrl('https://host.example/opencode', '/work/a b', 'pty/123', 'one-use-ticket', 42));
  assert.equal(url.protocol, 'wss:');
  assert.equal(url.pathname, '/opencode/api/pty/pty%2F123/connect');
  assert.equal(url.searchParams.get('location[directory]'), '/work/a b');
  assert.equal(url.searchParams.get('cursor'), '42');
  assert.equal(url.searchParams.get('ticket'), 'one-use-ticket');
  assert.equal(url.username, '');
  assert.equal(url.password, '');
  assert.throws(() => ptySocketUrl('http://user:secret@host', '/work', 'pty', 'ticket'), /credentials/);
  assert.throws(() => ptySocketUrl('http://host', '/work', 'pty', 'ticket', -1), /position/);
});

test('terminal ignores malformed control data and accepts a valid resume position', () => {
  const control = (text: string) => Uint8Array.from([0, ...new TextEncoder().encode(text)]).buffer;
  assert.equal(ptyControlCursor(control('{"cursor":345}')), 345);
  assert.equal(ptyControlCursor(control('{"cursor":-1}')), undefined);
  assert.equal(ptyControlCursor(control('not json')), undefined);
  assert.equal(ptyControlCursor(new TextEncoder().encode('hello').buffer), undefined);
});

test('terminal bridge rejects invalid geometry and preserves real keyboard input', () => {
  assert.deepEqual(terminalEvent({ type: 'input', data: '\u0003' }), { type: 'input', data: '\u0003', binary: false });
  assert.deepEqual(terminalEvent({ type: 'resize', cols: 40, rows: 16 }), { type: 'resize', cols: 40, rows: 16 });
  assert.equal(terminalEvent({ type: 'resize', cols: 0, rows: 16 }), undefined);
  assert.equal(terminalEvent({ type: 'resize', cols: 40.5, rows: 16 }), undefined);
  assert.equal(terminalEvent({ type: 'input', data: {} }), undefined);
});

test('persistent terminal input preserves UTF-8 bytes and the requested viewport', () => {
  const bytes = new TextEncoder().encode('α🙂世界');
  const frame = persistentInputFrame({ cols: 44, rows: 15 }, bytes);
  const header = new DataView(frame);
  assert.equal(header.getUint8(0), 1);
  assert.equal(header.getUint16(1), 44);
  assert.equal(header.getUint16(3), 15);
  assert.deepEqual(new Uint8Array(frame).subarray(5), bytes);
  assert.deepEqual(Array.from(new Uint8Array(persistentInputFrame({ cols: 300, rows: 20 }))), [0, 1, 44, 0, 20]);
  assert.throws(() => persistentInputFrame({ cols: 0, rows: 15 }), /size/);
});

test('persistent terminal opens as an observer without credentials or automatic takeover', () => {
  const url = new URL(persistentPtySocketUrl('https://host.example/base', 'pty/1', 'short-lived-ticket', { cursor: 57, attachmentID: 'mobile-1', role: 'observer' }));
  assert.equal(url.pathname, '/base/api/experimental/persistent-pty/pty%2F1/connect');
  assert.equal(url.protocol, 'wss:');
  assert.equal(url.searchParams.get('cursor'), '57');
  assert.equal(url.searchParams.get('attachment_id'), 'mobile-1');
  assert.equal(url.searchParams.get('role'), 'observer');
  assert.equal(url.searchParams.get('takeover'), 'false');
  assert.equal(url.searchParams.get('input_protocol'), '1');
  assert.equal(url.username, '');
  assert.equal(url.password, '');
});
