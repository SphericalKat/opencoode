import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { normalizeConnection, type Connection } from './client';

const connectionsKey = 'opencoode.connections';
const activeKey = 'opencoode.activeConnection';

export type Workspace = { directory: string; sessionID?: string };

function workspaceKey(connectionID: string) {
  return `opencoode.workspace.${Array.from(connectionID, (character) => character.codePointAt(0)!.toString(16)).join('-')}`;
}

async function read(key: string): Promise<string | null> {
  return Platform.OS === 'web' ? globalThis.sessionStorage.getItem(key) : SecureStore.getItemAsync(key);
}

async function write(key: string, value: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (value === null) globalThis.sessionStorage.removeItem(key);
    else globalThis.sessionStorage.setItem(key, value);
    return;
  }
  if (value === null) await SecureStore.deleteItemAsync(key);
  else await SecureStore.setItemAsync(key, value);
}

export async function loadConnections(): Promise<Connection[]> {
  const raw = await read(connectionsKey);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error('Saved server connections are invalid');
  return data.map((item: unknown) => {
    if (
      !item || typeof item !== 'object' ||
      !('id' in item) || typeof item.id !== 'string' ||
      !('name' in item) || typeof item.name !== 'string' ||
      !('url' in item) || typeof item.url !== 'string' ||
      ('token' in item && item.token !== undefined && typeof item.token !== 'string') ||
      ('username' in item && item.username !== undefined && typeof item.username !== 'string') ||
      ('backend' in item && item.backend !== undefined && item.backend !== 'opencode' && item.backend !== 'pi')
    ) throw new Error('A saved server connection is invalid');
    return normalizeConnection({
      id: item.id, name: item.name, url: item.url,
      token: 'token' in item ? item.token as string | undefined : undefined,
      username: 'username' in item ? item.username as string | undefined : undefined,
      backend: 'backend' in item ? item.backend as Connection['backend'] : undefined,
    });
  });
}

export function saveConnections(connections: Connection[]): Promise<void> {
  return write(connectionsKey, JSON.stringify(connections));
}

export function loadActiveConnectionId(): Promise<string | null> {
  return read(activeKey);
}

export function saveActiveConnectionId(id: string | null): Promise<void> {
  return write(activeKey, id);
}

export async function loadWorkspace(connectionID: string): Promise<Workspace | null> {
  const raw = await read(workspaceKey(connectionID));
  if (!raw) return null;
  const workspace: unknown = JSON.parse(raw);
  if (!workspace || typeof workspace !== 'object' ||
    !('directory' in workspace) || typeof workspace.directory !== 'string' ||
    ('sessionID' in workspace && workspace.sessionID !== undefined && typeof workspace.sessionID !== 'string')) {
    throw new Error('The saved workspace is invalid');
  }
  return {
    directory: workspace.directory,
    sessionID: 'sessionID' in workspace ? workspace.sessionID as string | undefined : undefined,
  };
}

export function saveWorkspace(connectionID: string, workspace: Workspace): Promise<void> {
  return write(workspaceKey(connectionID), JSON.stringify(workspace));
}
