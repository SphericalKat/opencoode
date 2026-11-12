import type { SessionMessageInfo } from "@opencode/client";
import React, { useCallback, useLayoutEffect } from "react";

import { mergeMessages } from "../../lib/chat";
import {
  mergeForms,
  nextCursor,
  fetchErrorOf,
  fetchSessionSnapshot,
} from "./session-sync";
import type { CoreClient, OpenCodeClient, Capabilities } from "./session-sync";
import type { Alive } from "./types";
import type { SessionState } from "./use-session-state";
import { withCleanup } from "./util";

interface UseSessionRefreshOptions {
  alive: Alive;
  capabilities: Capabilities;
  client: CoreClient;
  opencodeClient: OpenCodeClient;
  reportConnectionFailure: (reason: unknown) => void;
  sessionID: string;
  setTitle: React.Dispatch<React.SetStateAction<string>>;
  sync: SessionState;
}

export const useSessionRefresh = ({
  alive,
  capabilities,
  client,
  opencodeClient,
  reportConnectionFailure,
  sessionID,
  setTitle,
  sync,
}: UseSessionRefreshOptions) => {
  const {
    setSession,
    setMessages,
    setCursor,
    setInbox,
    setForms,
    setPermissions,
    setActive,
    setSessionStatus,
    setLoading,
    setFetchError,
    setSyncErrors,
    refreshRef,
    flushStreamRef,
    requestVersionRef,
    sessionDirectoryRef,
    liveMessagesRef,
    historyEpochRef,
    activityRevisionRef,
    appliedHistoryEpochRef,
    refreshingRef,
    refreshAgainRef,
  } = sync;
  const applyMessageSnapshot = useCallback(
    (snapshot: SessionMessageInfo[], reset = false) => {
      setMessages((current) => {
        for (const message of snapshot) {
          const live = liveMessagesRef.current.get(message.id);
          if (
            message.type === "assistant" &&
            live?.time.completed &&
            message.time.completed &&
            message.time.completed >= live.time.completed
          ) {
            liveMessagesRef.current.delete(message.id);
          }
        }
        return mergeMessages(reset ? [] : current, snapshot, [
          ...liveMessagesRef.current.values(),
        ]);
      });
    },
    [liveMessagesRef, setMessages]
  );

  const refresh = useCallback(
    async function refreshSession(signal?: AbortSignal): Promise<void> {
      flushStreamRef.current();
      if (refreshingRef.current) {
        refreshAgainRef.current = true;
        return refreshingRef.current;
      }
      const work = async () => {
        requestVersionRef.current += 1;
        const version = requestVersionRef.current;
        const historyVersion = historyEpochRef.current;
        const activityVersion = activityRevisionRef.current;
        const reset = historyVersion !== appliedHistoryEpochRef.current;
        const results = await fetchSessionSnapshot(
          client,
          opencodeClient,
          capabilities,
          sessionID,
          { signal }
        );
        if (
          !alive.current ||
          signal?.aborted ||
          version !== requestVersionRef.current
        ) {
          return;
        }
        const [
          sessionResult,
          messageResult,
          inboxResult,
          formsResult,
          permissionsResult,
          activeResult,
          globalFormsResult,
        ] = results;
        if (sessionResult.status === "fulfilled") {
          sessionDirectoryRef.current = sessionResult.value.location.directory;
          setSession(sessionResult.value);
          setTitle((current) => current || sessionResult.value.title || "");
        }
        if (messageResult.status === "fulfilled") {
          applyMessageSnapshot(messageResult.value.data, reset);
          if (reset) {
            setCursor(nextCursor(messageResult.value));
            appliedHistoryEpochRef.current = historyVersion;
          }
        }
        if (inboxResult.status === "fulfilled" && inboxResult.value) {
          setInbox(inboxResult.value);
        }
        if (opencodeClient && capabilities.forms) {
          setForms((current) =>
            mergeForms(current, formsResult, globalFormsResult, sessionID)
          );
        }
        if (
          permissionsResult.status === "fulfilled" &&
          permissionsResult.value
        ) {
          setPermissions(permissionsResult.value);
        }
        if (
          activeResult.status === "fulfilled" &&
          activityVersion === activityRevisionRef.current
        ) {
          const running = !!activeResult.value[sessionID];
          setActive(running);
          if (!running) {
            setSessionStatus({ type: "idle" });
          }
        }
        const failure = fetchErrorOf(results);
        setFetchError(failure);
        if (sessionResult.status === "rejected") {
          reportConnectionFailure(sessionResult.reason);
        }
        if (failure === null) {
          setSyncErrors({});
        }
        setLoading(false);
      };
      const running = work();
      refreshingRef.current = running;
      await withCleanup(
        () => running,
        () => {
          refreshingRef.current = null;
          if (refreshAgainRef.current && alive.current) {
            refreshAgainRef.current = false;
            void refreshSession(signal?.aborted ? undefined : signal);
          }
        }
      );
    },
    [
      client,
      opencodeClient,
      capabilities,
      sessionID,
      applyMessageSnapshot,
      reportConnectionFailure,
      setFetchError,
      setSession,
      sessionDirectoryRef,
      historyEpochRef,
      setLoading,
      appliedHistoryEpochRef,
      setInbox,
      setPermissions,
      setCursor,
      refreshAgainRef,
      alive,
      setForms,
      setTitle,
      activityRevisionRef,
      setSyncErrors,
      refreshingRef,
      setSessionStatus,
      flushStreamRef,
      setActive,
      requestVersionRef,
    ]
  );
  useLayoutEffect(() => {
    refreshRef.current = () => {
      void refresh();
    };
  }, [refresh, refreshRef]);
  const handleChanged = useCallback(() => {
    refreshRef.current();
  }, [refreshRef]);

  return { applyMessageSnapshot, handleChanged, refresh };
};
