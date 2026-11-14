import assert from "node:assert/strict";
import test from "node:test";

import type { ModelInfo, ProviderInfo } from "@opencode/client";

import { modelPreferenceID } from "../src/lib/model-preference-id";
import {
  groupModels,
  matchesModelSearch,
} from "../src/screens/chat/model-groups";

const model = (providerID: string, id: string, name: string) =>
  ({ id, name, providerID }) as ModelInfo;

const providers = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
  { id: "zeta", name: "Zeta Labs" },
  { id: "alpha", name: "Alpha AI" },
] as ProviderInfo[];

const models = [
  model("zeta", "z1", "Zed"),
  model("openai", "gpt-5", "GPT-5"),
  model("anthropic", "sonnet", "Sonnet"),
  model("anthropic", "haiku", "Haiku"),
  model("alpha", "a1", "Aleph"),
];

const input = { favoriteIDs: [], models, providers, recentIDs: [], search: "" };

test("search ignores case and punctuation", () => {
  assert.equal(matchesModelSearch("gpt5", ["GPT-5"]), true);
  assert.equal(matchesModelSearch("GPT 5", ["gpt-5"]), true);
  assert.equal(matchesModelSearch("claude", ["GPT-5"]), false);
});

test("search matches the provider name", () => {
  const groups = groupModels({ ...input, search: "anthrop" });
  assert.deepEqual(
    groups.map((group) => group.title),
    ["Anthropic"]
  );
  assert.equal(groups[0]?.items.length, 2);
});

test("groups follow popular order, then alphabetical order", () => {
  const groups = groupModels(input);
  assert.deepEqual(
    groups.map((group) => group.title),
    ["Anthropic", "OpenAI", "Alpha AI", "Zeta Labs"]
  );
  assert.deepEqual(
    groups[0]?.items.map((item) => item.name),
    ["Haiku", "Sonnet"]
  );
});

test("favorites and recent models lead and leave their provider group", () => {
  const favorite = modelPreferenceID("anthropic", "sonnet");
  const groups = groupModels({
    ...input,
    favoriteIDs: [favorite],
    recentIDs: [favorite, modelPreferenceID("openai", "gpt-5")],
  });
  assert.deepEqual(
    groups.map((group) => group.key),
    ["favorite", "recent", "anthropic", "alpha", "zeta"]
  );
  assert.deepEqual(
    groups[0]?.items.map((item) => item.id),
    ["sonnet"]
  );
  assert.deepEqual(
    groups[1]?.items.map((item) => item.id),
    ["gpt-5"]
  );
  assert.deepEqual(
    groups[2]?.items.map((item) => item.id),
    ["haiku"]
  );
});

test("a search removes the favorites and recent sections", () => {
  const favorite = modelPreferenceID("anthropic", "sonnet");
  const groups = groupModels({
    ...input,
    favoriteIDs: [favorite],
    recentIDs: [favorite],
    search: "sonnet",
  });
  assert.deepEqual(
    groups.map((group) => group.key),
    ["anthropic"]
  );
});
