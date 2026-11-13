import type { Client } from "../../lib/client";

export type Section =
  | "Accounts"
  | "Models"
  | "MCP"
  | "Config"
  | "Skills"
  | "Plugins"
  | "Permissions"
  | "Advanced"
  | "Appearance";
export type ModelCatalog = Pick<Client["model"], "list">;
export const sectionDescriptions: Record<Section, string> = {
  Accounts: "Provider connections and credentials",
  Advanced: "Usage, web search, and generation",
  Appearance: "System, light, or dark theme",
  Config: "Server configuration and shell",
  MCP: "Tool servers and pending requests",
  Models: "Available models and capabilities",
  Permissions: "Saved approvals for this project",
  Plugins: "Server plugins and updates",
  Skills: "Skills in this workspace",
};
export const sectionGroups: { title: string; items: Section[] }[] = [
  { items: ["Appearance", "Config"], title: "General" },
  { items: ["Accounts", "Models", "MCP"], title: "Connections" },
  { items: ["Skills", "Plugins", "Permissions"], title: "Agent" },
  { items: ["Advanced"], title: "Advanced" },
];
export const allSections = sectionGroups.flatMap((group) => group.items);
