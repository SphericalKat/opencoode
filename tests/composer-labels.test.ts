import assert from "node:assert/strict";
import test from "node:test";

import { composerModelLabel } from "../src/screens/chat/model-label";

const providers = [{ id: "anthropic", name: "Anthropic" }];

test("hides the provider for native OpenCode models", () => {
  assert.deepEqual(
    composerModelLabel(
      { name: "Big Pickle", providerID: "opencode" },
      providers
    ),
    { model: "Big Pickle" }
  );
});

test("removes the latest marker from the model name", () => {
  assert.deepEqual(
    composerModelLabel(
      { name: "Claude Sonnet (latest)", providerID: "anthropic" },
      providers
    ),
    { model: "Claude Sonnet", provider: "Anthropic" }
  );
});

test("falls back to known and title-cased provider names", () => {
  assert.equal(
    composerModelLabel({ name: "GPT", providerID: "openai-codex" }, [])
      .provider,
    "OpenAI Codex"
  );
  assert.equal(
    composerModelLabel({ name: "X", providerID: "my_custom-host" }, [])
      .provider,
    "My Custom Host"
  );
});
