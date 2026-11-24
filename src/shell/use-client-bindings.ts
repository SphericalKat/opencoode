import type { SessionInfo } from "@opencode/client";
import { useQueryClient } from "@tanstack/react-query";
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

  const queryClient = useQueryClient();
  // Reads the detail once for the opened session. An observer would refetch it
  // after the session is deleted while its chat is hidden.
  useEffect(() => {
    if (!(client && active && sessionID)) {
      return;
    }
    let current = true;
    const record = async () => {
      try {
        const detail = await queryClient.ensureQueryData(
          sessionDetailOptions(active.id, client.session, sessionID)
        );
        if (current) {
          recordSessionInfo(detail);
        }
      } catch {
        // The chat reports a failed detail request.
      }
    };
    void record();
    return () => {
      current = false;
    };
  }, [active, client, queryClient, recordSessionInfo, sessionID]);
  return {
    chatBackend,
    client,
    onPiConnectionLost,
    recordSessionInfo,
  };
};
