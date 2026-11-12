import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

import type {
  OpenCodeEvent,
  SessionMessageAssistant,
  SessionMessageInfo,
} from "@opencode/client";

import {
  mergeMessages,
  parseComposer,
  projectLiveEvent,
  serverFileUri,
} from "../src/lib/chat";
import { createStreamBatch } from "../src/lib/stream-batch";

const base = {
  created: 1,
  durable: { aggregateID: "s1", seq: 1, version: 1 as const },
  id: "event",
};
const owned = { assistantMessageID: "a1", sessionID: "s1" };

test("chat displays text and reasoning deltas with independent fragment ordinals", () => {
  const events: OpenCodeEvent[] = [
    {
      ...base,
      data: {
        ...owned,
        agent: "build",
        model: { id: "m", providerID: "p" },
        started: 1,
      },
      type: "session.step.started",
    },
    {
      ...base,
      data: { ...owned, ordinal: 0 },
      type: "session.reasoning.started",
    },
    {
      ...base,
      data: { ...owned, delta: "Think", ordinal: 0 },
      type: "session.reasoning.delta",
    },
    { ...base, data: { ...owned, ordinal: 0 }, type: "session.text.started" },
    {
      ...base,
      data: { ...owned, delta: "Hello ", ordinal: 0 },
      type: "session.text.delta",
    },
    {
      ...base,
      data: { ...owned, delta: "world", ordinal: 0 },
      type: "session.text.delta",
    },
    {
      ...base,
      data: { ...owned, ordinal: 0, text: "Hello world!" },
      type: "session.text.ended",
    },
  ];
  let messages: SessionMessageInfo[] = [];
  for (const event of events) {
    messages = projectLiveEvent(messages, event, "s1");
  }
  const message = messages[0] as SessionMessageAssistant;
  assert.deepEqual(message.content, [
    { text: "Think", type: "reasoning" },
    { text: "Hello world!", type: "text" },
  ]);
  assert.equal(
    projectLiveEvent(
      messages,
      {
        ...base,
        data: { ...owned, delta: "leak", ordinal: 0, sessionID: "other" },
        type: "session.text.delta",
      },
      "s1"
    ),
    messages
  );
});

test("chat updates the right concurrent tool and preserves the terminal result", () => {
  const events: OpenCodeEvent[] = [
    {
      ...base,
      data: {
        ...owned,
        agent: "build",
        model: { id: "m", providerID: "p" },
        started: 1,
      },
      type: "session.step.started",
    },
    {
      ...base,
      data: { ...owned, id: "one", name: "read" },
      type: "session.tool.input.started",
    },
    {
      ...base,
      data: { ...owned, id: "two", name: "shell" },
      type: "session.tool.input.started",
    },
    {
      ...base,
      data: { ...owned, delta: '{"path":', id: "one" },
      type: "session.tool.input.delta",
    },
    {
      ...base,
      data: { ...owned, delta: '"a"}', id: "one" },
      type: "session.tool.input.delta",
    },
    {
      ...base,
      data: { ...owned, executed: true, id: "one", input: { path: "a" } },
      type: "session.tool.called",
    },
    {
      ...base,
      data: {
        ...owned,
        content: [{ text: "Contents", type: "text" }],
        executed: true,
        id: "one",
      },
      durable: { ...base.durable, version: 2 },
      type: "session.tool.success",
    },
  ];
  let projected: SessionMessageInfo[] = [];
  for (const event of events) {
    projected = projectLiveEvent(projected, event, "s1");
  }
  const message = projected[0] as SessionMessageAssistant;
  const [first, second] = message.content;
  assert.equal(first.type, "tool");
  if (first.type === "tool") {
    assert.deepEqual(first.state, {
      content: [{ text: "Contents", type: "text" }],
      input: { path: "a" },
      metadata: undefined,
      status: "completed",
    });
  }
  assert.equal(second.type, "tool");
  if (second.type === "tool") {
    assert.deepEqual(second.state, { input: "", status: "streaming" });
  }
});

test("composer routes registered commands and shell input while preserving absolute paths as prompts", () => {
  assert.deepEqual(parseComposer("/review file.ts\nCheck errors", ["review"]), {
    name: "review",
    text: "file.ts\nCheck errors",
    type: "command",
  });
  assert.deepEqual(parseComposer("/Users/me/project", ["review"]), {
    text: "/Users/me/project",
    type: "prompt",
  });
  assert.deepEqual(parseComposer("! pwd", []), {
    command: "pwd",
    type: "shell",
  });
  assert.deepEqual(parseComposer("!", []), { text: "!", type: "prompt" });
  assert.equal(serverFileUri("/a/file #1.ts"), "file:///a/file%20%231.ts");
  assert.throws(() => serverFileUri("../phone/file"), /absolute/u);
});

test("message pages deduplicate overlap and retain the latest content in chronological order", () => {
  const early: SessionMessageInfo = {
    id: "one",
    text: "Before",
    time: { created: 1 },
    type: "user",
  };
  const late: SessionMessageInfo = {
    id: "two",
    text: "Later",
    time: { created: 2 },
    type: "user",
  };
  const updated = { ...early, text: "After" };
  assert.deepEqual(mergeMessages([late, early], [updated]), [updated, late]);
});

test("batched token updates flush before the authoritative text end and cannot append afterward", async () => {
  let messages: SessionMessageInfo[] = [];
  const batch = createStreamBatch<OpenCodeEvent>(
    (events) => {
      let current = messages;
      for (const event of events) {
        current = projectLiveEvent(current, event, "s1");
      }
      messages = current;
    },
    { delayMs: 50 }
  );
  const dispatch = (event: OpenCodeEvent) => {
    if (event.type.endsWith(".delta")) {
      batch.push(event);
    } else {
      batch.flush();
      messages = projectLiveEvent(messages, event, "s1");
    }
  };
  dispatch({
    ...base,
    data: {
      ...owned,
      agent: "build",
      model: { id: "m", providerID: "p" },
      started: 1,
    },
    type: "session.step.started",
  });
  dispatch({
    ...base,
    data: { ...owned, ordinal: 0 },
    type: "session.text.started",
  });
  dispatch({
    ...base,
    data: { ...owned, delta: "Hello ", ordinal: 0 },
    type: "session.text.delta",
  });
  dispatch({
    ...base,
    data: { ...owned, delta: "world", ordinal: 0 },
    type: "session.text.delta",
  });
  dispatch({
    ...base,
    data: { ...owned, ordinal: 0, text: "Hello world!" },
    type: "session.text.ended",
  });
  assert.deepEqual((messages[0] as SessionMessageAssistant).content, [
    { text: "Hello world!", type: "text" },
  ]);
  await delay(80);
  assert.deepEqual((messages[0] as SessionMessageAssistant).content, [
    { text: "Hello world!", type: "text" },
  ]);
  batch.clear();
});
