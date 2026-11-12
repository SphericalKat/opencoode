import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { FormField, OpenCodeEvent } from "@opencode/client";

import { connect, createClient } from "../src/lib/client";
import type { Connection } from "../src/lib/client";
import { prepareFormAnswer } from "../src/lib/forms";
import { prepareSchedule } from "../src/lib/schedules";

const fixtureMode = process.argv.includes("--fixture");
const fixtureFile = "/tmp/opencoode-live-connection.json";

const until = async (
  check: () => boolean | Promise<boolean>,
  description: string,
  timeout = 10_000
) => {
  const deadline = Date.now() + timeout;
  const poll = async (): Promise<void> => {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out: ${description}`);
    }
    if (await check()) {
      return;
    }
    await delay(50);
    await poll();
  };
  await poll();
};

const stopServer = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  try {
    await until(
      () => child.exitCode !== null || child.signalCode !== null,
      "OpenCode shutdown",
      5000
    );
  } catch {
    child.kill("SIGKILL");
    await until(
      () => child.exitCode !== null || child.signalCode !== null,
      "OpenCode forced shutdown",
      5000
    );
  }
};

const startServer = async (port: number) => {
  const root = await realpath(
    await mkdtemp(path.join(tmpdir(), "opencoode-live-"))
  );
  const directory = path.join(root, "project");
  await Promise.all(
    ["project", "config", "data", "cache", "state", "home"].map((name) =>
      mkdir(path.join(root, name), { recursive: true })
    )
  );
  await writeFile(
    path.join(directory, "README.md"),
    "Temporary OpenCode integration project.\n"
  );
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: directory });
  execFileSync("git", ["add", "README.md"], { cwd: directory });
  execFileSync(
    "git",
    [
      "-c",
      "user.name=Integration Test",
      "-c",
      "user.email=integration@example.invalid",
      "commit",
      "-qm",
      "test: create integration project",
    ],
    { cwd: directory }
  );
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test" };
  for (const name of [
    "PATH",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "TERM",
    "SHELL",
    "SystemRoot",
  ]) {
    if (process.env[name]) {
      env[name] = process.env[name];
    }
  }
  Object.assign(env, {
    OPENCODE_CONFIG_CONTENT: JSON.stringify({
      experimental: { schedules: true },
    }),
    OPENCODE_CONFIG_DIR: path.join(root, "config"),
    OPENCODE_DISABLE_CLAUDE_CODE: "1",
    OPENCODE_DISABLE_MODELS_FETCH: "1",
    OPENCODE_DISABLE_PROJECT_CONFIG: "1",
    OPENCODE_TEST_HOME: path.join(root, "home"),
    XDG_CACHE_HOME: path.join(root, "cache"),
    XDG_CONFIG_HOME: path.join(root, "config"),
    XDG_DATA_HOME: path.join(root, "data"),
    XDG_STATE_HOME: path.join(root, "state"),
  });
  const child = spawn(
    process.env.OPENCODE_BINARY || "opencode",
    [
      "serve",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
      "--cors",
      "http://localhost:8081",
      "--cors",
      "http://localhost:8082",
    ],
    {
      cwd: directory,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  const interrupt = () => {
    child.kill("SIGTERM");
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  let output = "";
  let url: string | undefined;
  let password: string | undefined;
  let spawnError: Error | undefined;
  child.on("error", (error) => {
    spawnError = error;
  });
  child.stdout?.on("data", (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-16_384);
    url = /server listening on (?<url>https?:\/\/[^\s]+)/u.exec(output)?.groups
      ?.url;
    password = /server password (?<password>[^\s]+)/u.exec(output)?.groups
      ?.password;
  });
  child.stderr?.on("data", () => {
    // Drain stderr so the server never blocks on a full pipe.
  });
  try {
    await until(
      () => {
        if (spawnError) {
          throw spawnError;
        }
        if (child.exitCode !== null || child.signalCode !== null) {
          throw new Error("OpenCode exited during startup");
        }
        return Boolean(url && password);
      },
      "OpenCode server startup",
      45_000
    );
    if (!url || !password) {
      throw new Error("OpenCode server startup");
    }
    const connection: Connection = {
      id: "live-server",
      name: "Local integration server",
      token: password,
      url,
      username: "opencode",
    };
    return { child, connection, directory, interrupt, root };
  } catch (error) {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", interrupt);
    await stopServer(child);
    await rm(root, { force: true, recursive: true });
    throw error;
  }
};

const removeSessionsInOrder = async (
  client: ReturnType<typeof createClient>,
  sessionIDs: string[]
): Promise<void> => {
  const [sessionID, ...rest] = sessionIDs;
  if (sessionID === undefined) {
    return;
  }
  await client.session.remove({ sessionID }).catch(() => {
    // Cleanup is best effort.
  });
  await removeSessionsInOrder(client, rest);
};

const smoke = async (server: Awaited<ReturnType<typeof startServer>>) => {
  const { connection, directory } = server;
  const client = createClient(connection, (input, init) =>
    fetch(input, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(15_000),
    })
  );
  const location = { directory };
  const sessionIDs: string[] = [];
  const ptyIDs: string[] = [];
  const events: OpenCodeEvent[] = [];
  const stream = new AbortController();
  let streamError: unknown;
  const eventTask = (async () => {
    try {
      for await (const event of client.event.subscribe({
        signal: stream.signal,
      })) {
        events.push(event);
      }
    } catch (error) {
      if (!stream.signal.aborted) {
        streamError = error;
      }
    }
  })();
  try {
    const result = await connect(connection);
    assert.match(result.info.version, /^2\./u);
    await assert.rejects(() =>
      connect({ ...connection, token: "incorrect-password" })
    );
    const unauthorized = await fetch(`${connection.url}/api/info`);
    assert.equal(unauthorized.status, 401);
    const pair = await client.server.pair();
    const paired = await connect({
      ...connection,
      token: undefined,
      url: `${connection.url}/auth/connect/${encodeURIComponent(pair.code)}`,
    });
    assert.ok(paired.connection.token);
    await assert.rejects(() =>
      connect({
        ...connection,
        token: undefined,
        url: `${connection.url}/auth/connect/${encodeURIComponent(pair.code)}`,
      })
    );
    console.log("PASS: server authentication and single-use pairing");

    await until(
      () => events.some((event) => event.type === "server.connected"),
      "SSE connection"
    );
    const resolved = await client.location.get({ location });
    assert.equal(resolved.directory, directory);
    const session = await client.session.create({
      location,
      title: "Integration session",
    });
    sessionIDs.push(session.id);
    assert.equal(session.location.directory, directory);
    const projects = await client.project.list();
    assert.ok(projects.some((project) => project.id === session.projectID));
    const listed = await client.session.list({ directory });
    assert.ok(listed.data.some((item) => item.id === session.id));
    await client.session.update({
      sessionID: session.id,
      title: "Renamed integration session",
    });
    const renamed = await client.session.get({ sessionID: session.id });
    assert.equal(renamed.title, "Renamed integration session");
    await client.session.update({ archived: true, sessionID: session.id });
    const archived = await client.session.get({ sessionID: session.id });
    assert.ok(archived.time.archived);
    await client.session.update({ archived: false, sessionID: session.id });
    const unarchived = await client.session.get({ sessionID: session.id });
    assert.equal(unarchived.time.archived, undefined);
    await until(
      () =>
        events.some(
          (event) =>
            event.type === "session.created" &&
            event.data.sessionID === session.id
        ),
      "session SSE event"
    );
    console.log(
      "PASS: project scope, session creation, list, rename, archive, and SSE"
    );

    await client.session.shell({
      command: "printf 'opencoode-history-check'",
      sessionID: session.id,
    });
    await until(async () => {
      const messages = await client.message.list({ sessionID: session.id });
      return messages.data.some(
        (message) =>
          message.type === "shell" &&
          message.output?.output.includes("opencoode-history-check")
      );
    }, "shell message history");
    const history = await client.message.list({
      limit: 1,
      order: "desc",
      sessionID: session.id,
    });
    assert.equal(history.data.length, 1);
    assert.ok(history.cursor.next);
    const older = await client.message.list({
      cursor: history.cursor.next,
      limit: 10,
      sessionID: session.id,
    });
    assert.ok(!older.data.some((message) => message.id === history.data[0].id));
    const fork = await client.session.fork({ sessionID: session.id });
    sessionIDs.push(fork.id);
    assert.equal(fork.fork?.sessionID, session.id);
    const forkHistory = await client.message.list({ sessionID: fork.id });
    assert.ok(
      forkHistory.data.some(
        (message) =>
          message.type === "shell" &&
          message.output?.output.includes("opencoode-history-check")
      )
    );
    const pending = await client.session.prompt({
      delivery: "queue",
      resume: false,
      sessionID: session.id,
      text: "Integration inbox check",
    });
    const inbox = await client.session.inbox.list({ sessionID: session.id });
    assert.ok(inbox.some((item) => item.id === pending.id));
    await client.session.inbox.cancel({
      inboxID: pending.id,
      sessionID: session.id,
    });
    const remainingInbox = await client.session.inbox.list({
      sessionID: session.id,
    });
    assert.ok(!remainingInbox.some((item) => item.id === pending.id));
    await until(
      () =>
        events.some(
          (event) =>
            event.type === "session.shell.ended" &&
            event.data.sessionID === session.id
        ),
      "message SSE event"
    );
    console.log(
      "PASS: shell message history, pagination, fork, queued prompt, and cancellation"
    );

    const instructions = client.experimental.session.instructions.entry;
    await instructions.put({
      key: "integration-review",
      sessionID: session.id,
      value: { guidance: "Verify the instruction contract" },
    });
    const instructionEntries = await instructions.list({
      sessionID: session.id,
    });
    assert.deepEqual(
      instructionEntries.find((item) => item.key === "integration-review")
        ?.value,
      { guidance: "Verify the instruction contract" }
    );
    await instructions.remove({
      key: "integration-review",
      sessionID: session.id,
    });
    const remainingInstructions = await instructions.list({
      sessionID: session.id,
    });
    assert.ok(
      !remainingInstructions.some((item) => item.key === "integration-review")
    );
    const fields = [
      { key: "enabled", required: true, type: "boolean" },
      {
        key: "quantity",
        minimum: 0,
        type: "integer",
        when: [{ key: "enabled", op: "eq", value: true }],
      },
      { format: "uri", key: "url", required: true, type: "string" },
      {
        default: "default-value",
        hidden: true,
        key: "hidden",
        required: true,
        type: "string",
      },
    ] satisfies [FormField, ...FormField[]];
    const form = await client.session.form.create({
      fields,
      sessionID: session.id,
      title: "Integration form",
    });
    const answer = prepareFormAnswer(fields, {
      enabled: false,
      quantity: "5",
      url: "mailto:integration@example.invalid",
    });
    assert.deepEqual(answer.errors, {});
    await client.session.form.reply({
      answer: answer.answer,
      formID: form.id,
      sessionID: session.id,
    });
    const answeredForm = await client.session.form.get({
      formID: form.id,
      sessionID: session.id,
    });
    assert.deepEqual(answeredForm.state, {
      answer: {
        enabled: false,
        hidden: "default-value",
        url: "mailto:integration@example.invalid",
      },
      status: "answered",
    });
    console.log(
      "PASS: instruction values and dynamic form conditions, defaults, and replies"
    );

    await client.session.update({
      permissions: [
        { action: "integration.review", effect: "ask", resource: "*" },
      ],
      sessionID: session.id,
    });
    const permission = await client.permission.create({
      action: "integration.review",
      resources: ["fixture-only"],
      save: ["fixture-only"],
      sessionID: session.id,
    });
    assert.equal(permission.effect, "ask");
    const permissions = await client.permission.list({
      sessionID: session.id,
    });
    assert.ok(permissions.some((item) => item.id === permission.id));
    await client.permission.reply({
      decision: "always",
      requestID: permission.id,
      sessionID: session.id,
    });
    const savedPermissions = await client.permission.saved.list({
      projectID: session.projectID,
    });
    const savedPermission = savedPermissions.find(
      (item) => item.action === "integration.review"
    );
    assert.ok(savedPermission);
    try {
      await client.permission.saved.update({
        id: savedPermission.id,
        resource: "fixture-updated",
      });
      const updatedPermissions = await client.permission.saved.list({
        projectID: session.projectID,
      });
      assert.equal(
        updatedPermissions.find((item) => item.id === savedPermission.id)
          ?.resource,
        "fixture-updated"
      );
    } finally {
      await client.permission.saved.remove({ id: savedPermission.id });
    }
    const remainingPermissions = await client.permission.saved.list({
      projectID: session.projectID,
    });
    assert.ok(
      !remainingPermissions.some((item) => item.id === savedPermission.id)
    );
    console.log("PASS: permission approval and saved approval update/revoke");

    const [major, minor, patch] = result.info.version.split(".").map(Number);
    if (
      major > 2 ||
      (major === 2 && (minor > 2 || (minor === 2 && patch >= 1)))
    ) {
      const schedule = await client.experimental.schedule.create(
        prepareSchedule(session.id, {
          after: "",
          mode: "every",
          name: "Integration schedule",
          prompt: "Verify schedule lifecycle",
          runs: "2",
          timezone: "UTC",
          trigger: "1 day",
          until: "",
        })
      );
      try {
        assert.equal(schedule.when.type, "every");
        assert.equal(schedule.status, "active");
        assert.equal(schedule.remainingRuns, 2);
        const schedules = await client.experimental.schedule.list({
          sessionID: session.id,
        });
        assert.ok(schedules.some((item) => item.id === schedule.id));
        const paused = await client.experimental.schedule.pause({
          scheduleID: schedule.id,
        });
        assert.equal(paused.status, "paused");
        const pausedRead = await client.experimental.schedule.get({
          scheduleID: schedule.id,
        });
        assert.equal(pausedRead.status, "paused");
        const resumed = await client.experimental.schedule.resume({
          scheduleID: schedule.id,
        });
        assert.equal(resumed.status, "active");
      } finally {
        await client.experimental.schedule.delete({ scheduleID: schedule.id });
      }
      const remainingSchedules = await client.experimental.schedule.list({
        sessionID: session.id,
      });
      assert.ok(!remainingSchedules.some((item) => item.id === schedule.id));
      const limits = await client.experimental.usage.limits({ location });
      assert.equal(limits.data, null);
      console.log(
        "PASS: schedule create/list/pause/read/resume/delete and unsigned-account usage"
      );
    } else {
      console.log(
        "SKIP: schedules and usage limits require OpenCode 2.2.1 or later"
      );
    }

    const before = await client.file.read({ location, path: "README.md" });
    assert.equal(
      new TextDecoder().decode(before),
      "Temporary OpenCode integration project.\n"
    );
    await client.experimental.file.write({
      location,
      path: "README.md",
      payload: new TextEncoder().encode(
        "Temporary OpenCode integration project.\nVerified file write.\n"
      ),
    });
    assert.match(
      new TextDecoder().decode(
        await client.file.read({ location, path: "README.md" })
      ),
      /Verified file write/u
    );
    assert.match(
      await readFile(path.join(directory, "README.md"), "utf-8"),
      /Verified file write/u
    );
    const found = await client.file.find({
      location,
      query: "README",
      type: "file",
    });
    assert.ok(found.data.some((file) => file.path === "README.md"));
    const diff = await client.vcs.diff({ location, mode: "working" });
    assert.ok(
      diff.data.some((file) => file.file === "README.md" && file.additions > 0)
    );
    console.log(
      "PASS: binary file read, actual file write, search, and Git diff"
    );

    const created = await client.pty.create({
      args: [
        "-c",
        'printf "opencoode-terminal-ready\\n"; read line; printf "opencoode-terminal-received:%s\\n" "$line"',
      ],
      command: "/bin/sh",
      location,
      title: "Integration terminal",
    });
    ptyIDs.push(created.data.id);
    const token = await client.pty.connect.token({
      location,
      ptyID: created.data.id,
      "x-opencode-ticket": "1",
    });
    const wsURL = new URL(
      `/api/pty/${encodeURIComponent(created.data.id)}/connect`,
      connection.url
    );
    wsURL.protocol = "ws:";
    wsURL.searchParams.set("ticket", token.data.ticket);
    wsURL.searchParams.set("location[directory]", directory);
    const socket = new WebSocket(wsURL);
    socket.binaryType = "arraybuffer";
    let terminal = "";
    let socketError = false;
    socket.addEventListener("error", () => {
      socketError = true;
    });
    socket.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data === "string") {
        terminal += event.data;
      } else if (
        event.data instanceof ArrayBuffer &&
        new Uint8Array(event.data)[0] !== 0
      ) {
        terminal += new TextDecoder().decode(event.data);
      }
    });
    try {
      await until(() => {
        if (socketError) {
          throw new Error("PTY socket failed");
        }
        return (
          socket.readyState === WebSocket.OPEN &&
          terminal.includes("opencoode-terminal-ready")
        );
      }, "PTY output");
      await client.pty.update({
        location,
        ptyID: created.data.id,
        size: { cols: 100, rows: 30 },
      });
      socket.send("input-check\n");
      await until(
        () => terminal.includes("opencoode-terminal-received:input-check"),
        "PTY input response"
      );
    } finally {
      socket.close();
    }
    console.log(
      "PASS: PTY ticket, WebSocket output, resize, and terminal input"
    );
    if (streamError) {
      throw streamError;
    }
    console.log(
      "SKIP: model inference and provider OAuth require configured credentials; none were copied into this server"
    );
    return { client, ptyIDs, sessionIDs };
  } finally {
    stream.abort();
    await eventTask;
    if (!fixtureMode) {
      await Promise.all(
        ptyIDs.map((ptyID) =>
          client.pty.remove({ location, ptyID }).catch(() => {
            // Cleanup is best effort.
          })
        )
      );
      await removeSessionsInOrder(client, sessionIDs.toReversed());
    }
  }
};

const server = await startServer(fixtureMode ? 4098 : 0);
try {
  await smoke(server);
  if (fixtureMode) {
    await writeFile(
      fixtureFile,
      JSON.stringify({
        connection: server.connection,
        directory: server.directory,
        pid: server.child.pid,
        root: server.root,
      }),
      { mode: 0o600 }
    );
    console.log(
      "READY: browser fixture on port 4098; private connection file created"
    );
    const stopped = Promise.withResolvers();
    process.once("SIGINT", stopped.resolve);
    process.once("SIGTERM", stopped.resolve);
    server.child.once("exit", stopped.resolve);
    await stopped.promise;
  }
} finally {
  process.off("SIGINT", server.interrupt);
  process.off("SIGTERM", server.interrupt);
  await stopServer(server.child);
  await rm(server.root, { force: true, recursive: true });
  if (fixtureMode) {
    await rm(fixtureFile, { force: true });
  }
}
