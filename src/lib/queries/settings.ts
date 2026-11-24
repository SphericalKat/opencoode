import { queryOptions, skipToken } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import type { ChatBackend } from "../chat-backend";
import type { Client } from "../client";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";
import { withDeadline } from "../request";
import { locationOptions } from "./sessions";

// Settings screens refetch whenever they open, and after their own writes.
const SETTINGS = { refetchOnMount: true, staleTime: 30_000 } as const;

export const mcpServersOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    ...SETTINGS,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const response = await client.mcp.list(
          { location: { directory } },
          { signal: deadline }
        );
        return response.data;
      }),
    queryKey: queryKeys.dir.settings(scope, directory, "mcp"),
  });

export const pluginsOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    ...SETTINGS,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const response = await client.plugin.list(
          { location: { directory } },
          { signal: deadline }
        );
        return response.data;
      }),
    queryKey: queryKeys.dir.settings(scope, directory, "plugins"),
  });

export const savedPermissionsOptions = (
  queryClient: QueryClient,
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    ...SETTINGS,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const location = await queryClient.fetchQuery(
          locationOptions(scope, client, directory)
        );
        return client.permission.saved.list(
          { projectID: location.project.id },
          { signal: deadline }
        );
      }),
    queryKey: queryKeys.dir.settings(scope, directory, "permissions"),
  });

export const configurationOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    ...SETTINGS,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const [entries, shells] = await Promise.all([
          client.config.get({ location: { directory } }, { signal: deadline }),
          client.config.shells({ signal: deadline }),
        ]);
        return { entries, shells };
      }),
    queryKey: queryKeys.dir.settings(scope, directory, "config"),
  });

export const integrationsOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    ...SETTINGS,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const response = await client.integration.list(
          { location: { directory } },
          { signal: deadline }
        );
        return response.data;
      }),
    queryKey: queryKeys.dir.settings(scope, directory, "integrations"),
  });

export const credentialsOptions = (scope: Scope, client: Client) =>
  queryOptions({
    ...SETTINGS,
    queryFn: ({ signal }) =>
      withDeadline(signal, (deadline) =>
        client.credential.list({ signal: deadline })
      ),
    queryKey: queryKeys.credentials(scope),
  });

const ATTEMPT_POLL_MS = 3000;
export const TERMINAL_ATTEMPT_STATUSES = new Set([
  "complete",
  "expired",
  "failed",
]);

type ModelCatalog = Pick<ChatBackend["core"]["model"], "list">;

// The settings list shows every model type. The chat picker only needs chat
// models, so the two lists have separate keys.
export const catalogAllModelsOptions = (
  scope: Scope,
  catalog: ModelCatalog,
  directory: string
) =>
  queryOptions({
    ...SETTINGS,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const response = await catalog.list(
          { location: { directory }, types: ["chat", "image", "decision"] },
          { signal: deadline }
        );
        return response.data;
      }),
    queryKey: queryKeys.dir.catalog(scope, directory, "all-models"),
  });

export const catalogProviderListOptions = (
  scope: Scope,
  client: Client | undefined,
  directory: string
) =>
  queryOptions({
    ...SETTINGS,
    queryFn: client
      ? ({ signal }) =>
          withDeadline(signal, async (deadline) => {
            const response = await client.provider.list(
              { location: { directory } },
              { signal: deadline }
            );
            return response.data;
          })
      : skipToken,
    queryKey: queryKeys.dir.catalog(scope, directory, "providers"),
  });

export const catalogSkillListOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    ...SETTINGS,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const response = await client.skill.list(
          { location: { directory } },
          { signal: deadline }
        );
        return response.data;
      }),
    queryKey: queryKeys.dir.catalog(scope, directory, "skills"),
  });

export const catalogCommandListOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    ...SETTINGS,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const response = await client.command.list(
          { location: { directory } },
          { signal: deadline }
        );
        return response.data;
      }),
    queryKey: queryKeys.dir.catalog(scope, directory, "commands"),
  });

export const integrationAttemptOptions = (
  scope: Scope,
  client: Client,
  input: {
    attemptID: string;
    directory: string;
    integrationID: string;
    kind: "command" | "oauth";
  },
  enabled: boolean
) =>
  queryOptions({
    enabled,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const request = {
          attemptID: input.attemptID,
          integrationID: input.integrationID,
          location: { directory: input.directory },
        };
        const result =
          input.kind === "oauth"
            ? await client.integration.oauth.status(request, {
                signal: deadline,
              })
            : await client.integration.command.status(request, {
                signal: deadline,
              });
        return result.data;
      }),
    queryKey: queryKeys.integrationAttempt(scope, input.attemptID),
    refetchInterval: (query) =>
      TERMINAL_ATTEMPT_STATUSES.has(query.state.data?.status ?? "")
        ? false
        : ATTEMPT_POLL_MS,
    staleTime: 0,
  });
