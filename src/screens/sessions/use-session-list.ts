import type { SessionInfo } from "@opencode/client";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { withCleanup } from "../../lib/async";
import { errorMessage, errorMessageOrNull } from "../../lib/client";
import type { Client } from "../../lib/client";
import { useDebouncedValue } from "../../lib/debounce";
import {
  activeSessionsOptions,
  sessionListOptions,
} from "../../lib/queries/sessions";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import { useLiveStore } from "../../stores/live-store";

const SEARCH_DEBOUNCE_MS = 250;

interface SessionListOptions {
  archived: boolean;
  client: Client;
  listDirectory: string | undefined;
  search: string;
}

const uniqueSessions = (pages: { data: SessionInfo[] }[] | undefined) => [
  ...new Map(
    (pages ?? []).flatMap((page) => page.data).map((item) => [item.id, item])
  ).values(),
];

export const useSessionList = ({
  archived,
  client,
  listDirectory,
  search,
}: SessionListOptions) => {
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const liveError = useLiveStore((s) => s.streamError);
  const streamError = liveError
    ? `Live updates unavailable: ${liveError}`
    : undefined;
  const [refreshing, setRefreshing] = useState(false);
  const list = useInfiniteQuery(
    sessionListOptions(scope, client, {
      archived,
      directory: listDirectory,
      search: debouncedSearch,
    })
  );
  const running = useQuery(activeSessionsOptions(scope, client.session));
  const sessions = useMemo(
    () => uniqueSessions(list.data?.pages),
    [list.data?.pages]
  );
  const active = useMemo(
    () => new Set(Object.keys(running.data ?? {})),
    [running.data]
  );
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = list;
  const loadMore = () => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    void fetchNextPage();
  };
  const refresh = async () => {
    setRefreshing(true);
    await withCleanup(
      () =>
        queryClient.invalidateQueries({
          queryKey: queryKeys.sessions.all(scope),
        }),
      () => setRefreshing(false)
    );
  };
  return {
    active,
    listError: errorMessageOrNull(list.error),
    listUnavailable: list.isError,
    loadMore,
    loading:
      list.isPending ||
      refreshing ||
      debouncedSearch !== search ||
      isFetchingNextPage,
    hasMore: hasNextPage,
    refresh,
    sessions,
    statusError: running.error
      ? `Active status unavailable: ${errorMessage(running.error)}`
      : undefined,
    streamError,
  };
};
