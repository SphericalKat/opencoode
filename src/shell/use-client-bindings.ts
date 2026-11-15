import type { SessionInfo } from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";

import { makeOpenCodeChatBackend } from "../lib/chat-backend";
import { createClient } from "../lib/client";
import { sessionDetailOptions } from "../lib/queries/sessions";
import {
  useConnectionActions,
  useConnectionStore,
  useConnectionStoreApi,
} from "../stores/connection-store";
import {
  useSessionLocationStore,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import { useSessionTabsActions } from "../stores/session-tabs-store";

export const useClientBindings = () => {
  const active = useConnectionStore((state) => state.active);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const connection = useConnectionStoreApi();
  const location = useSessionLocationStoreApi();
  const { openTab } = useSessionTabsActions();
  const { markRecovering } = useConnectionActions();
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
        markRecovering(active, cause);
      }
    },
    [active, markRecovering]
  );
  const recordSessionInfo = useCallback(
    (session: SessionInfo) => {
      const serverID = connection.getState().active?.id;
      if (!serverID || session.id !== location.getState().sessionID) {
        return;
      }
      openTab(serverID, {
        directory: session.location.directory,
        id: session.id,
      });
    },
    [connection, location, openTab]
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
