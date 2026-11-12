import type { SessionInfo } from "@opencode/client";
import React, { useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { useTheme } from "../lib/theme";
import {
  Button,
  Busy,
  Card,
  Empty,
  ErrorNotice,
  BodyText,
  Row,
  confirmAction,
} from "./ui";

const ignore = () => null;

const runWithCleanup = async (
  task: () => Promise<void>,
  cleanup: () => void
) => {
  try {
    await task();
  } finally {
    cleanup();
  }
};

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

const childStatus = (isActive: boolean, outcome: SessionInfo["outcome"]) => {
  if (isActive) {
    return "Running";
  }
  if (outcome === "succeeded") {
    return "Completed";
  }
  if (outcome === "failed") {
    return "Failed";
  }
  if (outcome === "interrupted") {
    return "Stopped";
  }
  return "Idle";
};

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
  const [items, setItems] = useState<SessionInfo[]>([]);
  const [activeIDs, setActiveIDs] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<string>();
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stoppingID, setStoppingID] = useState<string>();
  const [error, setError] = useState<string>();
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
  );
  const knownIDs = useRef(new Set<string>());
  const refreshRef = useRef<() => void>(ignore);
  const moreRef = useRef<() => void>(ignore);
  const stopRef = useRef<(id: string) => void>(ignore);

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!foreground) {
      return;
    }
    const controller = new AbortController();
    let version = 0;
    let nextCursor: string | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let releaseRetry: (() => void) | undefined;
    let attempts = 0;
    let paging = false;
    setItems([]);
    setActiveIDs(new Set());
    setCursor(undefined);
    setError(undefined);
    setLoadingMore(false);
    setStoppingID(undefined);
    knownIDs.current.clear();
    const refresh = async () => {
      version += 1;
      const request = version;
      setLoading(true);
      await runWithCleanup(
        async () => {
          try {
            const [sessions, active] = await Promise.all([
              client.session.list(
                { archived, limit: 40, order: "desc", parentID: sessionID },
                { signal: controller.signal }
              ),
              client.session.active({ signal: controller.signal }),
            ]);
            if (controller.signal.aborted || request !== version) {
              return;
            }
            knownIDs.current = new Set(sessions.data.map((item) => item.id));
            nextCursor = sessions.cursor.next ?? undefined;
            setItems(sessions.data);
            setActiveIDs(new Set(Object.keys(active)));
            setCursor(nextCursor);
            setError(undefined);
          } catch (error_) {
            if (!controller.signal.aborted && request === version) {
              setError(errorMessage(error_));
            }
          }
        },
        () => {
          if (!controller.signal.aborted && request === version) {
            setLoading(false);
          }
        }
      );
    };
    const scheduleRefresh = () => {
      if (refreshTimer) {
        return;
      }
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        void refresh();
      }, 250);
    };
    refreshRef.current = () => {
      void refresh();
    };
    moreRef.current = () => {
      if (!nextCursor || paging) {
        return;
      }
      paging = true;
      const request = version;
      const pageCursor = nextCursor;
      setLoadingMore(true);
      const pending = client.session.list(
        { archived, cursor: pageCursor, limit: 40, parentID: sessionID },
        { signal: controller.signal }
      );
      void runWithCleanup(
        async () => {
          try {
            const page = await pending;
            if (controller.signal.aborted || request !== version) {
              return;
            }
            for (const item of page.data) {
              knownIDs.current.add(item.id);
            }
            nextCursor = page.cursor.next ?? undefined;
            setCursor(nextCursor);
            setItems((current) => [
              ...current,
              ...page.data.filter(
                (item) => !current.some((existing) => existing.id === item.id)
              ),
            ]);
          } catch (error_) {
            if (!controller.signal.aborted) {
              setError(errorMessage(error_));
            }
          }
        },
        () => {
          paging = false;
          if (!controller.signal.aborted) {
            setLoadingMore(false);
          }
        }
      );
    };
    stopRef.current = (id) => {
      void (async () => {
        if (
          !(await confirmAction(
            "Stop this child session?",
            "This interrupts its current execution."
          ))
        ) {
          return;
        }
        if (controller.signal.aborted) {
          return;
        }
        setStoppingID(id);
        await runWithCleanup(
          async () => {
            try {
              await client.session.interrupt(
                { sessionID: id },
                { signal: controller.signal }
              );
              await refresh();
            } catch (error_) {
              if (!controller.signal.aborted) {
                setError(errorMessage(error_));
              }
            }
          },
          () => {
            if (!controller.signal.aborted) {
              setStoppingID(undefined);
            }
          }
        );
      })();
    };
    const armRetry = (resolve: () => void, delay: number) => {
      releaseRetry = resolve;
      retryTimer = setTimeout(resolve, delay);
    };
    const handleEvent = (event: ChildSessionEvent) => {
      attempts = 0;
      if (
        event.type === "server.connected" ||
        (event.type === "session.created" && event.data.parentID === sessionID)
      ) {
        scheduleRefresh();
        return;
      }
      if (
        !("sessionID" in event.data) ||
        !knownIDs.current.has(event.data.sessionID)
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
        setActiveIDs((current) => new Set([...current, id]));
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
        setActiveIDs((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        const pending = client.session.get(
          { sessionID: id },
          { signal: controller.signal }
        );
        void (async () => {
          try {
            const item = await pending;
            if (!controller.signal.aborted && knownIDs.current.has(id)) {
              setItems((current) =>
                current.map((existing) =>
                  existing.id === id ? item : existing
                )
              );
            }
          } catch (error_) {
            if (!controller.signal.aborted) {
              setError(errorMessage(error_));
            }
          }
        })();
      }
      if (event.type === "session.renamed") {
        setItems((current) =>
          current.map((item) =>
            item.id === id ? { ...item, title: event.data.title } : item
          )
        );
      }
      if (event.type === "session.usage.updated") {
        setItems((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  cost: event.data.cost,
                  tokens: event.data.tokens,
                }
              : item
          )
        );
      }
    };
    void (async () => {
      await refresh();
      while (!controller.signal.aborted) {
        try {
          await followEvents(
            subscribeChildSessionEvents(client, controller.signal),
            controller.signal,
            handleEvent
          );
        } catch (error_) {
          if (controller.signal.aborted) {
            break;
          }
          setError(errorMessage(error_));
          const delay = retryDelay(attempts);
          attempts += 1;
          await new Promise<void>((resolve) => {
            armRetry(resolve, delay);
          });
          if (!controller.signal.aborted) {
            await refresh();
          }
        }
      }
    })().catch((error_) => {
      if (!controller.signal.aborted) {
        setError(errorMessage(error_));
      }
    });
    return () => {
      controller.abort();
      clearTimeout(refreshTimer);
      clearTimeout(retryTimer);
      releaseRetry?.();
      refreshRef.current = ignore;
      moreRef.current = ignore;
      stopRef.current = ignore;
    };
  }, [client, sessionID, archived, foreground]);

  const running = items.filter((item) => activeIDs.has(item.id)).length;
  return (
    <View style={{ gap: 14 }}>
      <Row>
        <Button
          title="Current"
          compact
          selected={!archived}
          onPress={() => setArchived(false)}
        />
        <Button
          title="Archived"
          compact
          selected={archived}
          onPress={() => setArchived(true)}
        />
        <Button
          title="Refresh"
          compact
          disabled={!foreground || loading}
          onPress={() => refreshRef.current()}
        />
      </Row>
      <ErrorNotice error={error} onRetry={() => refreshRef.current()} />
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
        const status = childStatus(isActive, item.outcome);
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
                compact
                onPress={() => onOpenSession(item.id)}
              />
              {isActive && (
                <Button
                  title="Stop"
                  compact
                  variant="danger"
                  busy={stoppingID === item.id}
                  disabled={!!stoppingID}
                  onPress={() => stopRef.current(item.id)}
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
          onPress={() => moreRef.current()}
        />
      )}
    </View>
  );
};
