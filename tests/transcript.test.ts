import assert from "node:assert/strict";
import test from "node:test";

import type {
  SessionMessageAssistantTool,
  SessionMessageInfo,
} from "@opencode/client";

import {
  agentSwitchLabel,
  inlineCodeKind,
  isCredentialError,
  isInterruptedError,
  modelSwitchLabel,
  parsePathLineSuffix,
  splitErrorTitle,
  tableColumnWidths,
  toolRow,
  unwrapErrorMessage,
  visibleTranscriptMessages,
} from "../src/lib/transcript";

const time = { created: 1 };
const model = { id: "m", providerID: "p" };
const user = (id: string) =>
  ({ id, text: "hi", time, type: "user" }) as unknown as SessionMessageInfo;
const assistant = (id: string, error?: { type: string; message: string }) =>
  ({
    agent: "build",
    content: [],
    error,
    id,
    model,
    time,
    type: "assistant",
  }) as unknown as SessionMessageInfo;
const idle = (id: string, error?: { type: string; message: string }) =>
  ({
    error,
    id,
    outcome: error ? "failed" : "succeeded",
    time,
    type: "idle",
  }) as unknown as SessionMessageInfo;
const failure = { message: "boom", type: "provider.error" };

test("parsePathLineSuffix strips line and column suffixes", () => {
  assert.deepEqual(parsePathLineSuffix("src/a.ts:12"), { path: "src/a.ts" });
  assert.deepEqual(parsePathLineSuffix("src/a.ts:12:3-14:2"), {
    path: "src/a.ts",
  });
  assert.deepEqual(parsePathLineSuffix("src/a.ts#L10C2-L20"), {
    path: "src/a.ts",
  });
  assert.deepEqual(parsePathLineSuffix("C:12"), { path: "C:12" });
  assert.deepEqual(parsePathLineSuffix("src/a.ts"), { path: "src/a.ts" });
});

test("inlineCodeKind separates paths, urls, and code", () => {
  assert.equal(inlineCodeKind("https://example.com/a"), "url");
  assert.equal(inlineCodeKind("src/app.tsx:42"), "path");
  assert.equal(inlineCodeKind("README"), "path");
  assert.equal(inlineCodeKind("Dockerfile"), "path");
  assert.equal(inlineCodeKind("useState"), undefined);
  assert.equal(inlineCodeKind("a b.ts"), undefined);
  assert.equal(inlineCodeKind("*.ts"), undefined);
  assert.equal(inlineCodeKind("\\\\host\\share"), undefined);
  assert.equal(inlineCodeKind("git://host/repo"), undefined);
  assert.equal(inlineCodeKind(""), undefined);
});

test("unwrapErrorMessage reads provider error envelopes", () => {
  assert.equal(
    unwrapErrorMessage('{"error":{"type":"auth","message":"Bad key"}}'),
    "auth: Bad key"
  );
  assert.equal(
    unwrapErrorMessage('Error: {"error":{"message":"Only message"}}'),
    "Only message"
  );
  assert.equal(unwrapErrorMessage('{"error":{"code":"E1"}}'), "E1");
  assert.equal(unwrapErrorMessage('{"message":"top"}'), "top");
  assert.equal(unwrapErrorMessage('{"error":"plain"}'), "plain");
  assert.equal(
    unwrapErrorMessage(
      JSON.stringify(JSON.stringify({ error: { message: "nested" } }))
    ),
    "nested"
  );
  assert.equal(
    unwrapErrorMessage(
      'Request failed 400 {"error":{"message":"embedded"}} end'
    ),
    "embedded"
  );
  assert.equal(unwrapErrorMessage("plain text"), "plain text");
});

test("splitErrorTitle splits only on a colon before the first url", () => {
  assert.deepEqual(splitErrorTitle("Rate limit: try later"), {
    detail: " try later",
    title: "Rate limit:",
  });
  assert.deepEqual(splitErrorTitle("See https://a.test:8080/x"), {
    detail: "See https://a.test:8080/x",
  });
  assert.deepEqual(splitErrorTitle("no title"), { detail: "no title" });
});

test("isInterruptedError matches abort and interrupt types", () => {
  assert.equal(isInterruptedError({ type: "AbortError" }), true);
  assert.equal(isInterruptedError({ type: "session.interrupted" }), true);
  assert.equal(isInterruptedError({ type: "provider.error" }), false);
  assert.equal(isInterruptedError(), false);
});

test("isCredentialError flags authentication failures only", () => {
  assert.equal(
    isCredentialError({ message: "Invalid credential", type: "provider.auth" }),
    true
  );
  assert.equal(
    isCredentialError({ message: "Request failed: 401", type: "api" }),
    true
  );
  assert.equal(
    isCredentialError({ message: "Aborted", type: "session.interrupted" }),
    false
  );
  assert.equal(
    isCredentialError({ message: "Too many requests", type: "rate_limit" }),
    false
  );
  assert.equal(isCredentialError(), false);
});

test("visibleTranscriptMessages drops idle rows that repeat a failure", () => {
  const ok = [user("u"), assistant("a"), idle("i")];
  assert.deepEqual(
    visibleTranscriptMessages(ok).map((message) => message.id),
    ["u", "a"]
  );

  const failedTurn = [user("u"), assistant("a", failure), idle("i", failure)];
  assert.deepEqual(
    visibleTranscriptMessages(failedTurn).map((message) => message.id),
    ["u", "a"]
  );

  const interrupted = [
    user("u"),
    assistant("a", { message: "x", type: "AbortError" }),
    idle("i", failure),
  ];
  assert.deepEqual(
    visibleTranscriptMessages(interrupted).map((message) => message.id),
    ["u", "a", "i"]
  );

  const orphan = [user("u"), idle("i", failure)];
  assert.deepEqual(
    visibleTranscriptMessages(orphan).map((message) => message.id),
    ["u", "i"]
  );

  const earlierTurn = [
    user("u1"),
    assistant("a1", failure),
    user("u2"),
    idle("i", failure),
  ];
  assert.deepEqual(
    visibleTranscriptMessages(earlierTurn).map((message) => message.id),
    ["u1", "a1", "u2", "i"]
  );

  const compaction = [
    {
      error: failure,
      id: "c",
      reason: "auto",
      status: "failed",
      time,
      type: "compaction",
    } as unknown as SessionMessageInfo,
    idle("i", failure),
  ];
  assert.deepEqual(
    visibleTranscriptMessages(compaction).map((message) => message.id),
    ["c"]
  );
});

test("visibleTranscriptMessages keeps the identity of kept messages", () => {
  const kept = assistant("a");
  const [first] = visibleTranscriptMessages([kept, idle("i")]);
  assert.equal(first, kept);
});

const tool = (
  name: string,
  state: Record<string, unknown>
): SessionMessageAssistantTool =>
  ({ id: "t", name, state, time }) as unknown as SessionMessageAssistantTool;
const out = [{ text: "line", type: "text" }];

test("toolRow describes read rows and expands only with output", () => {
  const input = { filePath: "/repo/src/a.ts", limit: 20, offset: 5 };
  const withOutput = toolRow(
    tool("read", { content: out, input, status: "completed" }),
    "/repo"
  );
  assert.deepEqual(withOutput, {
    args: ["offset=5", "limit=20"],
    expandable: true,
    kind: "read",
    subtitle: "a.ts",
    title: "Read",
  });
  const without = toolRow(
    tool("read", {
      content: [{ text: "", type: "text" }],
      input,
      status: "completed",
    }),
    "/repo"
  );
  assert.equal(without.expandable, false);
  const failed = toolRow(
    tool("read", { content: out, error: failure, input, status: "error" }),
    "/repo"
  );
  assert.equal(failed.expandable, false);
});

test("toolRow describes search rows", () => {
  const glob = toolRow(
    tool("glob", {
      content: out,
      input: { path: "/repo/src", pattern: "*.ts" },
      metadata: { count: 1 },
      status: "completed",
    }),
    "/repo"
  );
  assert.equal(glob.subtitle, "src");
  assert.deepEqual(glob.args, ["pattern=*.ts"]);
  assert.equal(glob.matches, "1 match");
  assert.equal(glob.kind, "search");
  assert.equal(glob.expandable, true);

  const grep = toolRow(
    tool("grep", {
      input: { include: "*.tsx", path: "/repo", pattern: "foo" },
      metadata: { matches: 7 },
      status: "completed",
      content: out,
    }),
    "/repo"
  );
  assert.equal(grep.subtitle, undefined);
  assert.deepEqual(grep.args, ["pattern=foo", "include=*.tsx"]);
  assert.equal(grep.matches, "7 matches");

  const list = toolRow(
    tool("list", {
      content: [{ text: "", type: "text" }],
      input: { path: "/elsewhere" },
      status: "completed",
    }),
    "/repo"
  );
  assert.equal(list.subtitle, "/elsewhere");
  assert.equal(list.expandable, false);
});

test("toolRow describes other tools and streaming tools", () => {
  const shell = toolRow(
    tool("bash", {
      content: out,
      input: { command: "ls", description: "List files" },
      status: "completed",
    }),
    "/repo"
  );
  assert.equal(shell.title, "Shell");
  assert.equal(shell.subtitle, "List files");
  assert.equal(shell.kind, "other");
  assert.equal(shell.expandable, true);

  const edit = toolRow(
    tool("edit", {
      content: out,
      input: { filePath: "/repo/src/b.ts" },
      status: "completed",
    }),
    "/repo"
  );
  assert.equal(edit.subtitle, "b.ts");

  const streaming = toolRow(
    tool("read", { input: '{"filePath":"/x"}', status: "streaming" }),
    "/repo"
  );
  assert.equal(streaming.subtitle, undefined);
  assert.deepEqual(streaming.args, []);
});

const modelSwitch = (
  next: { id: string; providerID: string; variant?: string },
  previous?: { id: string; providerID: string; variant?: string }
) =>
  ({
    id: "s",
    model: next,
    previous,
    time,
    type: "model-switched",
  }) as unknown as Extract<SessionMessageInfo, { type: "model-switched" }>;

test("modelSwitchLabel names the model or the variant", () => {
  assert.deepEqual(
    modelSwitchLabel(
      modelSwitch({ id: "b", providerID: "p", variant: "high" }, model),
      "Model B"
    ),
    { label: "Switched to Model B", variant: "high" }
  );
  assert.deepEqual(
    modelSwitchLabel(
      modelSwitch({ id: "b", providerID: "p", variant: "default" })
    ),
    { label: "Switched to b", variant: undefined }
  );
  assert.deepEqual(
    modelSwitchLabel(modelSwitch({ ...model, variant: "high" }, model)),
    { label: "Switched variant to high" }
  );
  assert.deepEqual(
    modelSwitchLabel(
      modelSwitch(
        { ...model, variant: "default" },
        { ...model, variant: "high" }
      )
    ),
    { label: "Switched variant to Default" }
  );
  assert.deepEqual(modelSwitchLabel(modelSwitch(model, model)), {
    label: "Switched variant to Default",
  });
});

test("agentSwitchLabel capitalizes the agent", () => {
  assert.equal(agentSwitchLabel("build"), "Switched to Build");
});

test("tableColumnWidths grows columns in proportion when content fits", () => {
  const { widths, scroll } = tableColumnWidths({
    available: 400,
    maxContent: [100, 100, 200],
    minContent: [50, 50, 60],
  });
  assert.equal(scroll, false);
  assert.deepEqual(widths, [100, 100, 200]);
  const wide = tableColumnWidths({
    available: 500,
    maxContent: [100, 100, 200],
    minContent: [50, 50, 60],
  });
  assert.equal(
    wide.widths.reduce((a, b) => a + b, 0),
    500
  );
  assert.deepEqual(wide.widths, [125, 125, 250]);
});

test("tableColumnWidths shrinks toward the minimum, then scrolls", () => {
  const shrunk = tableColumnWidths({
    available: 300,
    maxContent: [200, 200],
    minContent: [60, 100],
  });
  assert.equal(shrunk.scroll, false);
  assert.equal(
    shrunk.widths.reduce((a, b) => a + b, 0),
    300
  );
  assert.ok(shrunk.widths[0] >= 60 && shrunk.widths[1] >= 100);

  const scrolled = tableColumnWidths({
    available: 100,
    maxContent: [200, 200],
    minContent: [80, 90],
  });
  assert.equal(scrolled.scroll, true);
  assert.deepEqual(scrolled.widths, [80, 90]);

  const floor = tableColumnWidths({
    available: 100,
    maxContent: [200, 200],
    minContent: [10, 20],
  });
  assert.deepEqual(floor.widths, [50, 50]);
  assert.equal(floor.scroll, false);
});
