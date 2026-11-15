import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
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
import { routes } from "../lib/routes";
import {
  loadActiveConnectionId,
  loadConnections,
  loadWorkspace,
  saveActiveConnectionId,
  saveConnections,
  saveWorkspace,
} from "../lib/storage";
import { useAppLifecycleStoreApi } from "../stores/app-lifecycle-store";
import { useComposerStoreApi } from "../stores/composer-store";
import {
  emptyConnectionForm,
  useConnectionStore,
  useConnectionStoreApi,
} from "../stores/connection-store";
import {
  useSessionLocationStore,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import { useSessionTabsStoreApi } from "../stores/session-tabs-store";
import { useSheetStoreApi } from "../stores/sheet-store";
import {
  attempt,
  isSameServer,
  locateWorkspace,
  mergeMatchingConnection,
} from "./connection-utils";
import { noop } from "./constants";
import type { AppliedConnection, ConfirmNavigation } from "./types";

interface UseConnectionDeps {
  confirmNavigation: ConfirmNavigation;
}

export const useSelectServer = ({ confirmNavigation }: UseConnectionDeps) => {
  const connectionApi = useConnectionStoreApi();
  const lifecycleApi = useAppLifecycleStoreApi();
  const locationApi = useSessionLocationStoreApi();
  const tabsApi = useSessionTabsStoreApi();
  const sheetApi = useSheetStoreApi();
  const composerApi = useComposerStoreApi();
  const queryClient = useQueryClient();
  const setConnectionError = useCallback(
    (connectionError: string | null) =>
      connectionApi.setState({ connectionError }),
    [connectionApi]
  );

  const applyConnection = useCallback(
    (applied: AppliedConnection) => {
      const { connected, preserveWorkspace } = applied;
      clearPairingRetry();
      const refresh = !preserveWorkspace || connected.backend === "pi";
      const previous = connectionApi.getState().active;
      connectionApi.setState({
        active: connected,
        connections: applied.connections,
        form: emptyConnectionForm(),
        recovering: null,
        unavailableID: null,
      });
      if (refresh) {
        void queryClient.invalidateQueries({ queryKey: [connected.id] });
      }
      // A change of backend flips the `Stack.Protected` guards, which move the
      // router to the new shell. Only a change inside one shell needs a replace.
      if (refresh && previous?.backend === connected.backend) {
        router.replace(
          connected.backend === "pi" ? routes.piChat : routes.sessions
        );
      }
      if (!preserveWorkspace) {
        tabsApi.setState({ openTabs: [] });
        locationApi.setState({
          betaHome: !applied.sessionID,
          betaHomeProject: undefined,
          directory: applied.directory,
          pendingLocation: null,
          sessionID: applied.sessionID ?? null,
        });
        sheetApi.setState({ newDirectory: applied.directory });
        composerApi.setState({ handoffs: {} });
      }
      lifecycleApi.setState({ error: null });
      sheetApi.setState({ serversOpen: false });
    },
    [
      queryClient,
      connectionApi,
      lifecycleApi,
      locationApi,
      tabsApi,
      sheetApi,
      composerApi,
    ]
  );

  const selectServer = useCallback(
    async (
      connection: Connection,
      existing?: Connection[],
      alternatives?: Connection[],
      explicitName = false
    ) => {
      if (connectionApi.getState().connecting) {
        return;
      }
      connectionApi.setState((state) => ({
        connecting: true,
        connectionError: null,
        epoch: state.epoch + 1,
      }));
      const request = connectionApi.getState().epoch;
      const isCurrent = () => request === connectionApi.getState().epoch;
      await attempt(
        async () => {
          const result = await connect(connection, undefined, alternatives);
          const current = existing ?? connectionApi.getState().connections;
          const connected = mergeMatchingConnection(
            result.connection,
            connection,
            current,
            explicitName
          );
          const sameServer = isSameServer(
            connectionApi.getState().active,
            connected
          );
          const workspace = sameServer
            ? {
                directory: locationApi.getState().directory,
                sessionID: locationApi.getState().sessionID ?? undefined,
              }
            : await loadWorkspace(connected.id);
          const location = await locateWorkspace(result, connected, workspace);
          if (!isCurrent()) {
            return;
          }
          const preserveWorkspace =
            sameServer &&
            location.directory === locationApi.getState().directory;
          const restoredSessionID = preserveWorkspace
            ? (locationApi.getState().sessionID ?? undefined)
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
            preserveWorkspace,
            sessionID: restoredSessionID,
          });
        },
        (error_) => {
          if (!isCurrent()) {
            return;
          }
          setConnectionError(connectionErrorMessage(error_, connection));
          const { active: current } = connectionApi.getState();
          if (!current || current.id === connection.id) {
            connectionApi.setState({ unavailableID: connection.id });
          }
        },
        () => {
          if (isCurrent()) {
            connectionApi.setState({ connecting: false });
          }
        }
      );
    },
    [
      confirmNavigation,
      applyConnection,
      setConnectionError,
      connectionApi,
      locationApi,
    ]
  );
  return { selectServer };
};

export const useConnection = ({ confirmNavigation }: UseConnectionDeps) => {
  const connectionApi = useConnectionStoreApi();
  const lifecycleApi = useAppLifecycleStoreApi();
  const sheetApi = useSheetStoreApi();
  const active = useConnectionStore((state) => state.active);
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const { selectServer } = useSelectServer({ confirmNavigation });
  const setError = useCallback(
    (error: string | null) => lifecycleApi.setState({ error }),
    [lifecycleApi]
  );
  const setConnectionError = useCallback(
    (connectionError: string | null) =>
      connectionApi.setState({ connectionError }),
    [connectionApi]
  );
  const selectServerRef = useRef(selectServer);
  useLayoutEffect(() => {
    selectServerRef.current = selectServer;
  });

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      lifecycleApi.setState({ foreground: state === "active" })
    );
    return () => subscription.remove();
  }, [lifecycleApi]);

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
        connectionApi.setState({ connections: saved });
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
          connectionApi.setState({ booting: false });
        }
      })
      .catch(noop);
    return () => {
      live = false;
      connectionApi.setState((state) => ({ epoch: state.epoch + 1 }));
    };
  }, [connectionApi, setError]);

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
        connectionApi.setState({
          form: { ...emptyConnectionForm(), url: server },
          pairingLink: server,
        });
        sheetApi.getState().showServerSheet();
      } catch {
        setError("The connection link is invalid");
      }
    };
    Linking.getInitialURL().then(acceptLink).catch(noop);
    const subscription = Linking.addEventListener("url", (event) =>
      acceptLink(event.url)
    );
    return () => subscription.remove();
  }, [connectionApi, sheetApi, setConnectionError, setError]);
};
