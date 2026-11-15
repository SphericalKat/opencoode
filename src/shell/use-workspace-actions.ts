import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useUndoableRemoval } from "../components/snackbar";
import { errorMessage } from "../lib/client";
import type { Connection } from "../lib/client";
import { locationOptions } from "../lib/queries/sessions";
import { queryKeys } from "../lib/query-keys";
import {
  loadConnections,
  saveActiveConnectionId,
  saveConnections,
} from "../lib/storage";
import { useAppLifecycleStoreApi } from "../stores/app-lifecycle-store";
import { useComposerStoreApi } from "../stores/composer-store";
import { useConnectionStoreApi } from "../stores/connection-store";
import { useSessionLocationStoreApi } from "../stores/session-location-store";
import { useSheetStoreApi } from "../stores/sheet-store";
import { attempt } from "./connection-utils";
import type { ConfirmNavigation, ServerClient } from "./types";

interface UseWorkspaceActionsDeps {
  changeDirectory: (directory: string) => void;
  client: ServerClient | null;
  confirmNavigation: ConfirmNavigation;
  syncSelectedLocation: () => Promise<string | null>;
}

export const useWorkspaceActions = ({
  changeDirectory,
  client,
  confirmNavigation,
  syncSelectedLocation,
}: UseWorkspaceActionsDeps) => {
  const connectionStore = useConnectionStoreApi();
  const locationStore = useSessionLocationStoreApi();
  const lifecycleStore = useAppLifecycleStoreApi();
  const sheetStore = useSheetStoreApi();
  const composerStore = useComposerStoreApi();
  const { hidden: hiddenConnections, remove: removeServer } =
    useUndoableRemoval("servers");
  const queryClient = useQueryClient();
  const getConnection = () => connectionStore.getState();
  const setError = (error: string | null) => lifecycleStore.setState({ error });
  const createSession = useMutation({
    mutationFn: (target: string) => {
      if (!client) {
        throw new Error("There is no active connection");
      }
      return client.session.create({ location: { directory: target } });
    },
    onSuccess: () => {
      const { active } = getConnection();
      if (active) {
        return queryClient.invalidateQueries({
          queryKey: queryKeys.sessions.all(active.id),
        });
      }
    },
  });
  const openDirectory = async (nextDirectory?: string) => {
    if (!client) {
      return;
    }
    const target = (nextDirectory ?? sheetStore.getState().newDirectory).trim();
    if (
      !target.startsWith("/") &&
      !/^[A-Za-z]:[\\/]/u.test(target) &&
      !target.startsWith("\\\\")
    ) {
      sheetStore.setState({
        projectError: "Enter an absolute directory on the server",
      });
      return;
    }
    const owner = getConnection().active;
    const request = getConnection().epoch;
    const isCurrent = () =>
      getConnection().active === owner && request === getConnection().epoch;
    sheetStore.setState({ projectBusy: true, projectError: null });
    await attempt(
      async () => {
        if (!owner) {
          return;
        }
        const location = await queryClient.fetchQuery({
          ...locationOptions(owner.id, client, target),
          staleTime: 0,
        });
        if (!isCurrent()) {
          return;
        }
        changeDirectory(location.directory);
      },
      (error_) => {
        if (isCurrent()) {
          sheetStore.setState({ projectError: errorMessage(error_) });
        }
      },
      () => {
        if (isCurrent()) {
          sheetStore.setState({ projectBusy: false });
        }
      }
    );
  };

  const removeConnection = async (connection: Connection) => {
    if (
      getConnection().active?.id === connection.id &&
      !(await confirmNavigation())
    ) {
      return;
    }
    removeServer(connection.id, {
      commit: async () => {
        const saved = await loadConnections();
        const next = saved.filter((item) => item.id !== connection.id);
        await saveConnections(next);
        if (getConnection().active?.id === connection.id) {
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

  const attachFile = async (
    path: string,
    contextText?: string
  ): Promise<boolean> => {
    if (!client) {
      return false;
    }
    const owner = getConnection().active;
    const request = getConnection().epoch;
    const navigation = locationStore.getState().selectionRevision;
    const { directory } = locationStore.getState();
    const isCurrent = () =>
      getConnection().active === owner &&
      getConnection().epoch === request &&
      locationStore.getState().selectionRevision === navigation;
    try {
      if (locationStore.getState().sessionID) {
        const nextDirectory = await syncSelectedLocation();
        if (!nextDirectory) {
          return false;
        }
        if (nextDirectory !== directory) {
          if (isCurrent()) {
            setError(
              "The session moved to another directory. Choose the file again in its current workspace."
            );
          }
          return false;
        }
      }
      let selected = locationStore.getState().sessionID;
      if (!selected) {
        const created = await createSession.mutateAsync(directory);
        selected = created.id;
      }
      if (!isCurrent()) {
        return false;
      }
      composerStore.setState((state) => ({
        handoffs: {
          ...state.handoffs,
          [selected]: { context: contextText, path },
        },
      }));
      locationStore.setState({
        betaHome: false,
        sessionID: selected,
        tab: "sessions",
      });
      return true;
    } catch (error_) {
      if (isCurrent()) {
        setError(errorMessage(error_));
      }
      return false;
    }
  };
  return {
    attachFile,
    hiddenConnections,
    openDirectory,
    removeConnection,
  };
};
