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
  | "Look and feel";
export type ModelCatalog = Pick<Client["model"], "list">;
export const sectionDescriptions: Record<Section, string> = {
  Accounts: "Provider connections and credentials",
  Advanced: "Usage, web search, and generation",
  "Look and feel": "Theme, colors, and haptic feedback",
  Config: "Server configuration and shell",
  MCP: "Tool servers and pending requests",
  Models: "Available models and capabilities",
  Permissions: "Saved approvals for this project",
  Plugins: "Server plugins and updates",
  Skills: "Skills in this workspace",
};
export const sectionGroups: { title: string; items: Section[] }[] = [
  { items: ["Look and feel", "Config"], title: "General" },
  { items: ["Accounts", "Models", "MCP"], title: "Connections" },
  { items: ["Skills", "Plugins", "Permissions"], title: "Agent" },
  { items: ["Advanced"], title: "Advanced" },
];
export const allSections = sectionGroups.flatMap((group) => group.items);

export type SectionMenuValue = Section | "Servers";
export type SectionMenuEntry =
  | { value: SectionMenuValue; label: string }
  | { type: "separator"; key: string };

export const filterSections = (
  sections: Section[],
  hasClient: boolean,
  hasModelCatalog: boolean
) =>
  sections.filter(
    (value) =>
      hasClient ||
      value === "Look and feel" ||
      (value === "Models" && hasModelCatalog)
  );

export const resolveSelected = (
  section: Section | null,
  availableSections: Section[]
): Section | null =>
  section !== null && availableSections.includes(section)
    ? section
    : (availableSections[0] ?? null);

export const sectionMenuEntries = (
  availableSections: Section[],
  canManageServers: boolean
): SectionMenuEntry[] => {
  const entries: SectionMenuEntry[] = [];
  for (const group of sectionGroups) {
    const values: SectionMenuValue[] = group.items.filter((item) =>
      availableSections.includes(item)
    );
    if (canManageServers && group.title === "Connections") {
      values.unshift("Servers");
    }
    if (values.length === 0) {
      continue;
    }
    if (entries.length > 0) {
      entries.push({ key: `separator-${group.title}`, type: "separator" });
    }
    for (const value of values) {
      entries.push({ label: value, value });
    }
  }
  return entries;
};
