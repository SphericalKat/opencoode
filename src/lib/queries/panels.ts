import type { Pty } from "@opencode/client";
import { queryOptions, skipToken } from "@tanstack/react-query";

import type { Client } from "../client";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";
import { withDeadline } from "../request";

type OpenCodeClient = Client | undefined;

// On-demand panels fetch when the panel opens and never serve a stale copy.
const PANEL = { refetchOnMount: true, staleTime: 0 } as const;

export const sessionDiffOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  sessionID: string
) =>
  queryOptions({
    ...PANEL,
    queryFn: opencode
      ? ({ signal }) =>
          withDeadline(signal, (deadline) =>
            opencode.session.diff({ sessionID }, { signal: deadline })
          )
      : skipToken,
    queryKey: queryKeys.session.diff(scope, sessionID),
  });

export const sessionContextOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  sessionID: string
) =>
  queryOptions({
    ...PANEL,
    queryFn: opencode
      ? ({ signal }) =>
          withDeadline(signal, (deadline) =>
            opencode.session.context({ sessionID }, { signal: deadline })
          )
      : skipToken,
    queryKey: queryKeys.session.context(scope, sessionID),
  });

export const directoryFileSearchOptions = (
  scope: Scope,
  opencode: OpenCodeClient,
  directory: string | undefined,
  query: string
) =>
  queryOptions({
    ...PANEL,
    queryFn:
      opencode && directory
        ? ({ signal }) =>
            withDeadline(signal, async (deadline) => {
              const findFiles = opencode.file.find.bind(opencode.file);
              const result = await findFiles(
                {
                  limit: 40,
                  location: { directory },
                  query,
                  type: "file",
                },
                { signal: deadline }
              );
              return result.data;
            })
        : skipToken,
    queryKey: queryKeys.dir.files(scope, directory ?? "", {
      limit: 40,
      query,
    }),
  });

export const mcpResourcesOptions = (
  scope: Scope,
  client: Client,
  directory: string
) =>
  queryOptions({
    ...PANEL,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const result = await client.mcp.resource.catalog(
          { location: { directory } },
          { signal: deadline }
        );
        return result.data;
      }),
    queryKey: queryKeys.dir.mcpResources(scope, directory),
  });

export const sessionInstructionsOptions = (
  scope: Scope,
  client: Client,
  sessionID: string
) =>
  queryOptions({
    ...PANEL,
    queryFn: ({ signal }) =>
      withDeadline(signal, (deadline) =>
        client.experimental.session.instructions.entry.list(
          { sessionID },
          { signal: deadline }
        )
      ),
    queryKey: queryKeys.session.instructions(scope, sessionID),
  });

export const sessionSchedulesOptions = (
  scope: Scope,
  client: Client,
  sessionID: string
) =>
  queryOptions({
    ...PANEL,
    queryFn: ({ signal }) =>
      withDeadline(signal, (deadline) =>
        client.experimental.schedule.list({ sessionID }, { signal: deadline })
      ),
    queryKey: queryKeys.session.schedules(scope, sessionID),
  });

const SHELL_POLL_MS = 3000;
export const SHELL_PAGE_BYTES = 32 * 1024;

export const shellListOptions = (
  scope: Scope,
  client: Client,
  directory: string,
  enabled: boolean
) =>
  queryOptions({
    enabled,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const result = await client.shell.list(
          { location: { directory } },
          { signal: deadline }
        );
        return result.data;
      }),
    queryKey: queryKeys.dir.shells(scope, directory),
    refetchInterval: SHELL_POLL_MS,
    refetchOnMount: true,
    staleTime: 0,
  });

interface ShellOutputRequest {
  allowOtherSession: boolean;
  directory: string;
  id: string;
  sessionID: string;
  start: number;
}

export const shellOutputOptions = (
  scope: Scope,
  client: Client,
  request: ShellOutputRequest,
  enabled: boolean
) =>
  queryOptions({
    enabled,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const location = { directory: request.directory };
        const command = await client.shell.get(
          { id: request.id, location },
          { signal: deadline }
        );
        if (
          command.data.metadata.sessionID !== request.sessionID &&
          !request.allowOtherSession
        ) {
          throw new Error("This command is not associated with this session");
        }
        const result = await client.shell.output(
          {
            cursor: request.start,
            id: request.id,
            limit: SHELL_PAGE_BYTES,
            location,
          },
          { signal: deadline }
        );
        return {
          command: command.data,
          page: {
            cursor: result.data.cursor,
            output: result.data.output,
            size: result.data.size,
            start: request.start,
          },
        };
      }),
    queryKey: queryKeys.dir.shellOutput(
      scope,
      request.directory,
      request.id,
      request.start
    ),
    // A running command keeps producing output. Poll while the page reaches the
    // end of what the server has captured.
    refetchInterval: (query) => {
      const { data } = query.state;
      return data &&
        data.command.status === "running" &&
        data.page.cursor >= data.page.size
        ? SHELL_POLL_MS
        : false;
    },
    refetchOnMount: true,
    staleTime: 0,
  });

export const vcsStatusOptions = (
  scope: Scope,
  client: Pick<Client, "vcs">,
  directory: string
) =>
  queryOptions({
    ...PANEL,
    queryFn: ({ signal }) =>
      withDeadline(signal, (deadline) =>
        client.vcs.get({ location: { directory } }, { signal: deadline })
      ),
    queryKey: queryKeys.dir.vcs(scope, directory),
  });

export const folderListOptions = (
  scope: Scope,
  client: Client,
  directory: string,
  path: string
) =>
  queryOptions({
    ...PANEL,
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline) => {
        const result = await client.file.list(
          { location: { directory }, path },
          { signal: deadline }
        );
        return {
          base: result.location.directory,
          entries: result.data,
        };
      }),
    queryKey: queryKeys.dir.files(scope, directory, { folders: path }),
  });

export interface Shell {
  kind: "desktop" | "workspace";
  pty: Pty;
}

// Desktop (persistent) and workspace shells share the dir.pty prefix so one
// invalidation refreshes both lists.
export const ptyListOptions = (
  scope: Scope,
  client: Client,
  directory: string,
  desktop: boolean,
  sessionID: string | undefined
) =>
  queryOptions({
    ...PANEL,
    queryFn: async ({ signal }): Promise<Shell[]> => {
      const [desktopShells, workspaceShells] = await Promise.all([
        desktop && sessionID
          ? client.experimental.persistentPty.list({ sessionID }, { signal })
          : [],
        client.pty.list({ location: { directory } }, { signal }),
      ]);
      return [
        ...desktopShells.map((pty): Shell => ({ kind: "desktop", pty })),
        ...workspaceShells.data.map((pty): Shell => ({
          kind: "workspace",
          pty,
        })),
      ];
    },
    queryKey: [
      ...queryKeys.dir.pty(scope, directory),
      { desktop, sessionID },
    ] as const,
  });

export const persistentPtySupportOptions = (scope: Scope, client: Client) =>
  queryOptions({
    queryFn: async ({ signal }) => {
      const info = await client.server.info({ signal });
      return info.capabilities?.persistentPty === true;
    },
    queryKey: [...queryKeys.server.info(scope), "persistent-pty"] as const,
    refetchOnMount: true,
    staleTime: 0,
  });
