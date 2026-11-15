import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { noop } from "../lib/async";
import {
  clearPairingRetry,
  connect,
  connectionErrorMessage,
  errorMessage,
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
import { useAppLifecycleActions } from "../stores/app-lifecycle-store";
import { useComposerActions } from "../stores/composer-store";
import {
  useConnectionActions,
  useConnectionStore,
  useConnectionStoreApi,
} from "../stores/connection-store";
import {
  useSessionLocationActions,
  useSessionLocationStore,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import { useSessionTabsActions } from "../stores/session-tabs-store";
import { useSheetActions } from "../stores/sheet-store";
import {
  attempt,
  isSameServer,
  locateWorkspace,
  mergeMatchingConnection,
} from "./connection-utils";
import type { AppliedConnection, ConfirmNavigation } from "./types";

interface UseConnectionDeps {
  confirmNavigation: ConfirmNavigation;
}

export const useSelectServer = ({ confirmNavigation }: UseConnectionDeps) => {
  const connectionApi = useConnectionStoreApi();
  const connectionActions = useConnectionActions();
  const lifecycleActions = useAppLifecycleActions();
  const locationApi = useSessionLocationStoreApi();
  const locationActions = useSessionLocationActions();
  const tabsActions = useSessionTabsActions();
  const sheetActions = useSheetActions();
  const composerActions = useComposerActions();
  const queryClient = useQueryClient();

  const applyConnection = useCallback(
    (applied: AppliedConnection) => {
      const { connected, preserveWorkspace } = applied;
      clearPairingRetry();
      const refresh = !preserveWorkspace || connected.backend === "pi";
      const previous = connectionApi.getState().active;
      connectionActions.activate(connected, applied.connections);
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
        tabsActions.clearTabs(connected.id);
        const previousSession = locationApi.getState().sessionID;
        if (previousSession) {
          composerActions.clearHandoff(previousSession);
        }
        locationActions.restoreWorkspace(
          applied.directory,
          applied.sessionID ?? null
        );
        sheetActions.setNewDirectory(applied.directory);
      }
      lifecycleActions.clearError();
      sheetActions.hideServers();
    },
    [
      queryClient,
      connectionApi,
      connectionActions,
      lifecycleActions,
      locationApi,
      locationActions,
      tabsActions,
      sheetActions,
      composerActions,
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
      connectionActions.beginConnecting();
      const isCurrent = () => connectionApi.getState().connecting;
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
          connectionActions.setConnectionError(
            connectionErrorMessage(error_, connection)
          );
          const { active: current } = connectionApi.getState();
          if (!current || current.id === connection.id) {
            connectionActions.markUnavailable(connection.id);
          }
        },
        () => {
          if (isCurrent()) {
            connectionActions.finishConnecting();
          }
        }
      );
    },
    [
      confirmNavigation,
      applyConnection,
      connectionActions,
      connectionApi,
      locationApi,
    ]
  );
  return { selectServer };
};

export const useConnection = ({ confirmNavigation }: UseConnectionDeps) => {
  const connectionActions = useConnectionActions();
  const { setError } = useAppLifecycleActions();
  const active = useConnectionStore((state) => state.active);
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const { selectServer } = useSelectServer({ confirmNavigation });
  const selectServerRef = useRef(selectServer);
  useLayoutEffect(() => {
    selectServerRef.current = selectServer;
  });

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
        connectionActions.setConnections(saved);
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
          connectionActions.finishBoot();
        }
      })
      .catch(noop);
    return () => {
      live = false;
    };
  }, [connectionActions, setError]);
};
