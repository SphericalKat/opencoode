import { queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

import type { Client } from "../client";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";

// Attachment bytes can be large. Each read hits the server, and the cache
// never keeps a copy.
export const fileReadOptions = (
  scope: Scope,
  client: Client,
  directory: string | undefined,
  path: string
) =>
  queryOptions({
    gcTime: 0,
    queryFn: ({ signal }) =>
      client.file.read(
        { location: directory ? { directory } : undefined, path },
        { signal }
      ),
    queryKey: queryKeys.dir.file(scope, directory ?? "", path),
    staleTime: 0,
  });

// fetchQuery runs on the query's own signal. Cancel the query when the caller
// aborts, so leaving the screen stops the download.
export const readAttachment = (
  queryClient: QueryClient,
  options: ReturnType<typeof fileReadOptions>,
  signal: AbortSignal
) => {
  const cancel = () => {
    void queryClient.cancelQueries({ exact: true, queryKey: options.queryKey });
  };
  signal.addEventListener("abort", cancel, { once: true });
  return queryClient
    .fetchQuery(options)
    .finally(() => signal.removeEventListener("abort", cancel));
};
