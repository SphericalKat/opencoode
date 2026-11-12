import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type {
  ModelInfo,
  OpenCodeEvent,
  SessionMessageAssistant,
  SessionMessageInfo,
  SessionStructuredError,
} from "@opencode/client";

import { projectLiveEvent } from "../src/lib/chat";
import { createClient } from "../src/lib/client";
import type { Connection } from "../src/lib/client";

const runInference = process.argv.includes("--run");
const expected = "OpenCode mobile connection verified";
const directory = await realpath(
  await mkdtemp(path.join(tmpdir(), "opencoode-inference-"))
);
await writeFile(
  path.join(directory, "README.md"),
  "Temporary project for one OpenCode connection check.\n"
);
execFileSync("git", ["init", "-q", "-b", "main"], { cwd: directory });
const env = { ...process.env };
delete env.OPENCODE_PASSWORD;
delete env.OPENCODE_SERVER_PASSWORD;
const server = spawn(
  process.env.OPENCODE_BINARY || "opencode",
  ["serve", "--hostname", "127.0.0.1", "--port", "0"],
  {
    cwd: directory,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  }
);
let output = "";
let url: string | undefined;
let token: string | undefined;
let launchError: Error | undefined;
server.on("error", (error) => {
  launchError = error;
});
server.stdout?.on("data", (bytes: Buffer) => {
  output = (output + bytes.toString()).slice(-16_384);
  url = /server listening on (?<url>https?:\/\/[^\s]+)/u.exec(output)?.[1];
  token = /server password (?<token>[^\s]+)/u.exec(output)?.[1];
});
server.stderr?.on("data", () => null);
const interrupt = () => {
  server.kill("SIGTERM");
};
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
const stream = new AbortController();
let eventTask: Promise<void> | undefined;
let sessionID: string | undefined;
let client: ReturnType<typeof createClient> | undefined;

const until = (
  check: () => boolean | Promise<boolean>,
  label: string,
  timeout = 30_000
): Promise<void> => {
  const deadline = Date.now() + timeout;
  const poll = async (): Promise<void> => {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out: ${label}`);
    }
    if (await check()) {
      return;
    }
    await delay(50);
    return poll();
  };
  return poll();
};

const rates = (model: ModelInfo) => {
  const cost = model.cost.find((tier) => !tier.tier) ?? model.cost[0];
  return cost ? { input: cost.input, output: cost.output } : undefined;
};

const text = (message: SessionMessageAssistant) =>
  message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

try {
  await until(
    () => {
      if (launchError) {
        throw launchError;
      }
      if (server.exitCode !== null || server.signalCode !== null) {
        throw new Error("OpenCode exited during startup");
      }
      return Boolean(url && token);
    },
    "server startup",
    45_000
  );
  assert.ok(url);
  const connection: Connection = {
    id: "inference-check",
    name: "Inference check",
    token,
    url,
  };
  client = createClient(connection, (input, init) =>
    fetch(input, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(20_000),
    })
  );
  const [catalog, providers, integrations, defaultModel, info] =
    await Promise.all([
      client.model.list({ location: { directory }, types: ["chat"] }),
      client.provider.list({ location: { directory } }),
      client.integration.list({ location: { directory } }),
      client.model.default({ location: { directory } }),
      client.server.info(),
    ]);
  const connectedIntegrations = new Set(
    integrations.data
      .filter((integration) =>
        integration.connections.some((entry) => !entry.status)
      )
      .map((integration) => integration.id)
  );
  const connectedProviders = new Set(
    providers.data
      .filter((provider) =>
        connectedIntegrations.has(provider.integrationID ?? provider.id)
      )
      .map((provider) => provider.id)
  );
  const models = catalog.data
    .filter((model) => model.enabled && model.status !== "deprecated")
    .toSorted((left, right) => {
      const a = rates(left);
      const b = rates(right);
      const priceA = a ? a.input * 4 + a.output : Number.POSITIVE_INFINITY;
      const priceB = b ? b.input * 4 + b.output : Number.POSITIVE_INFINITY;
      return priceA - priceB || left.id.localeCompare(right.id);
    });
  const connectedModels = models.filter((model) =>
    connectedProviders.has(model.providerID)
  );
  console.log(
    JSON.stringify({
      cheapestConnected: connectedModels.slice(0, 12).map((model) => ({
        id: model.id,
        perMillionTokens: rates(model),
        providerID: model.providerID,
      })),
      connectedProviders: [...connectedProviders],
      defaultModel: defaultModel.data && {
        id: defaultModel.data.id,
        perMillionTokens: rates(defaultModel.data),
        providerID: defaultModel.data.providerID,
      },
      enabledChatModels: models.length,
      integrationConnections: integrations.data
        .filter((integration) => integration.connections.length)
        .map((integration) => ({
          integrationID: integration.id,
          statuses: integration.connections.map(
            (entry) => entry.status?.status ?? "connected"
          ),
        })),
      serverVersion: info.version,
    })
  );
  if (!models.length) {
    console.log(
      "SKIP: the existing global configuration exposes no enabled non-deprecated chat model"
    );
  } else if (runInference) {
    const requested = process.env.OPENCODE_INFERENCE_MODEL;
    const model = requested
      ? models.find(
          (candidate) => `${candidate.providerID}/${candidate.id}` === requested
        )
      : connectedModels[0];
    assert.ok(
      model,
      "No connected model matches this check. Inspect the catalog before an explicit --run request."
    );
    const price = rates(model);
    assert.ok(price, "The selected model has no catalog prices");
    assert.ok(
      price.input * 0.01 + price.output * 0.001 < 0.05,
      "The selected model exceeds the conservative $0.05 estimate"
    );
    const variant = model.variants.find((item) =>
      ["none", "minimal", "low"].includes(item.id)
    )?.id;
    const session = await client.session.create({
      location: { directory },
      model: { id: model.id, providerID: model.providerID, variant },
      permissions: [{ action: "*", effect: "deny", resource: "*" }],
      title: "Live mobile connection verification",
    });
    sessionID = session.id;
    const events: OpenCodeEvent[] = [];
    let projected: SessionMessageInfo[] = [];
    let connected = false;
    let eventError: unknown;
    let executionError: SessionStructuredError | undefined;
    let finished = false;
    const eventClient = client;
    eventTask = (async () => {
      try {
        for await (const event of eventClient.event.subscribe({
          signal: stream.signal,
        })) {
          if (event.type === "server.connected") {
            connected = true;
          }
          if (
            !("sessionID" in event.data) ||
            event.data.sessionID !== session.id
          ) {
            continue;
          }
          events.push(event);
          projected = projectLiveEvent(projected, event, session.id);
          if (event.type === "session.execution.failed") {
            executionError = event.data.error;
          }
          if (
            event.type === "session.execution.succeeded" ||
            event.type === "session.execution.failed"
          ) {
            finished = true;
          }
        }
      } catch (error) {
        if (!stream.signal.aborted) {
          eventError = error;
        }
      }
    })();
    await until(() => connected, "SSE connection");
    await client.session.prompt({
      sessionID: session.id,
      text: `Reply with exactly: ${expected}`,
    });
    await until(
      () => {
        if (eventError) {
          throw eventError;
        }
        if (executionError) {
          const message = executionError.message
            .replaceAll(/(?:Bearer|Basic)\s+\S+/giu, "[redacted]")
            .replaceAll(
              /(?<param>[?&](?:key|token|api_key)=)[^&\s]+/giu,
              "$1[redacted]"
            )
            .replaceAll(/\bsk-[\w-]+\b/gu, "[redacted]")
            .replaceAll(String(token), "[redacted]")
            .slice(0, 500);
          throw new Error(
            `Server inference failure: ${JSON.stringify({ message, status: executionError.status, type: executionError.type })}`
          );
        }
        return finished;
      },
      "one inference result",
      90_000
    );
    const history = await client.message.list({
      limit: 20,
      order: "asc",
      sessionID: session.id,
    });
    const durable = history.data.filter(
      (message): message is SessionMessageAssistant =>
        message.type === "assistant"
    );
    assert.ok(
      events.some((event) => event.type === "session.text.delta"),
      "No real text delta arrived"
    );
    assert.ok(
      events.some((event) => event.type === "session.step.ended"),
      "No completed assistant step arrived"
    );
    assert.ok(
      !events.some((event) => event.type === "session.tool.called"),
      "This check must not use tools"
    );
    assert.equal(durable.length, 1);
    assert.equal(text(durable[0]).trim(), expected);
    const live = projected.find(
      (message): message is SessionMessageAssistant =>
        message.type === "assistant" && message.id === durable[0].id
    );
    assert.ok(live);
    assert.equal(text(live), text(durable[0]));
    assert.equal(live.finish, durable[0].finish);
    console.log(
      JSON.stringify({
        assistantText: text(durable[0]),
        deltaEvents: events.filter(
          (event) => event.type === "session.text.delta"
        ).length,
        modelID: model.id,
        providerID: model.providerID,
        recordedCostUSD: durable[0].cost,
        reducerMatchesDurableMessage: true,
        result: "PASS",
      })
    );
  } else {
    console.log(
      "CATALOG ONLY: add --run to authorize one tiny prompt with an existing model connection"
    );
  }
} finally {
  stream.abort();
  await eventTask;
  if (client && sessionID) {
    await client.session.interrupt({ sessionID }).catch(() => null);
    await client.session.remove({ sessionID }).catch(() => null);
  }
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
  if (server.exitCode === null && server.signalCode === null) {
    server.kill("SIGTERM");
    await until(
      () => server.exitCode !== null || server.signalCode !== null,
      "server shutdown",
      5000
    ).catch(async () => {
      server.kill("SIGKILL");
      await until(
        () => server.exitCode !== null || server.signalCode !== null,
        "forced server shutdown",
        5000
      );
    });
  }
  await rm(directory, { force: true, recursive: true });
}
