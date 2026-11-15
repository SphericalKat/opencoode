import {
  infiniteQueryOptions,
  queryOptions,
  skipToken,
} from "@tanstack/react-query";

import type { ChatBackend } from "../chat-backend";
import type { Client } from "../client";
import { queryKeys } from "../query-keys";
import type { Scope, SessionListQuery } from "../query-keys";
import { withDeadline } from "../request";

export const SESSION_PAGE_SIZE = 40;

export type SessionPage = Awaited<ReturnType<Client["session"]["list"]>>;

const nextPageCursor = (page: SessionPage) =>
  page.data.length >= SESSION_PAGE_SIZE
    ? (page.cursor.next ?? undefined)
    : undefined;

export const sessionListOptions = (
  scope: Scope,
  client: Client,
  query: SessionListQuery
) =>
  infiniteQueryOptions({
    getNextPageParam: nextPageCursor,
    gcTime: Number.POSITIVE_INFINITY,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      withDeadline(signal, (deadline) =>
        client.session.list(
          {
            archived: query.archived,
            cursor: pageParam,
            directory: query.directory,
            limit: SESSION_PAGE_SIZE,
            order: "desc",
            search: query.search.trim() || undefined,
          },
          { signal: deadline }
        )
      ),
    queryKey: queryKeys.sessions.list(scope, query),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const childSessionsOptions = (
  scope: Scope,
  client: Client,
  parentID: string,
  archived: boolean
) =>
  infiniteQueryOptions({
    getNextPageParam: nextPageCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      withDeadline(signal, (deadline) =>
        client.session.list(
          {
            archived,
            cursor: pageParam,
            limit: SESSION_PAGE_SIZE,
            order: "desc",
            parentID,
          },
          { signal: deadline }
        )
      ),
    queryKey: queryKeys.sessions.children(scope, parentID, archived),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const activeSessionsOptions = (
  scope: Scope,
  core: Pick<ChatBackend["core"]["session"], "active">
) =>
  queryOptions({
    queryFn: ({ signal }) =>
      withDeadline(signal, (deadline) => core.active({ signal: deadline })),
    queryKey: queryKeys.sessions.active(scope),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const sessionDetailOptions = (
  scope: Scope,
  core: Pick<ChatBackend["core"]["session"], "get"> | null,
  sessionID: string
) =>
  queryOptions({
    queryFn: core
      ? ({ signal }) =>
          withDeadline(signal, (deadline) =>
            core.get({ sessionID }, { signal: deadline })
          )
      : skipToken,
    queryKey: queryKeys.session.detail(scope, sessionID),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const projectsOptions = (scope: Scope, client: Client) =>
  queryOptions({
    queryFn: ({ signal }) =>
      withDeadline(signal, (deadline) =>
        client.project.list(undefined, { signal: deadline })
      ),
    queryKey: queryKeys.projects(scope),
    refetchOnMount: true,
    staleTime: 30_000,
  });

export const locationOptions = (
  scope: Scope,
  client: Pick<Client, "location">,
  directory: string
) =>
  queryOptions({
    queryFn: ({ signal }) =>
      withDeadline(signal, (deadline) =>
        client.location.get({ location: { directory } }, { signal: deadline })
      ),
    queryKey: queryKeys.location(scope, directory),
    refetchOnMount: true,
    staleTime: 30_000,
  });
