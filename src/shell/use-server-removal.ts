import { useQueryClient } from "@tanstack/react-query";

import { useUndoableRemoval } from "../components/snackbar";
import type { Connection } from "../lib/client";
import {
  loadConnections,
  saveActiveConnectionId,
  saveConnections,
} from "../lib/storage";
import { useComposerStoreApi } from "../stores/composer-store";
import { useConnectionStoreApi } from "../stores/connection-store";
import { useSessionLocationStoreApi } from "../stores/session-location-store";
import type { ConfirmNavigation } from "./types";

export const useServerRemoval = (confirmNavigation: ConfirmNavigation) => {
  const connectionStore = useConnectionStoreApi();
  const locationStore = useSessionLocationStoreApi();
  const composerStore = useComposerStoreApi();
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
          connectionStore.setState((state) => ({ epoch: state.epoch + 1 }));
          await saveActiveConnectionId(null);
          connectionStore.setState({ active: null });
          const { sessionID: removedSession } = locationStore.getState();
          locationStore.setState({
            directory: "",
            pendingLocation: null,
            sessionID: null,
          });
          if (removedSession) {
            composerStore.setState((state) => ({
              handoffs: { ...state.handoffs, [removedSession]: undefined },
            }));
          }
        }
        queryClient.removeQueries({ queryKey: [connection.id] });
        connectionStore.setState({ connections: next });
      },
      message: "Server removed",
    });
  };
  return { hiddenConnections, removeConnection };
};
