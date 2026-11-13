import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { AppState, Linking } from "react-native";

import {
  clearPairingRetry,
  connect,
  connectionErrorMessage,
  errorMessage,
  normalizeConnection,
} from "../lib/client";
import type { Connection } from "../lib/client";
import {
  loadActiveConnectionId,
  loadConnections,
  loadWorkspace,
  saveActiveConnectionId,
  saveConnections,
  saveWorkspace,
} from "../lib/storage";
import {
  attempt,
  isSameServer,
  locateWorkspace,
  mergeMatchingConnection,
} from "./connection-utils";
import { noop } from "./constants";
import type { AppliedConnection, ConfirmNavigation } from "./types";
import type { MobileState } from "./use-app-state";

interface UseConnectionDeps {
  confirmNavigation: ConfirmNavigation;
}

export const useConnection = (model: MobileState, deps: UseConnectionDeps) => {
  const {
    active,
    activeRef,
    connectingRef,
    connections,
    directory,
    directoryRef,
    epochRef,
    recoveringConnectionRef,
    selectedSessionRef,
    sessionID,
    setActive,
    setAttachmentContext,
    setAttachmentPath,
    setBetaHome,
    setBetaHomeProject,
    setBooting,
    setConnecting,
    setConnectionError,
    setConnectionRevision,
    setConnections,
    setDirectory,
    setError,
    setFlowRevision,
    setForeground,
    setForm,
    setInfo,
    setNewDirectory,
    setOpenTabs,
    setPairingLink,
    setPendingLocation,
    setServersOpen,
    setSessionID,
    setTab,
    setUnavailableID,
    showServerSheetRef,
  } = model;
  const { confirmNavigation } = deps;
  const applyConnection = useCallback(
    (applied: AppliedConnection) => {
      const { connected, preserveWorkspace } = applied;
      clearPairingRetry();
      setConnections(applied.connections);
      setActive(connected);
      setUnavailableID(null);
      recoveringConnectionRef.current = null;
      if (!preserveWorkspace || connected.backend === "pi") {
        setConnectionRevision((value) => value + 1);
      }
      setInfo(applied.info);
      if (!preserveWorkspace) {
        setOpenTabs([]);
        setBetaHomeProject(undefined);
        setBetaHome(!applied.sessionID);
        setDirectory(applied.directory);
        directoryRef.current = applied.directory;
        setNewDirectory(applied.directory);
        setSessionID(applied.sessionID ?? null);
        selectedSessionRef.current = applied.sessionID ?? null;
        setPendingLocation(null);
        setAttachmentPath(undefined);
        setAttachmentContext(undefined);
        setTab("sessions");
      }
      setError(null);
      setServersOpen(false);
      setForm({ id: "", name: "", token: "", url: "" });
    },
    [
      setDirectory,
      setConnections,
      setActive,
      setError,
      selectedSessionRef,
      setNewDirectory,
      setSessionID,
      setInfo,
      setConnectionRevision,
      setServersOpen,
      setUnavailableID,
      recoveringConnectionRef,
      setPendingLocation,
      setOpenTabs,
      setBetaHome,
      setAttachmentContext,
      setAttachmentPath,
      setForm,
      directoryRef,
      setBetaHomeProject,
      setTab,
    ]
  );

  const selectServer = useCallback(
    async (
      connection: Connection,
      existing?: Connection[],
      alternatives?: Connection[],
      explicitName = false
    ) => {
      if (connectingRef.current) {
        return;
      }
      connectingRef.current = true;
      epochRef.current += 1;
      const request = epochRef.current;
      const isCurrent = () => request === epochRef.current;
      setConnecting(true);
      setConnectionError(null);
      await attempt(
        async () => {
          const result = await connect(connection, undefined, alternatives);
          const current = existing ?? connections;
          const connected = mergeMatchingConnection(
            result.connection,
            connection,
            current,
            explicitName
          );
          const sameServer = isSameServer(activeRef.current, connected);
          const workspace = sameServer
            ? {
                directory: directoryRef.current,
                sessionID: selectedSessionRef.current ?? undefined,
              }
            : await loadWorkspace(connected.id);
          const location = await locateWorkspace(result, connected, workspace);
          if (!isCurrent()) {
            return;
          }
          const preserveWorkspace =
            sameServer && location.directory === directoryRef.current;
          const restoredSessionID = preserveWorkspace
            ? (selectedSessionRef.current ?? undefined)
            : location.sessionID;
          if (!preserveWorkspace && !(await confirmNavigation())) {
            return;
          }
          if (!isCurrent()) {
            return;
          }
          const next = [
            ...current.filter((item) => item.id !== connected.id),
            connected,
          ];
          await saveConnections(next);
          await saveWorkspace(connected.id, {
            directory: location.directory,
            sessionID: restoredSessionID,
          });
          await saveActiveConnectionId(connected.id);
          if (!isCurrent()) {
            return;
          }
          applyConnection({
            connected,
            connections: next,
            directory: location.directory,
            info: result.backend === "opencode" ? result.info : null,
            preserveWorkspace,
            sessionID: restoredSessionID,
          });
        },
        (error_) => {
          if (!isCurrent()) {
            return;
          }
          setConnectionError(connectionErrorMessage(error_, connection));
          if (!activeRef.current || activeRef.current.id === connection.id) {
            setUnavailableID(connection.id);
          }
        },
        () => {
          connectingRef.current = false;
          if (isCurrent()) {
            setConnecting(false);
          }
        }
      );
    },
    [
      connections,
      confirmNavigation,
      applyConnection,
      setConnectionError,
      selectedSessionRef,
      setConnecting,
      setUnavailableID,
      connectingRef,
      activeRef,
      directoryRef,
      epochRef,
    ]
  );
  const selectServerRef = useRef(selectServer);
  useLayoutEffect(() => {
    selectServerRef.current = selectServer;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => subscription.remove();
  }, [setForeground]);

  useEffect(() => {
    if (!active || active.backend === "pi" || !directory) {
      return;
    }
    const timer = setTimeout(() => {
      saveWorkspace(active.id, {
        directory,
        sessionID: sessionID ?? undefined,
      }).catch((error_) => setError(errorMessage(error_)));
    }, 300);
    return () => clearTimeout(timer);
  }, [active, directory, sessionID, setError]);

  useEffect(() => {
    let live = true;
    Promise.all([loadConnections(), loadActiveConnectionId()])
      .then(async ([saved, id]) => {
        if (!live) {
          return null;
        }
        setConnections(saved);
        const last = saved.find((item) => item.id === id);
        if (last) {
          await selectServerRef.current(last, saved);
        }
        return null;
      })
      .catch((error_) => {
        if (live) {
          setError(errorMessage(error_));
        }
      })
      .finally(() => {
        if (live) {
          setBooting(false);
        }
      })
      .catch(noop);
    return () => {
      live = false;
      epochRef.current += 1;
    };
  }, [epochRef, setConnections, setError, setBooting]);

  useEffect(() => {
    const acceptLink = (url: string | null | undefined) => {
      if (!url) {
        return;
      }
      try {
        const parsed = new URL(url);
        if (
          parsed.protocol !== "opencoode:" &&
          !/\/auth\/connect\/[^/]+\/?$/u.test(parsed.pathname)
        ) {
          return;
        }
        const server =
          parsed.protocol === "opencoode:"
            ? parsed.searchParams.get("url")
            : url;
        if (!server) {
          return;
        }
        normalizeConnection({ name: "", url: server });
        setConnectionError(null);
        setForm({ id: "", name: "", token: "", url: server });
        setPairingLink(server);
        setFlowRevision((value) => value + 1);
        showServerSheetRef.current();
      } catch {
        setError("The connection link is invalid");
      }
    };
    Linking.getInitialURL().then(acceptLink).catch(noop);
    const subscription = Linking.addEventListener("url", (event) =>
      acceptLink(event.url)
    );
    return () => subscription.remove();
  }, [
    setError,
    setPairingLink,
    setConnectionError,
    setForm,
    showServerSheetRef,
    setFlowRevision,
  ]);
  return {
    selectServer,
  };
};
