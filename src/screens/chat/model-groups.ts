import type { ModelInfo, ProviderInfo } from "@opencode/client";

import { modelPreferenceID } from "../../lib/model-preference-id";
import { composerModelLabel } from "./model-label";

export const popularProviders = [
  "opencode-go",
  "opencode",
  "anthropic",
  "github-copilot",
  "openai",
  "google",
  "openrouter",
  "vercel",
];

const nonSearchCharacters = /[^\p{L}\p{N}]+/gu;
const whitespaceRuns = /\s+/gu;

export const normalizeModelSearch = (value: string) =>
  value
    .toLowerCase()
    .replaceAll(nonSearchCharacters, " ")
    .trim()
    .replaceAll(whitespaceRuns, " ");

const compactModelSearch = (value: string) =>
  normalizeModelSearch(value).replaceAll(" ", "");

export const matchesModelSearch = (query: string, values: string[]) => {
  const search = normalizeModelSearch(query);
  if (!search) {
    return true;
  }
  const compactSearch = compactModelSearch(query);
  return values.some(
    (value) =>
      normalizeModelSearch(value).includes(search) ||
      compactModelSearch(value).includes(compactSearch)
  );
};

export interface ModelGroup {
  key: string;
  title: string;
  providerID?: string;
  items: ModelInfo[];
}

interface GroupModelsInput {
  models: ModelInfo[];
  providers: ProviderInfo[];
  search: string;
  favoriteIDs: string[];
  recentIDs: string[];
}

const providerTitle = (model: ModelInfo, providers: ProviderInfo[]) =>
  providers.find((provider) => provider.id === model.providerID)?.name ||
  composerModelLabel(model, providers).provider ||
  model.providerID;

const popularRank = (providerID: string | undefined) => {
  const rank = popularProviders.indexOf(providerID ?? "");
  return rank === -1 ? popularProviders.length : rank;
};

const modelsByID = (models: ModelInfo[], ids: string[]) => {
  const byID = new Map(
    models.map((model) => [
      modelPreferenceID(model.providerID, model.id),
      model,
    ])
  );
  const listed: ModelInfo[] = [];
  for (const id of ids) {
    const model = byID.get(id);
    if (model && !listed.includes(model)) {
      listed.push(model);
    }
  }
  return listed;
};

const providerGroups = ({
  models,
  providers,
  search,
}: Pick<GroupModelsInput, "models" | "providers" | "search">) => {
  const matches = models.filter((model) =>
    matchesModelSearch(search, [
      model.name,
      model.id,
      providerTitle(model, providers),
    ])
  );
  matches.sort((a, b) => a.name.localeCompare(b.name));
  const groups = new Map<string, ModelGroup>();
  for (const model of matches) {
    const group = groups.get(model.providerID);
    if (group) {
      group.items.push(model);
    } else {
      groups.set(model.providerID, {
        items: [model],
        key: model.providerID,
        providerID: model.providerID,
        title: providerTitle(model, providers),
      });
    }
  }
  const ordered = [...groups.values()];
  ordered.sort(
    (a, b) =>
      popularRank(a.providerID) - popularRank(b.providerID) ||
      (popularRank(a.providerID) === popularProviders.length
        ? a.title.localeCompare(b.title)
        : 0)
  );
  return ordered;
};

export const groupModels = (input: GroupModelsInput): ModelGroup[] => {
  const groups = providerGroups(input);
  if (input.search.trim()) {
    return groups;
  }
  const favorites = modelsByID(input.models, input.favoriteIDs);
  const recent = modelsByID(input.models, input.recentIDs).filter(
    (model) => !favorites.includes(model)
  );
  const listed = new Set([...favorites, ...recent]);
  const sections: ModelGroup[] = [];
  if (favorites.length > 0) {
    sections.push({ items: favorites, key: "favorite", title: "Favorites" });
  }
  if (recent.length > 0) {
    sections.push({ items: recent, key: "recent", title: "Recent" });
  }
  for (const group of groups) {
    const items = group.items.filter((model) => !listed.has(model));
    if (items.length > 0) {
      sections.push({ ...group, items });
    }
  }
  return sections;
};
