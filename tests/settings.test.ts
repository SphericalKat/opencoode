import assert from 'node:assert/strict';
import test from 'node:test';
import { externalURL, saveConfigFile, validateConfig } from '../src/lib/settings';

test('configuration accepts comments and trailing commas but rejects non-objects and syntax errors', () => {
  validateConfig('{ // Project options\n "default_agent": "build",\n}');
  assert.throws(() => validateConfig('{"model": }'), /Invalid configuration/);
  assert.throws(() => validateConfig('[]'), /JSON object/);
});

test('configuration preserves a newer server file instead of overwriting it', async () => {
  let writes = 0;
  await assert.rejects(saveConfigFile({
    file: { read: async () => new TextEncoder().encode('{"model":"newer"}') },
    experimental: { file: { write: async () => { writes++; return { location: { directory: '/project' }, data: { path: '/project/opencode.jsonc' } }; } } },
  }, '/project', '/project/opencode.jsonc', '{}', '{"model":"requested"}'), /changed on the server/);
  assert.equal(writes, 0);
});

test('new configuration refuses to overwrite a file created after the editor opened', async () => {
  let writes = 0;
  await assert.rejects(saveConfigFile({
    file: { read: async () => new TextEncoder().encode('{}') },
    experimental: { file: { write: async () => { writes++; return { location: { directory: '/project' }, data: { path: '/project/opencode.jsonc' } }; } } },
  }, '/project', '/project/opencode.jsonc', null, '{"default_agent":"build"}'), /changed on the server/);
  assert.equal(writes, 0);
});

test('configuration validates before reading or writing and saves the exact edited bytes', async () => {
  let reads = 0;
  const written: Uint8Array[] = [];
  const client = {
    file: { read: async () => { reads++; return new TextEncoder().encode('{}'); } },
    experimental: { file: { write: async (input: { payload: Uint8Array }) => { written.push(input.payload); return { location: { directory: '/project' }, data: { path: '/project/opencode.jsonc' } }; } } },
  };
  await assert.rejects(saveConfigFile(client, '/project', '/project/opencode.jsonc', '{}', '{bad}'), /Invalid configuration/);
  assert.equal(reads, 0);
  const source = '{\n  // Keep this comment\n  "default_agent": "build",\n}';
  await saveConfigFile(client, '/project', '/project/opencode.jsonc', '{}', source);
  assert.equal(reads, 1);
  assert.equal(new TextDecoder().decode(written[0]), source);
});

test('integration links permit browser URLs and block executable schemes', () => {
  assert.equal(externalURL('https://example.com/authorize?state=abc'), 'https://example.com/authorize?state=abc');
  assert.throws(() => externalURL('javascript:alert(1)'), /unsupported link/);
  assert.throws(() => externalURL('file:///etc/passwd'), /unsupported link/);
});
