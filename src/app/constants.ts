import type { Tab } from "./types";

export const destinations: { id: Tab; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "settings", label: "Settings" },
];
export const noop = (): null => null;
