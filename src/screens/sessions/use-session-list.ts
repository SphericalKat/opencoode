import type { SessionInfo } from "@opencode/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import type { Client } from "../../lib/client";
import { startLiveUpdates } from "./live-updates";
import {
  SESSION_PAGE_SIZE,
  applyRefreshResult,
  fetchSessionPage,
  startRefreshRequest,
} from "./refresh";
import { useMounted } from "./use-mounted";

const LIST_RESET_DELAY_MS = 250;

const isForegroundState = (state: string | null | undefined): boolean =>
  state !== "background" && state !== "inactive";

const useForeground = (): boolean => {
  const [foreground, setForeground] = useState(
    isForegroundState(AppState.currentState)
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => subscription.remove();
  }, []);
  return foreground;
};

interface SessionListOptions {
  archived: boolean;
  client: Client;
  listDirectory: string | undefined;
  revision: number | undefined;
  search: string;
}

export const useSessionList = ({
  archived,
  client,
  listDirectory,
  revision,
  search,
}: SessionListOptions) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [active, setActive] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [listUnavailable, setListUnavailable] = useState(false);
  const [listError, setListError] = useState<string>();
  const [statusError, setStatusError] = useState<string>();
  const [streamError, setStreamError] = useState<string>();
  const mounted = useMounted();
  const foreground = useForeground();
  const generation = useRef(0);
  const refreshRequest = useRef<AbortController | null>(null);
  const quietRefreshPending = useRef(false);
  const paging = useRef(false);
  const loadedCount = useRef(SESSION_PAGE_SIZE);
  const refreshRef = useRef<
    (quiet?: boolean, signal?: AbortSignal) => Promise<void>
  >(async () => {
    // Replaced once the list refresh is wired up.
  });

  const [query, setQuery] = useState({
    archived,
    client,
    listDirectory,
    revision,
    search,
  });
  if (
    query.archived !== archived ||
    query.client !== client ||
    query.listDirectory !== listDirectory ||
    query.revision !== revision ||
    query.search !== search
  ) {
    setQuery({ archived, client, listDirectory, revision, search });
    setSessions([]);
    setNextCursor(undefined);
    setLoading(true);
  }

  const refresh = useCallback(
    async (cursor?: string, quiet = false, signal?: AbortSignal) => {
      if (quiet && refreshRequest.current) {
        quietRefreshPending.current = true;
        return;
      }
      quietRefreshPending.current = false;
      generation.current += 1;
      const request = generation.current;
      refreshRequest.current?.abort();
      const pending = startRefreshRequest(signal);
      const { controller } = pending;
      refreshRequest.current = controller;
      if (!quiet) {
        setLoading(true);
        setListError(undefined);
      }
      const result = await fetchSessionPage(
        query.client,
        {
          archived: query.archived,
          cursor,
          directory: query.listDirectory,
          limit: cursor ? SESSION_PAGE_SIZE : loadedCount.current,
          search: query.search,
        },
        pending
      );
      if (mounted.current && request === generation.current) {
        applyRefreshResult(
          result,
          {
            aborted: controller.signal.aborted,
            cursor,
            timedOut: pending.state.timedOut,
          },
          {
            loadedCount,
            setActive,
            setListError,
            setListUnavailable,
            setNextCursor,
            setSessions,
            setStatusError,
          }
        );
      }
      pending.finish();
      if (refreshRequest.current === controller) {
        refreshRequest.current = null;
      }
      if (request !== generation.current) {
        return;
      }
      if (mounted.current) {
        setLoading(false);
      }
      paging.current = false;
      if (
        mounted.current &&
        quietRefreshPending.current &&
        !controller.signal.aborted
      ) {
        quietRefreshPending.current = false;
        void refreshRef.current(true, signal);
      }
    },
    [query, mounted]
  );

  useEffect(() => {
    refreshRef.current = (quiet, signal) => refresh(undefined, quiet, signal);
  }, [refresh]);

  useEffect(() => {
    generation.current += 1;
    loadedCount.current = SESSION_PAGE_SIZE;
    const timer = setTimeout(() => {
      if (isForegroundState(AppState.currentState)) {
        void refresh();
      }
    }, LIST_RESET_DELAY_MS);
    return () => {
      clearTimeout(timer);
      generation.current += 1;
      refreshRequest.current?.abort();
    };
  }, [refresh]);

  useEffect(() => {
    if (!foreground) {
      refreshRequest.current?.abort();
      quietRefreshPending.current = false;
      return;
    }
    return startLiveUpdates({
      client,
      refresh: (signal) => refreshRef.current(true, signal),
      setStreamError,
    });
  }, [client, foreground]);

  const loadMore = () => {
    if (loading || paging.current || !nextCursor) {
      return;
    }
    paging.current = true;
    void refresh(nextCursor);
  };

  return {
    active,
    listError,
    listUnavailable,
    loadMore,
    loading,
    nextCursor,
    refresh,
    sessions,
    statusError,
    streamError,
  };
};
