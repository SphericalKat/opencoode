import type { OpenCodeEvent, SessionMessageInfo } from "@opencode/client";
import React, { useEffect } from "react";

import { noop, settle } from "../../lib/async";
import { projectLiveEvents } from "../../lib/chat";
import type { ChatBackend, ChatBackendSnapshot } from "../../lib/chat-backend";
import { errorMessage } from "../../lib/client";
import { createStreamBatch } from "../../lib/stream-batch";
import { withoutScopeError, SCOPE_LOADERS, startLive } from "./session-sync";
import type {
  CoreClient,
  OpenCodeClient,
  Capabilities,
  LiveContext,
} from "./session-sync";
import type { SyncScope, Alive } from "./types";
import type { SessionState } from "./use-session-state";

interface UseLiveSessionOptions {
  alive: Alive;
  applyMessageSnapshot: (
    snapshot: SessionMessageInfo[],
    reset?: boolean
  ) => void;
  backend: ChatBackend;
  capabilities: Capabilities;
  client: CoreClient;
  connectionFailures: React.RefObject<number>;
  foreground: boolean;
  opencodeClient: OpenCodeClient;
  refresh: (signal?: AbortSignal) => Promise<void>;
  reportConnectionFailure: (reason: unknown) => void;
  sessionID: string;
  showError: (reason: unknown) => void;
  visible: boolean;
  sync: SessionState;
}

export const useLiveSession = ({
  alive,
  applyMessageSnapshot,
  backend,
  capabilities,
  client,
  connectionFailures,
  foreground,
  opencodeClient,
  refresh,
  reportConnectionFailure,
  sessionID,
  showError,
  visible,
  sync,
}: UseLiveSessionOptions) => {
  const {
    setSession,
    setMessages,
    setInbox,
    setForms,
    setPermissions,
    setCatalogRevision,
    setActive,
    setSessionStatus,
    setLoading,
    setFetchError,
    setSyncErrors,
    setStreamStatus,
    setActivityNotice,
    setBackendWaiting,
    flushStreamRef,
    requestVersionRef,
    sessionDirectoryRef,
    liveMessagesRef,
    historyEpochRef,
    activityRevisionRef,
    refreshingRef,
  } = sync;
  useEffect(() => {
    if (!foreground || !visible) {
      return;
    }
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const live: LiveContext["live"] = { attempts: 0 };
    const scopeTimers = new Map<SyncScope, ReturnType<typeof setTimeout>>();
    const scopeVersions = new Map<SyncScope, number>();
    const applyEvents = (events: OpenCodeEvent[]) => {
      setMessages((current) => {
        const next = projectLiveEvents(current, events, sessionID);
        if (next === current) {
          return current;
        }
        const touched = new Set<string>();
        for (const event of events) {
          const data = event.data as Record<string, unknown>;
          if (typeof data.assistantMessageID === "string") {
            touched.add(data.assistantMessageID);
          }
        }
        for (const message of next) {
          if (message.type === "assistant" && touched.has(message.id)) {
            liveMessagesRef.current.set(message.id, message);
          }
        }
        return next;
      });
    };
    const stream = createStreamBatch<OpenCodeEvent>(applyEvents, {
      frame: true,
    });
    const snapshots = createStreamBatch<ChatBackendSnapshot>(
      (batch) => {
        const snapshot = batch.at(-1);
        if (!snapshot || controller.signal.aborted || !alive.current) {
          return;
        }
        setStreamStatus("Live");
        liveMessagesRef.current.clear();
        sessionDirectoryRef.current = snapshot.session.location.directory;
        setSession(snapshot.session);
        setMessages(snapshot.messages);
        setActive(snapshot.active);
        setSessionStatus(
          snapshot.status ??
            (snapshot.active ? { type: "busy" } : { type: "idle" })
        );
        setActivityNotice(snapshot.activityNotice ?? backend.activityNotice);
        setBackendWaiting(snapshot.waiting);
        setFetchError(null);
        setLoading(false);
      },
      { frame: true }
    );
    const flushPending = () => {
      stream.flush();
      snapshots.flush();
    };
    flushStreamRef.current = flushPending;
    const scheduleRefresh = () => {
      if (timer) {
        return;
      }
      timer = setTimeout(() => {
        timer = undefined;
        void refresh(controller.signal);
      }, 300);
    };
    const refreshScope = async (scope: SyncScope) => {
      if (refreshingRef.current) {
        await refreshingRef.current;
      }
      if (controller.signal.aborted) {
        return;
      }
      const version = (scopeVersions.get(scope) || 0) + 1;
      scopeVersions.set(scope, version);
      const snapshotVersion = requestVersionRef.current;
      const current = () =>
        !controller.signal.aborted &&
        scopeVersions.get(scope) === version &&
        snapshotVersion === requestVersionRef.current;
      await settle(
        async () => {
          const loaded = await SCOPE_LOADERS[scope]({
            applyMessageSnapshot,
            capabilities,
            client,
            current,
            opencodeClient,
            scheduleRefresh,
            sessionDirectory: sessionDirectoryRef,
            sessionID,
            setForms,
            setInbox,
            setPermissions,
            setSession,
            signal: controller.signal,
          });
          if (loaded && current()) {
            setSyncErrors((previous) =>
              previous[scope] ? withoutScopeError(previous, scope) : previous
            );
          }
        },
        (error_) => {
          if (current()) {
            setSyncErrors((previous) => ({
              ...previous,
              [scope]: errorMessage(error_),
            }));
          }
        }
      );
    };
    const scheduleScope = (scope: SyncScope) => {
      if (scopeTimers.has(scope)) {
        return;
      }
      scopeTimers.set(
        scope,
        setTimeout(() => {
          scopeTimers.delete(scope);
          void refreshScope(scope);
        }, 200)
      );
    };
    void startLive({
      activityRevision: activityRevisionRef,
      applyEvents,
      backend,
      client,
      connectionFailures,
      flushPending,
      live,
      refresh,
      reportConnectionFailure,
      resetHistory: () => {
        historyEpochRef.current += 1;
        setMessages((current) => {
          liveMessagesRef.current.clear();
          return current;
        });
      },
      scheduleRefresh,
      scheduleScope,
      sessionDirectory: sessionDirectoryRef,
      sessionID,
      setActive,
      setCatalogRevision,
      setFetchError,
      setSession,
      setSessionStatus,
      setStreamStatus,
      signal: controller.signal,
      snapshots,
      stream,
    }).catch(showError);
    return () => {
      controller.abort();
      stream.clear();
      snapshots.clear();
      if (flushStreamRef.current === flushPending) {
        flushStreamRef.current = noop;
      }
      clearTimeout(timer);
      clearTimeout(live.retryTimer);
      for (const scopeTimer of scopeTimers.values()) {
        clearTimeout(scopeTimer);
      }
      live.retryResolve?.();
    };
  }, [
    backend,
    client,
    opencodeClient,
    capabilities,
    sessionID,
    foreground,
    visible,
    refresh,
    showError,
    applyMessageSnapshot,
    reportConnectionFailure,
    setSyncErrors,
    activityRevisionRef,
    setStreamStatus,
    setActive,
    setSessionStatus,
    refreshingRef,
    liveMessagesRef,
    setPermissions,
    setFetchError,
    setSession,
    setBackendWaiting,
    setInbox,
    connectionFailures,
    setLoading,
    flushStreamRef,
    requestVersionRef,
    setForms,
    sessionDirectoryRef,
    setCatalogRevision,
    historyEpochRef,
    setMessages,
    alive,
    setActivityNotice,
  ]);
};
