import type { SessionInfo } from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import { makeOpenCodeChatBackend } from "../lib/chat-backend";
import { createClient } from "../lib/client";
import { sessionDetailOptions } from "../lib/queries/sessions";
import { sessionLabel } from "../lib/session-title";
import {
  useConnectionStore,
  useConnectionStoreApi,
} from "../stores/connection-store";
import {
  useSessionLocationStore,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import { useSessionTabsStoreApi } from "../stores/session-tabs-store";

export const useClientBindings = () => {
  const active = useConnectionStore((state) => state.active);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const connection = useConnectionStoreApi();
  const location = useSessionLocationStoreApi();
  const tabs = useSessionTabsStoreApi();
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
        connection.getState().recoverConnection(active, cause);
      }
    },
    [active, connection]
  );
  const recordSessionInfo = useCallback(
    (session: SessionInfo) => {
      if (session.id !== location.getState().sessionID) {
        return;
      }
      const next = {
        directory: session.location.directory,
        id: session.id,
        title: sessionLabel(session),
      };
      const { openTabs } = tabs.getState();
      const previous = openTabs.find((item) => item.id === next.id);
      if (
        previous?.title === next.title &&
        previous.directory === next.directory
      ) {
        return;
      }
      tabs.setState({
        openTabs: previous
          ? openTabs.map((item) => (item.id === next.id ? next : item))
          : [...openTabs, next],
      });
    },
    [location, tabs]
  );

  const { data: detail } = useQuery(
    sessionDetailOptions(
      active?.id ?? "",
      sessionID ? (client?.session ?? null) : null,
      sessionID ?? ""
    )
  );
  useEffect(() => {
    if (detail) {
      recordSessionInfo(detail);
    }
  }, [detail, recordSessionInfo]);
  return {
    chatBackend,
    client,
    onPiConnectionLost,
    recordSessionInfo,
  };
};
