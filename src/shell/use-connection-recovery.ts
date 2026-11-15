import { useCallback, useLayoutEffect } from "react";

import { isConnectionUnauthorized } from "../lib/client";
import type { Connection } from "../lib/client";
import {
  emptyConnectionForm,
  useConnectionStoreApi,
} from "../stores/connection-store";
import { useSheetStoreApi } from "../stores/sheet-store";
import type { SheetCoordinator } from "./types";

interface UseConnectionRecoveryDeps {
  resumeSheets: SheetCoordinator["resumeSheets"];
  showNavigationSheet: (
    kind: "servers" | "projects",
    automatic?: boolean
  ) => Promise<void>;
}

export const useConnectionRecovery = ({
  resumeSheets,
  showNavigationSheet,
}: UseConnectionRecoveryDeps) => {
  const connectionApi = useConnectionStoreApi();
  const sheetApi = useSheetStoreApi();

  useLayoutEffect(() => {
    const recoverActiveConnection = (
      connection: Connection,
      cause: unknown
    ) => {
      const { active, connecting, recovering } = connectionApi.getState();
      if (
        active !== connection ||
        connecting ||
        recovering?.connection === connection
      ) {
        return;
      }
      const message = isConnectionUnauthorized(cause)
        ? `${connection.name} rejected the saved password. Pair again or update its saved connection.`
        : `${connection.name} is not responding. Retry it or connect to another server.`;
      connectionApi.setState({
        connectionError: message,
        recovering: { connection, message },
        unavailableID: connection.id,
      });
      if (!sheetApi.getState().serversOpen) {
        connectionApi.setState((state) => ({
          flowRevision: state.flowRevision + 1,
          form: emptyConnectionForm(),
          pairingLink: null,
        }));
        void showNavigationSheet("servers", true);
      }
    };
    connectionApi.setState({ recoverConnection: recoverActiveConnection });
  }, [connectionApi, sheetApi, showNavigationSheet]);

  const onProbeHealthy = useCallback(
    (owner: Connection) => {
      const { recovering } = connectionApi.getState();
      if (recovering?.connection !== owner) {
        return;
      }
      connectionApi.setState({ recovering: null });
      const { automaticServerRequest, serverSheetRequest } =
        sheetApi.getState();
      if (
        automaticServerRequest !== null &&
        automaticServerRequest === serverSheetRequest
      ) {
        const { pendingNavigationSheet } = sheetApi.getState();
        sheetApi.setState({
          automaticServerRequest: null,
          pendingNavigationSheet:
            pendingNavigationSheet?.kind === "servers" &&
            pendingNavigationSheet.serverRequest === automaticServerRequest
              ? null
              : pendingNavigationSheet,
          serverSheetRequest: serverSheetRequest + 1,
        });
        resumeSheets();
      }
      connectionApi.setState((state) => ({
        connectionError:
          state.connectionError === recovering.message
            ? null
            : state.connectionError,
        unavailableID:
          state.unavailableID === owner.id ? null : state.unavailableID,
      }));
    },
    [resumeSheets, connectionApi, sheetApi]
  );
  const onProbeFailure = useCallback(
    (owner: Connection, cause: unknown) => {
      connectionApi.getState().recoverConnection(owner, cause);
    },
    [connectionApi]
  );
  return {
    onProbeFailure,
    onProbeHealthy,
  };
};
