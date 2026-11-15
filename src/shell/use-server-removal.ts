import { useQueryClient } from "@tanstack/react-query";

import { useUndoableRemoval } from "../components/snackbar";
import type { Connection } from "../lib/client";
import {
  loadConnections,
  saveActiveConnectionId,
  saveConnections,
} from "../lib/storage";
import { useComposerActions } from "../stores/composer-store";
import {
  useConnectionActions,
  useConnectionStoreApi,
} from "../stores/connection-store";
import {
  useSessionLocationActions,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import { useSessionTabsActions } from "../stores/session-tabs-store";
import type { ConfirmNavigation } from "./types";

export const useServerRemoval = (confirmNavigation: ConfirmNavigation) => {
  const connectionStore = useConnectionStoreApi();
  const connectionActions = useConnectionActions();
  const locationStore = useSessionLocationStoreApi();
  const locationActions = useSessionLocationActions();
  const composerActions = useComposerActions();
  const tabsActions = useSessionTabsActions();
  const queryClient = useQueryClient();
  const { hidden: hiddenConnections, remove: removeServer } =
    useUndoableRemoval("servers");

  const removeConnection = async (connection: Connection) => {
    if (
      connectionStore.getState().active?.id === connection.id &&
      !(await confirmNavigation())
    ) {
      return;
    }
    removeServer(connection.id, {
      commit: async () => {
        const saved = await loadConnections();
        const next = saved.filter((item) => item.id !== connection.id);
        await saveConnections(next);
        if (connectionStore.getState().active?.id === connection.id) {
          // Ends a connect in progress. `useSelectServer` drops a result when
          // `connecting` is false.
          connectionActions.finishConnecting();
          await saveActiveConnectionId(null);
          connectionActions.clearActive();
          const { sessionID: removedSession } = locationStore.getState();
          locationActions.resetLocation();
          if (removedSession) {
            composerActions.clearHandoff(removedSession);
          }
          tabsActions.clearTabs(connection.id);
        }
        queryClient.removeQueries({ queryKey: [connection.id] });
        connectionActions.setConnections(next);
      },
      message: "Server removed",
    });
  };
  return { hiddenConnections, removeConnection };
};
