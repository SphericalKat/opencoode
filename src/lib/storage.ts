import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import { normalizeConnection } from "./client";
import type { Connection } from "./client";

const connectionsKey = "opencoode.connections";
const activeKey = "opencoode.activeConnection";

export interface Workspace {
  directory: string;
  sessionID?: string;
}

const workspaceKey = (connectionID: string) =>
  `opencoode.workspace.${Array.from(connectionID, (character) => (character.codePointAt(0) ?? 0).toString(16)).join("-")}`;

const read = async (key: string): Promise<string | null> =>
  Platform.OS === "web"
    ? globalThis.sessionStorage.getItem(key)
    : await SecureStore.getItemAsync(key);

const write = async (key: string, value: string | null): Promise<void> => {
  if (Platform.OS === "web") {
    if (value === null) {
      globalThis.sessionStorage.removeItem(key);
    } else {
      globalThis.sessionStorage.setItem(key, value);
    }
    return;
  }
  await (value === null
    ? SecureStore.deleteItemAsync(key)
    : SecureStore.setItemAsync(key, value));
};

const isSavedConnection = (
  item: unknown
): item is {
  id: string;
  name: string;
  url: string;
} =>
  typeof item === "object" &&
  item !== null &&
  "id" in item &&
  typeof item.id === "string" &&
  "name" in item &&
  typeof item.name === "string" &&
  "url" in item &&
  typeof item.url === "string" &&
  !(
    "token" in item &&
    item.token !== undefined &&
    typeof item.token !== "string"
  ) &&
  !(
    "username" in item &&
    item.username !== undefined &&
    typeof item.username !== "string"
  ) &&
  !(
    "backend" in item &&
    item.backend !== undefined &&
    item.backend !== "opencode" &&
    item.backend !== "pi"
  );

export const loadConnections = async (): Promise<Connection[]> => {
  const raw = await read(connectionsKey);
  if (!raw) {
    return [];
  }
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new TypeError("Saved server connections are invalid");
  }
  return data.map((item: unknown) => {
    if (!isSavedConnection(item)) {
      throw new Error("A saved server connection is invalid");
    }
    return normalizeConnection({
      backend:
        "backend" in item ? (item.backend as Connection["backend"]) : undefined,
      id: item.id,
      name: item.name,
      token: "token" in item ? (item.token as string | undefined) : undefined,
      url: item.url,
      username:
        "username" in item ? (item.username as string | undefined) : undefined,
    });
  });
};

export const saveConnections = (connections: Connection[]): Promise<void> =>
  write(connectionsKey, JSON.stringify(connections));

export const loadActiveConnectionId = (): Promise<string | null> =>
  read(activeKey);

export const saveActiveConnectionId = (id: string | null): Promise<void> =>
  write(activeKey, id);

export const loadWorkspace = async (
  connectionID: string
): Promise<Workspace | null> => {
  const raw = await read(workspaceKey(connectionID));
  if (!raw) {
    return null;
  }
  const workspace: unknown = JSON.parse(raw);
  if (
    !workspace ||
    typeof workspace !== "object" ||
    !("directory" in workspace) ||
    typeof workspace.directory !== "string" ||
    ("sessionID" in workspace &&
      workspace.sessionID !== undefined &&
      typeof workspace.sessionID !== "string")
  ) {
    throw new Error("The saved workspace is invalid");
  }
  return {
    directory: workspace.directory,
    sessionID:
      "sessionID" in workspace
        ? (workspace.sessionID as string | undefined)
        : undefined,
  };
};

export const saveWorkspace = (
  connectionID: string,
  workspace: Workspace
): Promise<void> =>
  write(workspaceKey(connectionID), JSON.stringify(workspace));
