import type { SessionActive, SessionInfo } from "@opencode/client";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import { View } from "react-native";

import { errorMessage, errorMessageOrNull } from "../lib/client";
import type { Client } from "../lib/client";
import {
  activeSessionsOptions,
  childSessionsOptions,
} from "../lib/queries/sessions";
import { queryKeys } from "../lib/query-keys";
import { useServerScope } from "../lib/server-scope";
import { sessionStatus } from "../lib/session-status";
import { useTheme } from "../lib/theme";
import { useForeground } from "../stores/app-lifecycle-store";
import { useLiveStore } from "../stores/live-store";
import { confirmAction } from "./dialog";
import { SegmentedControl } from "./segmented-control";
import { Button, Busy, Card, Empty, ErrorNotice, BodyText, Row } from "./ui";

const childListOptions = [
  { label: "Current", value: "current" },
  { label: "Archived", value: "archived" },
] as const;

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
  const streamError = useLiveStore((s) => s.streamError) ?? undefined;
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
    errorMessageOrNull(list.error) ??
    errorMessageOrNull(activeQuery.error);
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
