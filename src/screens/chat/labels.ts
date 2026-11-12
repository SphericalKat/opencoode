import type { ModelInfo, SessionInboxInfo } from "@opencode/client";

import { modelPreferenceID } from "../../lib/model-preferences";

export const inboxItemText = (item: SessionInboxInfo) => {
  if (item.type === "user") {
    return item.payload.text;
  }
  if (item.type === "compaction") {
    return "Compact context";
  }
  return "Move session";
};

export const sendButtonLabel = (
  active: boolean,
  hasPrompt: boolean,
  delivery: "steer" | "queue"
) => {
  if (active && !hasPrompt) {
    return "Stop generation";
  }
  if (active && delivery === "queue") {
    return "Queue message";
  }
  return "Send message";
};

export const emptyModelsTitle = (
  hasEnabled: boolean,
  modelFilter: string,
  hasScoped: boolean
) => {
  if (!hasEnabled) {
    return "No connected models";
  }
  if (modelFilter !== "all" && !hasScoped) {
    return modelFilter === "favorites"
      ? "No favorite models"
      : "No recent models";
  }
  return "No models match";
};

export const emptyModelsDetail = (
  hasEnabled: boolean,
  modelFilter: string,
  hasScoped: boolean
) => {
  if (!hasEnabled) {
    return "Connect a provider in Settings, then refresh this list.";
  }
  if (modelFilter === "favorites" && !hasScoped) {
    return "Tap the star beside a model to save it here.";
  }
  if (modelFilter === "recent" && !hasScoped) {
    return "Models appear here after you select them.";
  }
  return "Try a model name or provider.";
};

export const sortByPreference = (
  models: ModelInfo[],
  preferredIDs: string[]
) => {
  const sorted = models.filter((model) =>
    preferredIDs.includes(modelPreferenceID(model.providerID, model.id))
  );
  sorted.sort(
    (a, b) =>
      preferredIDs.indexOf(modelPreferenceID(a.providerID, a.id)) -
      preferredIDs.indexOf(modelPreferenceID(b.providerID, b.id))
  );
  return sorted;
};
