import { useCallback, useLayoutEffect } from "react";

import { isConnectionUnauthorized } from "../lib/client";
import type { Connection } from "../lib/client";
import type { SheetCoordinator } from "./types";
import type { MobileState } from "./use-app-state";

interface UseConnectionRecoveryDeps {
  resumeSheets: SheetCoordinator["resumeSheets"];
  showNavigationSheet: (
    kind: "servers" | "projects",
    automatic?: boolean
  ) => Promise<void>;
}

export const useConnectionRecovery = (
  model: MobileState,
  deps: UseConnectionRecoveryDeps
) => {
  const {
    activeRef,
    automaticServerRequestRef,
    connectingRef,
    pendingNavigationSheetRef,
    recoverConnectionRef,
    recoveringConnectionRef,
    serverSheetRequestRef,
    serversOpen,
    setConnectionError,
    setFlowRevision,
    setForm,
    setPairingLink,
    setUnavailableID,
    showServerSheetRef,
  } = model;
  const { resumeSheets, showNavigationSheet } = deps;
  const recoverActiveConnection = (connection: Connection, cause: unknown) => {
    if (
      activeRef.current !== connection ||
      connectingRef.current ||
      recoveringConnectionRef.current?.connection === connection
    ) {
      return;
    }
    const message = isConnectionUnauthorized(cause)
      ? `${connection.name} rejected the saved password. Pair again or update its saved connection.`
      : `${connection.name} is not responding. Retry it or connect to another server.`;
    recoveringConnectionRef.current = { connection, message };
    setUnavailableID(connection.id);
    setConnectionError(message);
    if (!serversOpen) {
      setForm({ id: "", name: "", token: "", url: "" });
      setPairingLink(null);
      setFlowRevision((value) => value + 1);
      void showNavigationSheet("servers", true);
    }
  };

  useLayoutEffect(() => {
    showServerSheetRef.current = () => {
      void showNavigationSheet("servers");
    };
    recoverConnectionRef.current = recoverActiveConnection;
  });

  const onProbeHealthy = useCallback(
    (owner: Connection) => {
      const recovery = recoveringConnectionRef.current;
      if (recovery?.connection !== owner) {
        return;
      }
      recoveringConnectionRef.current = null;
      const automaticRequest = automaticServerRequestRef.current;
      if (
        automaticRequest !== null &&
        automaticRequest === serverSheetRequestRef.current
      ) {
        automaticServerRequestRef.current = null;
        serverSheetRequestRef.current += 1;
        if (
          pendingNavigationSheetRef.current?.kind === "servers" &&
          pendingNavigationSheetRef.current.serverRequest === automaticRequest
        ) {
          pendingNavigationSheetRef.current = null;
        }
        resumeSheets();
      }
      setUnavailableID((value) => (value === owner.id ? null : value));
      setConnectionError((value) =>
        value === recovery.message ? null : value
      );
    },
    [
      resumeSheets,
      setConnectionError,
      serverSheetRequestRef,
      pendingNavigationSheetRef,
      automaticServerRequestRef,
      setUnavailableID,
      recoveringConnectionRef,
    ]
  );
  const onProbeFailure = useCallback(
    (owner: Connection, cause: unknown) => {
      recoverConnectionRef.current(owner, cause);
    },
    [recoverConnectionRef]
  );
  return {
    onProbeFailure,
    onProbeHealthy,
  };
};
