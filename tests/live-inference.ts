import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { ModelInfo, OpenCodeEvent, SessionMessageAssistant, SessionMessageInfo, SessionStructuredError } from '@opencode/client';
import { createClient, type Connection } from '../src/lib/client';
import { projectLiveEvent } from '../src/lib/chat';

const runInference = process.argv.includes('--run');
const expected = 'OpenCode mobile connection verified';
const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'opencoode-inference-')));
await writeFile(path.join(directory, 'README.md'), 'Temporary project for one OpenCode connection check.\n');
execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: directory });
const env = { ...process.env };
delete env.OPENCODE_PASSWORD;
delete env.OPENCODE_SERVER_PASSWORD;
const server = spawn(process.env.OPENCODE_BINARY || 'opencode', ['serve', '--hostname', '127.0.0.1', '--port', '0'], {
  cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let url: string | undefined;
let token: string | undefined;
let launchError: Error | undefined;
server.on('error', error => { launchError = error; });
server.stdout?.on('data', (bytes: Buffer) => {
  output = (output + bytes.toString()).slice(-16_384);
  url = /server listening on (https?:\/\/[^\s]+)/.exec(output)?.[1];
  token = /server password ([^\s]+)/.exec(output)?.[1];
});
server.stderr?.on('data', () => {});
const interrupt = () => { server.kill('SIGTERM'); };
process.once('SIGINT', interrupt);
process.once('SIGTERM', interrupt);
const stream = new AbortController();
let eventTask: Promise<void> | undefined;
let sessionID: string | undefined;
let client: ReturnType<typeof createClient> | undefined;

async function until(check: () => boolean | Promise<boolean>, label: string, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await delay(50);
  }
  throw new Error(`Timed out: ${label}`);
}

function rates(model: ModelInfo) {
  const cost = model.cost.find(tier => !tier.tier) ?? model.cost[0];
  return cost ? { input: cost.input, output: cost.output } : undefined;
}

function text(message: SessionMessageAssistant) {
  return message.content.filter(part => part.type === 'text').map(part => part.text).join('');
}

try {
  await until(() => {
    if (launchError) throw launchError;
    if (server.exitCode !== null || server.signalCode !== null) throw new Error('OpenCode exited during startup');
    return Boolean(url && token);
  }, 'server startup', 45_000);
  const connection: Connection = { id: 'inference-check', name: 'Inference check', url: url!, token };
  client = createClient(connection, (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20_000) }));
  const [catalog, providers, integrations, defaultModel, info] = await Promise.all([
    client.model.list({ location: { directory }, types: ['chat'] }),
    client.provider.list({ location: { directory } }),
    client.integration.list({ location: { directory } }),
    client.model.default({ location: { directory } }),
    client.server.info(),
  ]);
  const connectedIntegrations = new Set(integrations.data.filter(integration => integration.connections.some(connection => !connection.status)).map(integration => integration.id));
  const connectedProviders = new Set(providers.data.filter(provider => connectedIntegrations.has(provider.integrationID ?? provider.id)).map(provider => provider.id));
  const models = catalog.data.filter(model => model.enabled && model.status !== 'deprecated').sort((left, right) => {
    const a = rates(left); const b = rates(right);
    const priceA = a ? a.input * 4 + a.output : Number.POSITIVE_INFINITY;
    const priceB = b ? b.input * 4 + b.output : Number.POSITIVE_INFINITY;
    return priceA - priceB || left.id.localeCompare(right.id);
  });
  const connectedModels = models.filter(model => connectedProviders.has(model.providerID));
  console.log(JSON.stringify({ serverVersion: info.version, enabledChatModels: models.length, connectedProviders: [...connectedProviders], integrationConnections: integrations.data.filter(integration => integration.connections.length).map(integration => ({ integrationID: integration.id, statuses: integration.connections.map(connection => connection.status?.status ?? 'connected') })), defaultModel: defaultModel.data && { providerID: defaultModel.data.providerID, id: defaultModel.data.id, perMillionTokens: rates(defaultModel.data) }, cheapestConnected: connectedModels.slice(0, 12).map(model => ({ providerID: model.providerID, id: model.id, perMillionTokens: rates(model) })) }));
  if (!models.length) {
    console.log('SKIP: the existing global configuration exposes no enabled non-deprecated chat model');
  } else if (!runInference) {
    console.log('CATALOG ONLY: add --run to authorize one tiny prompt with an existing model connection');
  } else {
    const requested = process.env.OPENCODE_INFERENCE_MODEL;
    const model = requested ? models.find(model => `${model.providerID}/${model.id}` === requested) : connectedModels[0];
    assert.ok(model, 'No connected model matches this check. Inspect the catalog before an explicit --run request.');
    const price = rates(model);
    assert.ok(price, 'The selected model has no catalog prices');
    assert.ok(price.input * 0.01 + price.output * 0.001 < 0.05, 'The selected model exceeds the conservative $0.05 estimate');
    const variant = model.variants.find(item => ['none', 'minimal', 'low'].includes(item.id))?.id;
    const session = await client.session.create({
      title: 'Live mobile connection verification', location: { directory },
      model: { id: model.id, providerID: model.providerID, variant },
      permissions: [{ action: '*', resource: '*', effect: 'deny' }],
    });
    sessionID = session.id;
    const events: OpenCodeEvent[] = [];
    let projected: SessionMessageInfo[] = [];
    let connected = false;
    let eventError: unknown;
    let executionError: SessionStructuredError | undefined;
    let finished = false;
    eventTask = (async () => {
      try {
        for await (const event of client!.event.subscribe({ signal: stream.signal })) {
          if (event.type === 'server.connected') connected = true;
          if (!('sessionID' in event.data) || event.data.sessionID !== session.id) continue;
          events.push(event);
          projected = projectLiveEvent(projected, event, session.id);
          if (event.type === 'session.execution.failed') executionError = event.data.error;
          if (event.type === 'session.execution.succeeded' || event.type === 'session.execution.failed') finished = true;
        }
      } catch (error) {
        if (!stream.signal.aborted) eventError = error;
      }
    })();
    await until(() => connected, 'SSE connection');
    await client.session.prompt({ sessionID: session.id, text: `Reply with exactly: ${expected}` });
    await until(() => {
      if (eventError) throw eventError;
      if (executionError) {
        const message = executionError.message.replace(/(?:Bearer|Basic)\s+\S+/gi, '[redacted]').replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, '$1[redacted]').replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[redacted]').replaceAll(token!, '[redacted]').slice(0, 500);
        throw new Error(`Server inference failure: ${JSON.stringify({ type: executionError.type, status: executionError.status, message })}`);
      }
      return finished;
    }, 'one inference result', 90_000);
    const history = await client.message.list({ sessionID: session.id, order: 'asc', limit: 20 });
    const durable = history.data.filter((message): message is SessionMessageAssistant => message.type === 'assistant');
    assert.ok(events.some(event => event.type === 'session.text.delta'), 'No real text delta arrived');
    assert.ok(events.some(event => event.type === 'session.step.ended'), 'No completed assistant step arrived');
    assert.ok(!events.some(event => event.type === 'session.tool.called'), 'This check must not use tools');
    assert.equal(durable.length, 1);
    assert.equal(text(durable[0]).trim(), expected);
    const live = projected.find((message): message is SessionMessageAssistant => message.type === 'assistant' && message.id === durable[0].id);
    assert.ok(live);
    assert.equal(text(live), text(durable[0]));
    assert.equal(live.finish, durable[0].finish);
    console.log(JSON.stringify({ result: 'PASS', providerID: model.providerID, modelID: model.id, deltaEvents: events.filter(event => event.type === 'session.text.delta').length, assistantText: text(durable[0]), recordedCostUSD: durable[0].cost, reducerMatchesDurableMessage: true }));
  }
} finally {
  stream.abort();
  await eventTask;
  if (client && sessionID) {
    await client.session.interrupt({ sessionID }).catch(() => {});
    await client.session.remove({ sessionID }).catch(() => {});
  }
  process.off('SIGINT', interrupt);
  process.off('SIGTERM', interrupt);
  if (server.exitCode === null && server.signalCode === null) {
    server.kill('SIGTERM');
    await until(() => server.exitCode !== null || server.signalCode !== null, 'server shutdown', 5_000).catch(async () => {
      server.kill('SIGKILL');
      await until(() => server.exitCode !== null || server.signalCode !== null, 'forced server shutdown', 5_000);
    });
  }
  await rm(directory, { recursive: true, force: true });
}
