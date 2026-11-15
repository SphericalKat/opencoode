export type Scope = string;

export interface SessionListQuery {
  archived: boolean;
  directory: string | undefined;
  search: string;
}

export type CatalogKind =
  | "agents"
  | "commands"
  | "all-models"
  | "default-model"
  | "models"
  | "providers"
  | "skills";

export type SettingsKind =
  | "config"
  | "integrations"
  | "mcp"
  | "permissions"
  | "plugins";

const dirKey = (scope: Scope, directory: string) =>
  [scope, "dir", directory] as const;

const sessionKey = (scope: Scope, sessionID: string) =>
  [scope, "session", sessionID] as const;

export const queryKeys = {
  credentials: (scope: Scope) => [scope, "credentials"] as const,
  dir: {
    all: dirKey,
    catalog: (scope: Scope, directory: string, kind?: CatalogKind) =>
      kind
        ? ([...dirKey(scope, directory), "catalog", kind] as const)
        : ([...dirKey(scope, directory), "catalog"] as const),
    file: (scope: Scope, directory: string, path: string) =>
      [...dirKey(scope, directory), "file", path] as const,
    files: (scope: Scope, directory: string, request?: unknown) =>
      request === undefined
        ? ([...dirKey(scope, directory), "files"] as const)
        : ([...dirKey(scope, directory), "files", request] as const),
    forms: (scope: Scope, directory: string) =>
      [...dirKey(scope, directory), "forms"] as const,
    mcpResources: (scope: Scope, directory: string) =>
      [...dirKey(scope, directory), "mcp-resources"] as const,
    pty: (scope: Scope, directory: string) =>
      [...dirKey(scope, directory), "pty"] as const,
    settings: (scope: Scope, directory: string, kind: SettingsKind) =>
      [...dirKey(scope, directory), "settings", kind] as const,
    shellOutput: (
      scope: Scope,
      directory: string,
      shellID: string,
      start?: number
    ) =>
      start === undefined
        ? ([...dirKey(scope, directory), "shell-output", shellID] as const)
        : ([
            ...dirKey(scope, directory),
            "shell-output",
            shellID,
            { start },
          ] as const),
    shells: (scope: Scope, directory: string) =>
      [...dirKey(scope, directory), "shells"] as const,
    vcs: (scope: Scope, directory: string) =>
      [...dirKey(scope, directory), "vcs"] as const,
    vcsDiff: (scope: Scope, directory: string, request: unknown) =>
      [...dirKey(scope, directory), "vcs", "diff", request] as const,
    worktrees: (scope: Scope, directory: string) =>
      [...dirKey(scope, directory), "worktrees"] as const,
  },
  integrationAttempt: (scope: Scope, attemptID: string) =>
    [scope, "integration-attempt", attemptID] as const,
  location: (scope: Scope, directory: string) =>
    [scope, "location", directory] as const,
  pi: {
    info: (scope: Scope) => [scope, "pi", "info"] as const,
    sessions: (scope: Scope) => [scope, "pi", "sessions"] as const,
    snapshot: (scope: Scope) => [scope, "pi", "snapshot"] as const,
  },
  projects: (scope: Scope) => [scope, "projects"] as const,
  server: {
    info: (scope: Scope) => [scope, "server", "info"] as const,
    persistentPty: (scope: Scope) =>
      [scope, "server", "persistent-pty"] as const,
  },
  session: {
    all: sessionKey,
    context: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "context"] as const,
    detail: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "detail"] as const,
    diff: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "diff"] as const,
    forms: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "forms"] as const,
    inbox: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "inbox"] as const,
    instructions: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "instructions"] as const,
    messages: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "messages"] as const,
    permissions: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "permissions"] as const,
    schedules: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "schedules"] as const,
    status: (scope: Scope, sessionID: string) =>
      [...sessionKey(scope, sessionID), "status"] as const,
  },
  sessions: {
    active: (scope: Scope) => [scope, "sessions", "active"] as const,
    all: (scope: Scope) => [scope, "sessions"] as const,
    children: (scope: Scope, parentID: string, archived?: boolean) =>
      archived === undefined
        ? ([scope, "sessions", "children", parentID] as const)
        : ([scope, "sessions", "children", parentID, { archived }] as const),
    list: (scope: Scope, query: SessionListQuery) =>
      [scope, "sessions", "list", query] as const,
  },
};
