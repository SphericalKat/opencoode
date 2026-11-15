import type { SessionInfo } from "@opencode/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { BackHandler } from "react-native";

import type { SessionPane } from "../components/beta-navigation";
import { errorMessage } from "../lib/client";
import { sessionDetailOptions } from "../lib/queries/sessions";
import { queryKeys } from "../lib/query-keys";
import { useAppLifecycleStoreApi } from "../stores/app-lifecycle-store";
import { useChatUiStoreApi } from "../stores/chat-ui-store";
import { useComposerStoreApi } from "../stores/composer-store";
import {
  useConnectionStore,
  useConnectionStoreApi,
} from "../stores/connection-store";
import { useSessionLocationStoreApi } from "../stores/session-location-store";
import { useSessionTabsStoreApi } from "../stores/session-tabs-store";
import { useSheetStoreApi } from "../stores/sheet-store";
import { attempt } from "./connection-utils";
import type { ConfirmNavigation, ServerClient, Tab } from "./types";

interface UseSessionNavigationOptions {
  client: ServerClient | null;
  confirmNavigation: ConfirmNavigation;
  recordSessionInfo: (session: SessionInfo) => void;
}

export const useSessionNavigation = ({
  client,
  confirmNavigation,
  recordSessionInfo,
}: UseSessionNavigationOptions) => {
  const active = useConnectionStore((state) => state.active);
  const connection = useConnectionStoreApi();
  const lifecycle = useAppLifecycleStoreApi();
  const location = useSessionLocationStoreApi();
  const tabs = useSessionTabsStoreApi();
  const chatUi = useChatUiStoreApi();
  const sheets = useSheetStoreApi();
  const composer = useComposerStoreApi();
  const queryClient = useQueryClient();
  const scope = active?.id;
  const fetchSession = useCallback(
    (id: string) => {
      if (!client || !scope) {
        throw new Error("There is no active connection");
      }
      return queryClient.fetchQuery({
        ...sessionDetailOptions(scope, client.session, id),
        staleTime: 0,
      });
    },
    [client, queryClient, scope]
  );
  const createSession = useMutation({
    mutationFn: (directory: string) => {
      if (!client) {
        throw new Error("There is no active connection");
      }
      return client.session.create({ location: { directory } });
    },
    onSuccess: () => {
      if (scope) {
        return queryClient.invalidateQueries({
          queryKey: queryKeys.sessions.all(scope),
        });
      }
    },
  });

  const setError = useCallback(
    (error: string | null) => lifecycle.setState({ error }),
    [lifecycle]
  );
  const closeNavigationSheet = useCallback(
    () => sheets.setState({ navigationOpen: false }),
    [sheets]
  );
  // Starts a new navigation. Pending async navigations compare their
  // revision with the current one and stop when it differs.
  const beginSelection = useCallback(() => {
    const selectionRevision = location.getState().selectionRevision + 1;
    location.setState({ selectionRevision });
    return selectionRevision;
  }, [location]);
  const clearAttachmentHandoffs = useCallback(
    () => composer.setState({ handoffs: {} }),
    [composer]
  );

  const showBetaHome = useCallback(() => {
    beginSelection();
    location.setState({
      betaHome: true,
      openingSession: null,
      tab: "sessions",
    });
    closeNavigationSheet();
  }, [beginSelection, closeNavigationSheet, location]);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      const { backend } = connection.getState().active ?? {};
      if (backend === "pi") {
        return false;
      }
      const { betaHome, sessionID, settingsCanGoBack, tab } =
        location.getState();
      if (tab === "settings" && settingsCanGoBack) {
        return false;
      }
      if (
        chatUi.getState().messageSelected &&
        !betaHome &&
        tab === "sessions"
      ) {
        return false;
      }
      if (sessionID && tab === "sessions") {
        if (!betaHome) {
          showBetaHome();
          return true;
        }
        return false;
      }
      if (tab !== "sessions") {
        location.setState({ tab: "sessions" });
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [chatUi, connection, location, showBetaHome]);

  const changeDirectory = useCallback(
    (nextDirectory: string) => {
      if (connection.getState().active !== active) {
        return;
      }
      const request = connection.getState().epoch;
      const navigation = beginSelection();
      void confirmNavigation().then((leave) => {
        if (
          !leave ||
          connection.getState().active !== active ||
          request !== connection.getState().epoch ||
          navigation !== location.getState().selectionRevision
        ) {
          return null;
        }
        location.setState({
          betaHome: true,
          betaHomeProject: {
            directory: nextDirectory,
            revision: navigation,
          },
          directory: nextDirectory,
          pendingLocation: null,
          sessionID: null,
          tab: "sessions",
        });
        sheets.setState({ newDirectory: nextDirectory, projectsOpen: false });
        clearAttachmentHandoffs();
        return null;
      });
    },
    [
      active,
      beginSelection,
      clearAttachmentHandoffs,
      confirmNavigation,
      connection,
      location,
      sheets,
    ]
  );

  const syncSelectedLocation = useCallback((): Promise<string | null> => {
    if (!client || connection.getState().active !== active) {
      return Promise.resolve(null);
    }
    const id = location.getState().sessionID;
    if (!id) {
      return Promise.resolve(location.getState().directory);
    }
    const request = connection.getState().epoch;
    const navigation = location.getState().selectionRevision;
    const current = () =>
      connection.getState().active === active &&
      request === connection.getState().epoch &&
      navigation === location.getState().selectionRevision &&
      location.getState().sessionID === id;
    return (async () => {
      try {
        const selected = await fetchSession(id);
        if (!current()) {
          return null;
        }
        const next = selected.location.directory;
        if (next === location.getState().directory) {
          location.setState({ pendingLocation: null });
          return next;
        }
        const leave = await confirmNavigation();
        if (!current()) {
          return null;
        }
        if (!leave) {
          location.setState({
            pendingLocation: { directory: next, sessionID: id },
          });
          return null;
        }
        location.setState({ directory: next, pendingLocation: null });
        sheets.setState({ newDirectory: next });
        clearAttachmentHandoffs();
        return next;
      } catch (error_) {
        if (current()) {
          setError(errorMessage(error_));
        }
        return null;
      }
    })();
  }, [
    active,
    client,
    clearAttachmentHandoffs,
    confirmNavigation,
    connection,
    fetchSession,
    location,
    setError,
    sheets,
  ]);

  const openSession = useCallback(
    (id: string, keepNavigation = false): Promise<boolean> => {
      if (!client || connection.getState().active !== active) {
        return Promise.resolve(false);
      }
      const request = connection.getState().epoch;
      const navigation = beginSelection();
      location.setState({ openingSession: id });
      const current = () =>
        connection.getState().active === active &&
        request === connection.getState().epoch &&
        navigation === location.getState().selectionRevision;
      const closeNavigation = () => {
        if (!keepNavigation) {
          closeNavigationSheet();
        }
      };
      return attempt(
        async () => {
          if (id === location.getState().sessionID) {
            const next = await syncSelectedLocation();
            if (!next || !current() || location.getState().sessionID !== id) {
              return false;
            }
            location.setState({ betaHome: false, tab: "sessions" });
            closeNavigation();
            return true;
          }
          const selected = id ? await fetchSession(id) : null;
          if (!current() || !(await confirmNavigation()) || !current()) {
            return false;
          }
          if (selected) {
            location.setState({ directory: selected.location.directory });
            sheets.setState({ newDirectory: selected.location.directory });
          }
          location.setState({
            betaHome: !id,
            pendingLocation: null,
            sessionID: id || null,
            tab: "sessions",
          });
          clearAttachmentHandoffs();
          if (selected) {
            recordSessionInfo(selected);
          }
          closeNavigation();
          return true;
        },
        (error_) => {
          if (current()) {
            setError(errorMessage(error_));
          }
          return false;
        },
        () => {
          if (current()) {
            location.setState({ openingSession: null });
          }
        }
      );
    },
    [
      active,
      beginSelection,
      clearAttachmentHandoffs,
      client,
      closeNavigationSheet,
      confirmNavigation,
      connection,
      fetchSession,
      location,
      recordSessionInfo,
      setError,
      sheets,
      syncSelectedLocation,
    ]
  );

  const createBetaSession = async (requestedTarget?: string) => {
    if (!client || location.getState().creatingSession) {
      return;
    }
    const target = requestedTarget ?? location.getState().directory;
    const owner = connection.getState().active;
    const request = connection.getState().epoch;
    const navigation = beginSelection();
    location.setState({ creatingSession: true, openingSession: null });
    const current = () =>
      owner === connection.getState().active &&
      request === connection.getState().epoch &&
      navigation === location.getState().selectionRevision;
    await attempt(
      async () => {
        if (!(await confirmNavigation()) || !current()) {
          return;
        }
        const created = await createSession.mutateAsync(target);
        if (!current()) {
          return;
        }
        location.setState({
          betaHome: false,
          directory: created.location.directory,
          pendingLocation: null,
          sessionID: created.id,
          tab: "sessions",
        });
        sheets.setState({ newDirectory: created.location.directory });
        clearAttachmentHandoffs();
        recordSessionInfo(created);
      },
      (error_) => {
        if (current()) {
          setError(errorMessage(error_));
        }
      },
      () => {
        location.setState({ creatingSession: false });
      }
    );
  };

  const closeBetaTab = async (id: string) => {
    if (location.getState().openingSession === id) {
      beginSelection();
      location.setState({ openingSession: null });
    }
    if (id === location.getState().sessionID) {
      const next = tabs.getState().openTabs.find((item) => item.id !== id);
      if (next) {
        const wasHome = location.getState().betaHome;
        if (!(await openSession(next.id, true))) {
          return;
        }
        location.setState({ betaHome: wasHome });
      } else {
        const owner = connection.getState().active;
        const request = connection.getState().epoch;
        const navigation = beginSelection();
        if (!(await confirmNavigation())) {
          return;
        }
        if (
          owner !== connection.getState().active ||
          request !== connection.getState().epoch ||
          navigation !== location.getState().selectionRevision
        ) {
          return;
        }
        location.setState({
          betaHome: true,
          pendingLocation: null,
          sessionID: null,
          tab: "sessions",
        });
      }
    }
    tabs.setState((state) => ({
      openTabs: state.openTabs.filter((item) => item.id !== id),
    }));
  };

  const afterBetaNavigation = (action: () => void) => {
    const owner = connection.getState().active;
    const request = connection.getState().epoch;
    sheets.setState({
      navigationOpen: false,
      pendingAction: () => {
        if (
          owner === connection.getState().active &&
          request === connection.getState().epoch
        ) {
          action();
        }
      },
    });
  };

  const changeTab = async (next: Tab) => {
    const navigation = beginSelection();
    location.setState({ openingSession: null });
    if (next === "sessions" || next === location.getState().tab) {
      location.setState({ tab: next });
      closeNavigationSheet();
      if (next === "sessions" && location.getState().sessionID) {
        void syncSelectedLocation();
      }
      return;
    }
    const owner = active;
    const request = connection.getState().epoch;
    if (location.getState().sessionID && !(await syncSelectedLocation())) {
      return;
    }
    if (
      connection.getState().active !== owner ||
      request !== connection.getState().epoch ||
      navigation !== location.getState().selectionRevision
    ) {
      return;
    }
    location.setState((state) => ({
      tab: next,
      visited: { ...state.visited, [next]: true },
    }));
    closeNavigationSheet();
  };

  const openBetaPane = (pane: SessionPane) => {
    if (pane === "Session") {
      void changeTab("sessions");
      return;
    }
    location.setState({ workspaceSection: pane });
    void changeTab("workspace");
  };
  return {
    afterBetaNavigation,
    changeDirectory,
    changeTab,
    closeBetaTab,
    createBetaSession,
    openBetaPane,
    openSession,
    showBetaHome,
    syncSelectedLocation,
  };
};
