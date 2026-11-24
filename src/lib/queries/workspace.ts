import type { FileSystemEntry } from "@opencode/client";
import { queryOptions, skipToken } from "@tanstack/react-query";

import type { Client } from "../client";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";

// Workspace panes fetch when they open and never serve a stale copy.
const PANEL = { refetchOnMount: true, staleTime: 0 } as const;

const SEARCH_LIMIT = 200;

export interface DirectoryFilesRequest {
  directory: string;
  path: string;
  query: string;
}

const compareEntries = (a: FileSystemEntry, b: FileSystemEntry): number => {
  if (a.type === b.type) {
    return a.path.localeCompare(b.path);
  }
  return a.type === "directory" ? -1 : 1;
};

export const directoryFilesOptions = (
  scope: Scope,
  client: Pick<Client, "file">,
  { directory, path, query }: DirectoryFilesRequest
) => {
  const search = query.trim();
  const location = { directory };
  return queryOptions({
    ...PANEL,
    queryFn: async ({ signal }): Promise<FileSystemEntry[]> => {
      const findFiles = client.file.find.bind(client.file);
      const result = search
        ? await findFiles(
            { limit: SEARCH_LIMIT, location, query: search },
            { signal }
          )
        : await client.file.list({ location, path }, { signal });
      const entries = [...result.data];
      entries.sort(compareEntries);
      return entries;
    },
    queryKey: queryKeys.dir.files(
      scope,
      directory,
      search ? { query: search } : { path }
    ),
  });
};

// An open file is never kept: the editor holds its own copy of the text.
export const directoryFileOptions = (
  scope: Scope,
  client: Pick<Client, "file">,
  directory: string,
  path: string
) =>
  queryOptions({
    ...PANEL,
    gcTime: 0,
    queryFn: ({ signal }) =>
      client.file.read({ location: { directory }, path }, { signal }),
    queryKey: queryKeys.dir.file(scope, directory, path),
  });

export const directoryWorktreesOptions = (
  scope: Scope,
  client: Pick<Client, "worktree">,
  directory: string,
  projectID: string | undefined
) =>
  queryOptions({
    ...PANEL,
    queryFn: projectID
      ? ({ signal }) => client.worktree.list({ projectID }, { signal })
      : skipToken,
    queryKey: queryKeys.dir.worktrees(scope, directory),
  });
