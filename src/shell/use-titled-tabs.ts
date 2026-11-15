import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";

import type { SessionTabItem } from "../components/beta-navigation";
import { sessionDetailOptions } from "../lib/queries/sessions";
import { sessionLabel } from "../lib/session-title";
import type { OpenSessionTab } from "../stores/session-tabs-store";
import type { ServerClient } from "./types";

const FALLBACK_TITLE = "Session";

// Adds a title to each open tab from the cached `session.detail` of its
// session. With a client, it also fetches the detail of tabs that miss it.
export const useTitledTabs = (
  serverID: string | undefined,
  tabs: OpenSessionTab[],
  client: ServerClient | null
): SessionTabItem[] => {
  const titles = useQueries({
    combine: (results) =>
      results.map((result) =>
        result.data ? sessionLabel(result.data) : FALLBACK_TITLE
      ),
    queries: tabs.map((tab) =>
      sessionDetailOptions(serverID ?? "", client?.session ?? null, tab.id)
    ),
  });
  return useMemo(
    () =>
      tabs.map((tab, index) => ({
        ...tab,
        title: titles[index] ?? FALLBACK_TITLE,
      })),
    [tabs, titles]
  );
};
