import type {
  AgentInfo,
  ModelInfo,
  SessionInboxInfo,
  SessionInfo,
} from "@opencode/client";

import { capitalizeFirst } from "./model-label";

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
    return "Stop";
  }
  if (active) {
    return delivery === "queue" ? "Queue message" : "Steer message";
  }
  return "Send message";
};

export const emptyModelsTitle = (hasEnabled: boolean) =>
  hasEnabled ? "No model results" : "No connected models";

export const emptyModelsDetail = (hasEnabled: boolean) =>
  hasEnabled
    ? undefined
    : "Connect a provider in Settings, then refresh this list.";

export const modelSummary = (
  session: Pick<SessionInfo, "model">,
  currentModel: Pick<ModelInfo, "name"> | undefined
) => {
  const name = currentModel?.name || session.model?.id || "Server default";
  const variant = session.model?.variant;
  if (!variant) {
    return name;
  }
  return `${name} · ${capitalizeFirst(variant)}`;
};

export const agentLabel = (agents: AgentInfo[], session: SessionInfo) =>
  agents.find((agent) => agent.id === session.agent)?.name ||
  session.agent ||
  "Server default";
