import type { SessionStatus } from "@opencode/client";
import { queryOptions, skipToken } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import type { ChatBackend } from "../chat-backend";
import type { Client } from "../client";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";
import { withDeadline } from "../request";
import { activeSessionsOptions } from "./sessions";

type Core = ChatBackend["core"];
type OpenCodeClient = Client | undefined;

const FOREVER = Number.POSITIVE_INFINITY;

export const sessionInboxOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  enabled: boolean,
  sessionID: string
) =>
  queryOptions({
    queryFn:
      opencode && enabled
        ? ({ signal }) =>
            withDeadline(signal, (deadline) =>
              opencode.session.inbox.list({ sessionID }, { signal: deadline })
            )
        : skipToken,
    queryKey: queryKeys.session.inbox(scope, sessionID),
    staleTime: FOREVER,
  });

export const sessionFormsOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  enabled: boolean,
  sessionID: string
) =>
  queryOptions({
    queryFn:
      opencode && enabled
        ? ({ signal }) =>
            withDeadline(signal, (deadline) =>
              opencode.session.form.list({ sessionID }, { signal: deadline })
            )
        : skipToken,
    queryKey: queryKeys.session.forms(scope, sessionID),
    staleTime: FOREVER,
  });

export const sessionPermissionsOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  enabled: boolean,
  sessionID: string
) =>
  queryOptions({
    queryFn:
      opencode && enabled
        ? ({ signal }) =>
            withDeadline(signal, (deadline) =>
              opencode.permission.list({ sessionID }, { signal: deadline })
            )
        : skipToken,
    queryKey: queryKeys.session.permissions(scope, sessionID),
    staleTime: FOREVER,
  });

// Forms that are not tied to a session. They belong to a directory, so the
// chat and the settings screen share this key.
export const directoryFormsOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  enabled: boolean,
  directory: string | undefined
) =>
  queryOptions({
    queryFn:
      opencode && enabled && directory
        ? ({ signal }) =>
            withDeadline(signal, async (deadline) => {
              const result = await opencode.form.list(
                { location: { directory } },
                { signal: deadline }
              );
              return result.data.filter((form) => form.sessionID === "global");
            })
        : skipToken,
    queryKey: queryKeys.dir.forms(scope, directory ?? ""),
    staleTime: FOREVER,
  });

// The server has no endpoint for the transient status. An idle answer from
// `sessions.active` always wins. Otherwise the last status that live events
// wrote to the cache stays.
export const sessionStatusOptions = (
  queryClient: QueryClient,
  scope: Scope,
  core: Core,
  sessionID: string
) => {
  const queryKey = queryKeys.session.status(scope, sessionID);
  return queryOptions({
    queryFn: async (): Promise<SessionStatus | null> => {
      const running = await queryClient.fetchQuery({
        ...activeSessionsOptions(scope, core.session),
        staleTime: 0,
      });
      if (running[sessionID]) {
        return queryClient.getQueryData<SessionStatus | null>(queryKey) ?? null;
      }
      return { type: "idle" };
    },
    queryKey,
    staleTime: FOREVER,
  });
};

export const catalogModelsOptions = (
  scope: Scope,
  core: Core,
  directory: string | undefined
) =>
  queryOptions({
    queryFn: directory
      ? ({ signal }) =>
          withDeadline(signal, async (deadline) => {
            const result = await core.model.list(
              { location: { directory }, types: ["chat"] },
              { signal: deadline }
            );
            return result.data;
          })
      : skipToken,
    queryKey: queryKeys.dir.catalog(scope, directory ?? "", "models"),
    staleTime: FOREVER,
  });

export const catalogDefaultModelOptions = (
  scope: Scope,
  core: Core,
  directory: string | undefined
) =>
  queryOptions({
    queryFn: directory
      ? ({ signal }) =>
          withDeadline(signal, async (deadline) => {
            const result = await core.model.default(
              { location: { directory } },
              { signal: deadline }
            );
            return result.data;
          })
      : skipToken,
    queryKey: queryKeys.dir.catalog(scope, directory ?? "", "default-model"),
    staleTime: FOREVER,
  });

export const catalogProvidersOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  directory: string | undefined
) =>
  queryOptions({
    queryFn:
      opencode && directory
        ? ({ signal }) =>
            withDeadline(signal, async (deadline) => {
              const result = await opencode.provider.list(
                { location: { directory } },
                { signal: deadline }
              );
              return result.data;
            })
        : skipToken,
    queryKey: queryKeys.dir.catalog(scope, directory ?? "", "providers"),
    staleTime: FOREVER,
  });

export const catalogAgentsOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  enabled: boolean,
  directory: string | undefined
) =>
  queryOptions({
    queryFn:
      opencode && enabled && directory
        ? ({ signal }) =>
            withDeadline(signal, async (deadline) => {
              const result = await opencode.agent.list(
                { location: { directory } },
                { signal: deadline }
              );
              return result.data;
            })
        : skipToken,
    queryKey: queryKeys.dir.catalog(scope, directory ?? "", "agents"),
    staleTime: FOREVER,
  });

export const catalogCommandsOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  enabled: boolean,
  directory: string | undefined
) =>
  queryOptions({
    queryFn:
      opencode && enabled && directory
        ? ({ signal }) =>
            withDeadline(signal, async (deadline) => {
              const result = await opencode.command.list(
                { location: { directory } },
                { signal: deadline }
              );
              return result.data;
            })
        : skipToken,
    queryKey: queryKeys.dir.catalog(scope, directory ?? "", "commands"),
    staleTime: FOREVER,
  });

export const catalogSkillsOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  enabled: boolean,
  directory: string | undefined
) =>
  queryOptions({
    queryFn:
      opencode && enabled && directory
        ? ({ signal }) =>
            withDeadline(signal, async (deadline) => {
              const result = await opencode.skill.list(
                { location: { directory } },
                { signal: deadline }
              );
              return result.data;
            })
        : skipToken,
    queryKey: queryKeys.dir.catalog(scope, directory ?? "", "skills"),
    staleTime: FOREVER,
  });
