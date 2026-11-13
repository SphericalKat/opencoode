import type { SessionInfo } from "@opencode/client";
import { useCallback, useEffect, useMemo } from "react";

import { makeOpenCodeChatBackend } from "../lib/chat-backend";
import { createClient } from "../lib/client";
import { noop } from "./constants";
import type { MobileState } from "./use-app-state";

export const useClientBindings = (model: MobileState) => {
  const {
    active,
    recoverConnectionRef,
    selectedSessionRef,
    sessionID,
    setOpenTabs,
  } = model;
  const client = useMemo(
    () => (active && active.backend !== "pi" ? createClient(active) : null),
    [active]
  );
  const chatBackend = useMemo(
    () => (client ? makeOpenCodeChatBackend(client) : null),
    [client]
  );
  const onPiConnectionLost = useCallback(
    (cause: unknown) => {
      if (active?.backend === "pi") {
        recoverConnectionRef.current(active, cause);
      }
    },
    [active, recoverConnectionRef]
  );
  const recordSessionInfo = useCallback(
    (session: SessionInfo) => {
      if (session.id !== selectedSessionRef.current) {
        return;
      }
      const next = {
        directory: session.location.directory,
        id: session.id,
        title: session.title || "New session",
      };
      setOpenTabs((current) => {
        const previous = current.find((item) => item.id === next.id);
        if (
          previous?.title === next.title &&
          previous.directory === next.directory
        ) {
          return current;
        }
        return previous
          ? current.map((item) => (item.id === next.id ? next : item))
          : [...current, next];
      });
    },
    [setOpenTabs, selectedSessionRef]
  );

  useEffect(() => {
    if (!client || !sessionID) {
      return;
    }
    const controller = new AbortController();
    void client.session
      .get({ sessionID }, { signal: controller.signal })
      .then((session) => {
        if (!controller.signal.aborted) {
          recordSessionInfo(session);
        }
        return null;
      })
      .catch(noop);
    return () => controller.abort();
  }, [client, sessionID, recordSessionInfo]);
  return {
    chatBackend,
    client,
    onPiConnectionLost,
    recordSessionInfo,
  };
};
