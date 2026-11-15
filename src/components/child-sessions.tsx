import type { SessionActive, SessionInfo } from "@opencode/client";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { useForeground } from "../lib/foreground";
import {
  activeSessionsOptions,
  childSessionsOptions,
  sessionDetailOptions,
} from "../lib/queries/sessions";
import type { SessionPage } from "../lib/queries/sessions";
import { queryKeys } from "../lib/query-keys";
import { useServerScope } from "../lib/server-scope";
import { sessionStatus } from "../lib/session-status";
import { useTheme } from "../lib/theme";
import { confirmAction } from "./dialog";
import { SegmentedControl } from "./segmented-control";
import { Button, Busy, Card, Empty, ErrorNotice, BodyText, Row } from "./ui";

const childListOptions = [
  { label: "Current", value: "current" },
  { label: "Archived", value: "archived" },
] as const;

const followEvents = async <T,>(
  events: AsyncIterable<T>,
  signal: AbortSignal,
  handle: (event: T) => void
) => {
  for await (const event of events) {
    if (signal.aborted) {
      break;
    }
    handle(event);
  }
  if (!signal.aborted) {
    throw new Error("Child session updates disconnected");
  }
};

const subscribedEvents = [
  "session.created",
  "session.deleted",
  "session.archived",
  "session.unarchived",
  "session.renamed",
  "session.execution.started",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
  "session.usage.updated",
] as const;

const subscribeChildSessionEvents = (client: Client, signal: AbortSignal) =>
  client.event.subscribe({ signal, types: subscribedEvents });

type ChildSessionEvent =
  ReturnType<typeof subscribeChildSessionEvents> extends AsyncIterable<
    infer Event
  >
    ? Event
    : never;

const retryDelay = (attempts: number) =>
  Math.min(1000 * 2 ** Math.min(attempts, 4), 15_000);

const childStatusColor = (
  isActive: boolean,
  outcome: SessionInfo["outcome"],
  colors: ReturnType<typeof useTheme>["colors"]
) => {
  if (isActive) {
    return colors.success;
  }
  if (outcome === "failed") {
    return colors.danger;
  }
  return colors.muted;
};

const patchItems = (
  data: InfiniteData<SessionPage, string | undefined> | undefined,
  id: string,
  patch: (item: SessionInfo) => SessionInfo
) =>
  data && {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      data: page.data.map((item) => (item.id === id ? patch(item) : item)),
    })),
  };

const hasItem = (
  data: InfiniteData<SessionPage, string | undefined> | undefined,
  id: string
) => !!data?.pages.some((page) => page.data.some((item) => item.id === id));

const NO_ACTIVE: Record<string, SessionActive> = {};

export const ChildSessions = ({
  client,
  sessionID,
  onOpenSession,
}: {
  client: Client;
  sessionID: string;
  onOpenSession: (id: string) => void;
}) => {
  const { colors } = useTheme();
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const foreground = useForeground();
  const [archived, setArchived] = useState(false);
  const [streamError, setStreamError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const listOptions = childSessionsOptions(scope, client, sessionID, archived);
  const list = useInfiniteQuery({
    ...listOptions,
    enabled: foreground,
    refetchOnMount: true,
  });
  const activeQuery = useQuery({
    ...activeSessionsOptions(scope, client.session),
    enabled: foreground,
  });
  const items = useMemo(
    () => [
      ...new Map(
        (list.data?.pages ?? [])
          .flatMap((page) => page.data)
          .map((item) => [item.id, item])
      ).values(),
    ],
    [list.data?.pages]
  );
  const activeIDs = useMemo(
    () => new Set(Object.keys(activeQuery.data ?? NO_ACTIVE)),
    [activeQuery.data]
  );
  const cursor = list.hasNextPage;
  const loading = list.isFetching && !list.isFetchingNextPage;
  const loadingMore = list.isFetchingNextPage;
  const error =
    actionError ??
    streamError ??
    (list.error ? errorMessage(list.error) : undefined) ??
    (activeQuery.error ? errorMessage(activeQuery.error) : undefined);
  const { fetchNextPage, refetch: refetchList } = list;
  const { refetch: refetchActive } = activeQuery;
  const refresh = () => {
    setActionError(undefined);
    void refetchList();
    void refetchActive();
  };
  const loadMore = () => {
    if (list.hasNextPage && !list.isFetchingNextPage) {
      void fetchNextPage();
    }
  };
  const stop = useMutation({
    mutationFn: (id: string) => client.session.interrupt({ sessionID: id }),
    onError: (reason) => setActionError(errorMessage(reason)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.all(scope),
      }),
  });
  const stoppingID = stop.isPending ? stop.variables : undefined;
  const confirmStop = async (id: string) => {
    if (
      await confirmAction(
        "Stop this child session?",
        "This interrupts its current execution.",
        { confirmLabel: "Stop" }
      )
    ) {
      setActionError(undefined);
      stop.mutate(id);
    }
  };

  useEffect(() => {
    if (!foreground) {
      return;
    }
    const controller = new AbortController();
    const listKey = queryKeys.sessions.children(scope, sessionID, archived);
    const activeKey = queryKeys.sessions.active(scope);
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const scheduleRefresh = () => {
      if (refreshTimer) {
        return;
      }
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        void queryClient.invalidateQueries({ queryKey: listKey });
        void queryClient.invalidateQueries({ queryKey: activeKey });
      }, 250);
    };
    const patch = (id: string, change: (item: SessionInfo) => SessionInfo) =>
      queryClient.setQueryData<InfiniteData<SessionPage, string | undefined>>(
        listKey,
        (data) => patchItems(data, id, change)
      );
    const setRunning = (id: string, running: boolean) =>
      queryClient.setQueryData<Record<string, SessionActive>>(
        activeKey,
        (current) => {
          const others = Object.entries(current ?? {}).filter(
            ([key]) => key !== id
          );
          return Object.fromEntries(
            running ? [...others, [id, { type: "running" }]] : others
          );
        }
      );
    const refetchEnded = async (id: string) => {
      try {
        const item = await queryClient.fetchQuery({
          ...sessionDetailOptions(scope, client.session, id),
          staleTime: 0,
        });
        if (!controller.signal.aborted) {
          patch(id, () => item);
        }
      } catch (error_) {
        if (!controller.signal.aborted) {
          setStreamError(errorMessage(error_));
        }
      }
    };
    const handleEvent = (event: ChildSessionEvent) => {
      attempts = 0;
      setStreamError(undefined);
      if (
        event.type === "server.connected" ||
        (event.type === "session.created" && event.data.parentID === sessionID)
      ) {
        scheduleRefresh();
        return;
      }
      if (
        !("sessionID" in event.data) ||
        !hasItem(queryClient.getQueryData(listKey), event.data.sessionID)
      ) {
        return;
      }
      const id = event.data.sessionID;
      if (
        event.type === "session.deleted" ||
        event.type === "session.archived" ||
        event.type === "session.unarchived"
      ) {
        scheduleRefresh();
        return;
      }
      if (event.type === "session.execution.started") {
        setRunning(id, true);
      }
      if (
        event.type === "session.execution.succeeded" ||
        event.type === "session.execution.failed" ||
        event.type === "session.execution.interrupted"
      ) {
        if (
          event.type === "session.execution.interrupted" &&
          event.data.reason === "shutdown"
        ) {
          scheduleRefresh();
          return;
        }
        setRunning(id, false);
        void refetchEnded(id);
      }
      if (event.type === "session.renamed") {
        patch(id, (item) => ({ ...item, title: event.data.title }));
      }
      if (event.type === "session.usage.updated") {
        patch(id, (item) => ({
          ...item,
          cost: event.data.cost,
          tokens: event.data.tokens,
        }));
      }
    };
    const connect = async () => {
      try {
        await followEvents(
          subscribeChildSessionEvents(client, controller.signal),
          controller.signal,
          handleEvent
        );
      } catch (error_) {
        if (controller.signal.aborted) {
          return;
        }
        setStreamError(errorMessage(error_));
        const delay = retryDelay(attempts);
        attempts += 1;
        retryTimer = setTimeout(() => {
          scheduleRefresh();
          void connect();
        }, delay);
      }
    };
    void connect();
    return () => {
      controller.abort();
      clearTimeout(refreshTimer);
      clearTimeout(retryTimer);
    };
  }, [archived, client, foreground, queryClient, scope, sessionID]);

  const running = items.filter((item) => activeIDs.has(item.id)).length;
  return (
    <View style={{ gap: 14 }}>
      <Row>
        <SegmentedControl
          accessibilityLabel="Child session list"
          fullWidth={false}
          options={childListOptions}
          value={archived ? "archived" : "current"}
          onChange={(next) => setArchived(next === "archived")}
        />
        <Button
          title="Refresh"
          size="compact"
          disabled={!foreground || loading}
          onPress={refresh}
        />
      </Row>
      <ErrorNotice error={error} onRetry={refresh} />
      <BodyText muted>
        {running} running · {items.length}
        {cursor ? "+" : ""} child sessions
      </BodyText>
      {loading && !items.length && <Busy />}
      {!loading && !error && !items.length && (
        <Empty
          title="No child sessions"
          detail="Subagents appear here when this session delegates work."
        />
      )}
      {items.map((item) => {
        const isActive = activeIDs.has(item.id);
        const status = sessionStatus(isActive, item.outcome);
        return (
          <Card key={item.id}>
            <Row style={{ justifyContent: "space-between" }}>
              <BodyText
                numberOfLines={2}
                style={{ flex: 1, fontWeight: "500" }}
              >
                {item.title || "Child session"}
              </BodyText>
              <BodyText
                style={{
                  color: childStatusColor(isActive, item.outcome, colors),
                }}
              >
                {status}
              </BodyText>
            </Row>
            <BodyText muted>
              {item.agent || "Server default agent"} ·{" "}
              {item.tokens.output.toLocaleString()} output tokens · $
              {item.cost.toFixed(3)}
            </BodyText>
            <BodyText muted style={{ fontSize: 13 }}>
              Updated {new Date(item.time.updated).toLocaleString()}
            </BodyText>
            <Row>
              <Button
                title="Open session"
                size="compact"
                onPress={() => onOpenSession(item.id)}
              />
              {isActive && (
                <Button
                  title="Stop"
                  size="compact"
                  variant="danger"
                  busy={stoppingID === item.id}
                  disabled={!!stoppingID}
                  onPress={() => {
                    void confirmStop(item.id);
                  }}
                />
              )}
            </Row>
          </Card>
        );
      })}
      {cursor && (
        <Button
          title="Load more child sessions"
          variant="ghost"
          busy={loadingMore}
          onPress={loadMore}
        />
      )}
    </View>
  );
};
