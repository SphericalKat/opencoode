import type { SessionInfo } from "@opencode/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useRef } from "react";

import type { SessionPane } from "../components/beta-navigation";
import { errorMessage } from "../lib/client";
import { sessionDetailOptions } from "../lib/queries/sessions";
import { queryKeys } from "../lib/query-keys";
import { routes, workspacePath } from "../lib/routes";
import type { WorkspaceSection } from "../lib/routes";
import { useAppLifecycleActions } from "../stores/app-lifecycle-store";
import { useComposerActions } from "../stores/composer-store";
import {
  useConnectionStore,
  useConnectionStoreApi,
} from "../stores/connection-store";
import {
  useSessionLocationActions,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import {
  selectOpenTabs,
  useSessionTabsActions,
  useSessionTabsStoreApi,
} from "../stores/session-tabs-store";
import { useSheetActions } from "../stores/sheet-store";
import { attempt } from "./connection-utils";
import {
  settingsTabHref,
  tabFromPathname,
  workspaceSectionFromParam,
} from "./route-state";
import type { ConfirmNavigation, ServerClient, Tab } from "./types";

export const useCurrentTab = (): Tab => tabFromPathname(usePathname());

export const useWorkspaceSection = () =>
  workspaceSectionFromParam(
    useGlobalSearchParams<{ section?: string }>().section
  );

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
  const { setError } = useAppLifecycleActions();
  const location = useSessionLocationStoreApi();
  const locationActions = useSessionLocationActions();
  const tabs = useSessionTabsStoreApi();
  const tabsActions = useSessionTabsActions();
  const router = useRouter();
  const currentTab = useCurrentTab();
  const currentSection = useWorkspaceSection();
  const settingsSection = useGlobalSearchParams<{ section?: string }>().section;
  const tabRef = useRef(currentTab);
  const settingsSectionRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    tabRef.current = currentTab;
    if (currentTab === "settings") {
      settingsSectionRef.current = settingsSection;
    }
    if (currentTab === "workspace") {
      locationActions.setWorkspaceSection(currentSection);
    }
  }, [currentSection, currentTab, locationActions, settingsSection]);
  const sheetActions = useSheetActions();
  const composerActions = useComposerActions();
  const clearHandoff = useCallback(
    (sessionID: string | null) => {
      if (sessionID) {
        composerActions.clearHandoff(sessionID);
      }
    },
    [composerActions]
  );
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

  const closeNavigationSheet = sheetActions.hideNavigation;
  // Starts a new navigation and aborts the previous one. A pending async
  // navigation stops when its signal is aborted.
  const selectionRef = useRef<AbortController | null>(null);
  const beginSelection = useCallback(() => {
    selectionRef.current?.abort();
    const controller = new AbortController();
    selectionRef.current = controller;
    return controller.signal;
  }, []);
  const currentSelection = useCallback(
    () => selectionRef.current?.signal ?? beginSelection(),
    [beginSelection]
  );

  const showBetaHome = useCallback(() => {
    beginSelection();
    locationActions.showHome();
    router.navigate(routes.sessions);
    closeNavigationSheet();
  }, [beginSelection, closeNavigationSheet, locationActions, router]);

  const changeDirectory = useCallback(
    (nextDirectory: string) => {
      if (connection.getState().active !== active) {
        return;
      }
      const navigation = beginSelection();
      void confirmNavigation().then((leave) => {
        if (
          !leave ||
          connection.getState().active !== active ||
          navigation.aborted
        ) {
          return null;
        }
        clearHandoff(location.getState().sessionID);
        locationActions.selectBetaHomeProject(nextDirectory);
        router.replace(routes.sessions);
        sheetActions.setNewDirectory(nextDirectory);
        sheetActions.hideProjects();
        return null;
      });
    },
    [
      active,
      beginSelection,
      clearHandoff,
      confirmNavigation,
      connection,
      location,
      locationActions,
      router,
      sheetActions,
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
    const navigation = currentSelection();
    const current = () =>
      connection.getState().active === active &&
      !navigation.aborted &&
      location.getState().sessionID === id;
    return (async () => {
      try {
        const selected = await fetchSession(id);
        if (!current()) {
          return null;
        }
        const next = selected.location.directory;
        if (next === location.getState().directory) {
          locationActions.clearPendingLocation();
          return next;
        }
        const leave = await confirmNavigation();
        if (!current()) {
          return null;
        }
        if (!leave) {
          locationActions.setPendingLocation({
            directory: next,
            sessionID: id,
          });
          return null;
        }
        clearHandoff(id);
        locationActions.setDirectory(next);
        sheetActions.setNewDirectory(next);
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
    clearHandoff,
    confirmNavigation,
    connection,
    currentSelection,
    fetchSession,
    location,
    locationActions,
    setError,
    sheetActions,
  ]);

  const openSession = useCallback(
    (id: string, keepNavigation = false): Promise<boolean> => {
      if (!client || connection.getState().active !== active) {
        return Promise.resolve(false);
      }
      const navigation = beginSelection();
      locationActions.setOpeningSession(id);
      const current = () =>
        connection.getState().active === active && !navigation.aborted;
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
            locationActions.setBetaHome(false);
            router.navigate(routes.sessions);
            closeNavigation();
            return true;
          }
          const selected = id ? await fetchSession(id) : null;
          if (!current() || !(await confirmNavigation()) || !current()) {
            return false;
          }
          clearHandoff(location.getState().sessionID);
          locationActions.setSelection({
            directory: selected?.location.directory,
            sessionID: id || null,
          });
          if (selected) {
            sheetActions.setNewDirectory(selected.location.directory);
          }
          router.navigate(routes.sessions);
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
            locationActions.setOpeningSession(null);
          }
        }
      );
    },
    [
      active,
      beginSelection,
      client,
      clearHandoff,
      closeNavigationSheet,
      confirmNavigation,
      connection,
      fetchSession,
      location,
      locationActions,
      recordSessionInfo,
      router,
      setError,
      sheetActions,
      syncSelectedLocation,
    ]
  );

  const createBetaSession = async (requestedTarget?: string) => {
    if (!client || location.getState().creatingSession) {
      return;
    }
    const target = requestedTarget ?? location.getState().directory;
    const owner = connection.getState().active;
    const navigation = beginSelection();
    locationActions.beginCreatingSession();
    const current = () =>
      owner === connection.getState().active && !navigation.aborted;
    await attempt(
      async () => {
        if (!(await confirmNavigation()) || !current()) {
          return;
        }
        const created = await createSession.mutateAsync(target);
        if (!current()) {
          return;
        }
        clearHandoff(location.getState().sessionID);
        locationActions.setSelection({
          directory: created.location.directory,
          sessionID: created.id,
        });
        router.navigate(routes.sessions);
        sheetActions.setNewDirectory(created.location.directory);
        recordSessionInfo(created);
      },
      (error_) => {
        if (current()) {
          setError(errorMessage(error_));
        }
      },
      () => {
        locationActions.setCreatingSession(false);
      }
    );
  };

  const closeBetaTab = async (id: string) => {
    if (location.getState().openingSession === id) {
      beginSelection();
      locationActions.setOpeningSession(null);
    }
    const serverID = active?.id;
    if (id === location.getState().sessionID) {
      const next = selectOpenTabs(serverID)(tabs.getState()).find(
        (item) => item.id !== id
      );
      if (next) {
        const wasHome = location.getState().betaHome;
        if (!(await openSession(next.id, true))) {
          return;
        }
        locationActions.setBetaHome(wasHome);
      } else {
        const owner = connection.getState().active;
        const navigation = beginSelection();
        if (!(await confirmNavigation())) {
          return;
        }
        if (owner !== connection.getState().active || navigation.aborted) {
          return;
        }
        clearHandoff(id);
        locationActions.clearSelection();
        router.navigate(routes.sessions);
      }
    }
    if (serverID) {
      tabsActions.closeTab(serverID, id);
    }
  };

  const afterBetaNavigation = (action: () => void) => {
    const owner = connection.getState().active;
    sheetActions.queueAfterNavigation(() => {
      if (owner === connection.getState().active) {
        action();
      }
    });
  };

  const navigateToTab = (next: Tab, section?: WorkspaceSection) => {
    if (next === "workspace") {
      const pane = section ?? location.getState().workspaceSection;
      if (tabRef.current === "workspace") {
        router.setParams({ section: pane });
        return;
      }
      router.navigate(workspacePath(pane));
      return;
    }
    if (next === "settings") {
      router.navigate(settingsTabHref(settingsSectionRef.current));
      return;
    }
    router.navigate(routes.sessions);
  };

  const changeTab = async (next: Tab, section?: WorkspaceSection) => {
    const navigation = beginSelection();
    locationActions.setOpeningSession(null);
    if (next === "sessions" || next === tabRef.current) {
      navigateToTab(next, section);
      closeNavigationSheet();
      if (next === "sessions" && location.getState().sessionID) {
        void syncSelectedLocation();
      }
      return;
    }
    const owner = active;
    if (location.getState().sessionID && !(await syncSelectedLocation())) {
      return;
    }
    if (connection.getState().active !== owner || navigation.aborted) {
      return;
    }
    navigateToTab(next, section);
    closeNavigationSheet();
  };

  const openBetaPane = (pane: SessionPane) => {
    if (pane === "Session") {
      void changeTab("sessions");
      return;
    }
    void changeTab("workspace", pane);
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
