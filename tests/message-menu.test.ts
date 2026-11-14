import assert from "node:assert/strict";
import test from "node:test";

import type { SessionMessageInfo } from "@opencode/client";

import { messageMenuEntries } from "../src/screens/chat/message-menu-entries";
import type { MessageMenuInput } from "../src/screens/chat/message-menu-entries";

const input = (
  message: Record<string, unknown>,
  overrides: Partial<MessageMenuInput> = {}
): MessageMenuInput => ({
  busy: false,
  canFork: true,
  canRevert: true,
  canShowOutput: false,
  draftLoaded: true,
  message: message as unknown as SessionMessageInfo,
  text: "hello",
  ...overrides,
});

test("a user message with text lists every action in order", () => {
  assert.deepEqual(messageMenuEntries(input({ id: "u1", type: "user" })), [
    "copy",
    "selectText",
    "fork",
    "edit",
    "select",
    "revert",
  ]);
});

test("an assistant message with no text omits copy and select text", () => {
  const entries = messageMenuEntries(
    input({ id: "a1", type: "assistant" }, { text: "" })
  );
  assert.deepEqual(entries, ["fork", "select"]);
});

test("a busy session removes fork, edit and revert", () => {
  const entries = messageMenuEntries(
    input({ id: "u1", type: "user" }, { busy: true })
  );
  assert.deepEqual(entries, ["copy", "selectText", "select"]);
});

test("a shell message lists full command output when it can show it", () => {
  const message = { id: "s1", type: "shell" };
  assert.ok(
    messageMenuEntries(input(message, { canShowOutput: true })).includes(
      "commandOutput"
    )
  );
  assert.ok(
    !messageMenuEntries(input(message, { canShowOutput: false })).includes(
      "commandOutput"
    )
  );
});

test("a message with no text and no permitted action has no entries", () => {
  const entries = messageMenuEntries(
    input(
      { id: "a1", type: "assistant" },
      { canFork: false, canRevert: false, text: "  " }
    )
  );
  assert.deepEqual(entries, []);
});

test("select appears only when a bar action applies", () => {
  const shell = { id: "s1", type: "shell" };
  const onlyOutput = messageMenuEntries(
    input(shell, { canFork: false, canShowOutput: true, text: "" })
  );
  assert.deepEqual(onlyOutput, ["commandOutput"]);
  const withCopy = messageMenuEntries(
    input(shell, { canFork: false, canShowOutput: true })
  );
  assert.ok(withCopy.includes("select"));
});
