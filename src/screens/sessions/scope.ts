import type { Client } from "../../lib/client";

export interface Scope {
  client: Client;
  directory: string;
  listDirectory: string | undefined;
}

export interface ScopeKey {
  client: Client;
  creationDirectory: string;
  listDirectory: string | undefined;
}

export const scopeKeyChanged = (previous: ScopeKey, next: ScopeKey): boolean =>
  previous.client !== next.client ||
  previous.creationDirectory !== next.creationDirectory ||
  previous.listDirectory !== next.listDirectory;
