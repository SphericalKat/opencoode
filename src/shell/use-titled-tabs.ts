import type { QueryClient } from "@tanstack/react-query";
import {
  notifyManager,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import type { SessionTabItem } from "../components/beta-navigation";
import { sessionDetailOptions } from "../lib/queries/sessions";
import { sessionLabel } from "../lib/session-title";
import type { OpenSessionTab } from "../stores/session-tabs-store";
import type { ServerClient } from "./types";

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

// Adds a title to each open tab from the cache. With a client, it also fetches
// the detail of tabs that miss it and keeps it fresh. Without a client, it
// only reads the cache. A query without a client must not observe the key: its
// `skipToken` replaces the query function of the observers that have a client,
// and an invalidation then fetches with `skipToken`. The cache notifies while
// a component renders, so the listener goes through the notify manager.
export const useTitledTabs = (
  serverID: string | undefined,
  tabs: OpenSessionTab[],
  client: ServerClient | null
): SessionTabItem[] => {
  const queryClient = useQueryClient();
  useQueries({
    queries:
      client && serverID
        ? tabs.map((tab) =>
            sessionDetailOptions(serverID, client.session, tab.id)
          )
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
