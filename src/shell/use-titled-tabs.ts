import type { QueryClient } from "@tanstack/react-query";
import {
  notifyManager,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { SessionTabItem } from "../components/beta-navigation";
import { sessionDetailOptions } from "../lib/queries/sessions";
import { queryKeys } from "../lib/query-keys";
import { sessionLabel } from "../lib/session-title";
import type { OpenSessionTab } from "../stores/session-tabs-store";

const FALLBACK_TITLE = "Session";

// Lists the title of each tab from the cached `session.detail` of its session.
export const cachedTabTitles = (
  queryClient: QueryClient,
  serverID: string | undefined,
  tabs: OpenSessionTab[]
): string[] =>
  tabs.map((tab) => {
    const detail = queryClient.getQueryData(
      sessionDetailOptions(serverID ?? "", null, tab.id).queryKey
    );
    return detail ? sessionLabel(detail) : FALLBACK_TITLE;
  });

// Observes the detail of a tab without a query function and without fetching.
// The observer keeps the cached detail from garbage collection. Invalidation
// skips a disabled observer, so a deleted session sends no request. An
// observer with its own query function would also replace the one of the chat
// that observes the same key.
export const tabDetailObserverOptions = (scope: string, sessionID: string) => ({
  enabled: false,
  queryKey: queryKeys.session.detail(scope, sessionID),
  staleTime: Number.POSITIVE_INFINITY,
});

// Adds a title to each open tab from the cache. A chat fetches the detail when
// it opens, and live events keep it fresh while the chat is open. The cache
// notifies while a component renders, so the listener goes through the notify
// manager.
export const useTitledTabs = (
  serverID: string | undefined,
  tabs: OpenSessionTab[]
): SessionTabItem[] => {
  const queryClient = useQueryClient();
  useQueries({
    queries: serverID
      ? tabs.map((tab) => tabDetailObserverOptions(serverID, tab.id))
      : [],
  });
  const subscribe = useCallback(
    (onChange: () => void) =>
      queryClient.getQueryCache().subscribe(notifyManager.batchCalls(onChange)),
    [queryClient]
  );
  const getSnapshot = useCallback(
    () => JSON.stringify(cachedTabTitles(queryClient, serverID, tabs)),
    [queryClient, serverID, tabs]
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => {
    const titles = JSON.parse(snapshot) as string[];
    return tabs.map((tab, index) => ({
      ...tab,
      title: titles[index] ?? FALLBACK_TITLE,
    }));
  }, [snapshot, tabs]);
};
