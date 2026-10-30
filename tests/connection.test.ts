import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { authorizationHeader, connect, connectionErrorMessage, normalizeConnection } from '../src/lib/client';

test('connection validation rejects credentials in URLs and unsupported schemes', () => {
  for (const url of ['file:///private/server', 'https://user:password@example.com', 'https://example.com?password=secret']) {
    assert.throws(() => normalizeConnection({ name: 'Server', url }));
  }
  const connection = normalizeConnection({ name: '  Work  ', url: ' https://example.com/opencode/ ' });
  assert.equal(connection.name, 'Work');
  assert.equal(connection.url, 'https://example.com/opencode');
});

test('Basic authentication preserves a Unicode password and its colons', () => {
  const header = authorizationHeader({ id: 'one', name: 'Work', url: 'https://example.com', token: 'sëcret:a:b' });
  assert.equal(Buffer.from(header!.slice(6), 'base64').toString('utf8'), 'opencode:sëcret:a:b');
});

test('pairing redeems the code as JSON and authenticates the next request under a server path prefix', async () => {
  const requests: { path: string | undefined; authorization: string | undefined; accept: string | undefined }[] = [];
  const server = createServer((request, response) => {
    requests.push({ path: request.url, authorization: request.headers.authorization, accept: request.headers.accept });
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/proxy/auth/connect/one-use-code') {
      response.end(JSON.stringify({ token: 'paired-token' }));
    } else if (request.url === '/proxy/api/info') {
      response.end(JSON.stringify({ version: '2.1.4', pid: 42, urls: [], paths: { tmp: '/tmp' } }));
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const result = await connect({
      id: 'one', name: 'Work', url: `http://127.0.0.1:${address.port}/proxy/auth/connect/one-use-code`,
    });
    assert.equal(result.connection.url, `http://127.0.0.1:${address.port}/proxy`);
    assert.equal(result.connection.token, 'paired-token');
    assert.equal(result.info.version, '2.1.4');
    assert.deepEqual(requests, [
      { path: '/proxy/auth/connect/one-use-code', authorization: undefined, accept: 'application/json' },
      { path: '/proxy/api/info', authorization: `Basic ${Buffer.from('opencode:paired-token').toString('base64')}`, accept: '*/*' },
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('connection recovery distinguishes rejected passwords, expired links, and incompatible server responses', async () => {
  const server = createServer((request, response) => {
    if (request.url === '/missing/api/info') {
      response.setHeader('Content-Type', 'application/json');
      response.end('{}');
      return;
    }
    if (request.url === '/old/api/info') {
      response.setHeader('Content-Type', 'text/html');
      response.end('<html>Another application</html>');
      return;
    }
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ _tag: 'UnauthorizedError', message: request.url?.includes('/auth/connect/') ? 'Pairing link expired or already used' : 'Authentication required' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const origin = `http://127.0.0.1:${address.port}`;
    for (const [path, expected] of [['', /rejected this password/], ['/auth/connect/expired-code', /pairing link expired/], ['/old', /did not return an OpenCode 2 API/], ['/missing', /did not return an OpenCode 2 API/]] as const) {
      const connection = { id: 'recovery', name: 'Server', url: origin + path, token: 'incorrect-password' };
      await assert.rejects(() => connect(connection), error => {
        const message = connectionErrorMessage(error, connection);
        assert.match(message, expected);
        assert.ok(!message.includes(connection.token));
        return true;
      });
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('connection recovery provides safe network and timeout guidance', async () => {
  const connection = { id: 'network', name: 'Server', url: 'http://127.0.0.1:4096' };
  for (const [cause, expected] of [[new DOMException('signal timed out', 'TimeoutError'), /did not respond within 15 seconds/], [new TypeError('Failed to fetch'), /server is unreachable/]] as const) {
    await assert.rejects(() => connect(connection, async () => { throw cause; }), error => {
      assert.match(connectionErrorMessage(error, connection), expected);
      return true;
    });
  }
});
