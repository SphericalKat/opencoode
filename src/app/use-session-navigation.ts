import type { SessionInfo } from "@opencode/client";
import { useCallback, useEffect } from "react";
import { BackHandler } from "react-native";

import type { SessionPane } from "../components/beta-navigation";
import { errorMessage } from "../lib/client";
import { attempt } from "./connection-utils";
import type { ConfirmNavigation, ServerClient, Tab } from "./types";
import type { MobileState } from "./use-app-state";

interface UseSessionNavigationDeps {
  betaLayout: boolean;
  client: ServerClient | null;
  confirmNavigation: ConfirmNavigation;
  recordSessionInfo: (session: SessionInfo) => void;
}

export const useSessionNavigation = (
  model: MobileState,
  deps: UseSessionNavigationDeps
) => {
  const {
    active,
    activeRef,
    betaHome,
    creatingSessionRef,
    directoryRef,
    epochRef,
    locationSyncRef,
    messageSelected,
    openingSessionRef,
    openTabs,
    pendingBetaActionRef,
    selectedSessionRef,
    selectionRef,
    sessionID,
    setAttachmentContext,
    setAttachmentPath,
    setBetaHome,
    setBetaHomeProject,
    setCreatingSession,
    setDirectory,
    setError,
    setNavigationOpen,
    setNewDirectory,
    setOpenTabs,
    setPendingLocation,
    setProjectsOpen,
    setRevision,
    setSessionID,
    setTab,
    settingsCanGoBackRef,
    setVisited,
    setWorkspaceSection,
    tab,
  } = model;
  const { betaLayout, client, confirmNavigation, recordSessionInfo } = deps;
  const showBetaHome = useCallback(() => {
    selectionRef.current += 1;
    openingSessionRef.current = null;
    setTab("sessions");
    setBetaHome(true);
    setNavigationOpen(false);
  }, [selectionRef, openingSessionRef, setTab, setBetaHome, setNavigationOpen]);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (active?.backend === "pi") {
        return false;
      }
      if (tab === "settings" && settingsCanGoBackRef.current) {
        return false;
      }
      if (betaLayout && messageSelected && !betaHome && tab === "sessions") {
        return false;
      }
      if (sessionID && tab === "sessions") {
        if (betaLayout && !betaHome) {
          showBetaHome();
          return true;
        }
        if (betaLayout) {
          return false;
        }
        const request = epochRef.current;
        selectionRef.current += 1;
        const navigation = selectionRef.current;
        void confirmNavigation().then((leave) => {
          if (
            leave &&
            activeRef.current === active &&
            request === epochRef.current &&
            navigation === selectionRef.current
          ) {
            selectedSessionRef.current = null;
            setSessionID(null);
            setPendingLocation(null);
          }
          return null;
        });
        return true;
      }
      if (tab !== "sessions") {
        setTab("sessions");
        return true;
      }
      return false;
    });
    return () => back.remove();
  }, [
    active,
    sessionID,
    tab,
    confirmNavigation,
    betaLayout,
    betaHome,
    messageSelected,
    showBetaHome,
    activeRef,
    setPendingLocation,
    setSessionID,
    selectedSessionRef,
    epochRef,
    settingsCanGoBackRef,
    selectionRef,
    setTab,
  ]);

  const changeDirectory = useCallback(
    (nextDirectory: string) => {
      if (activeRef.current !== active) {
        return;
      }
      const request = epochRef.current;
      selectionRef.current += 1;
      const navigation = selectionRef.current;
      void confirmNavigation().then((leave) => {
        if (
          !leave ||
          activeRef.current !== active ||
          request !== epochRef.current ||
          navigation !== selectionRef.current
        ) {
          return null;
        }
        directoryRef.current = nextDirectory;
        selectedSessionRef.current = null;
        setBetaHome(true);
        if (betaLayout) {
          setTab("sessions");
          setBetaHomeProject({
            directory: nextDirectory,
            revision: navigation,
          });
        }
        setDirectory(nextDirectory);
        setNewDirectory(nextDirectory);
        setSessionID(null);
        setAttachmentPath(undefined);
        setAttachmentContext(undefined);
        setProjectsOpen(false);
        setPendingLocation(null);
        return null;
      });
    },
    [
      active,
      confirmNavigation,
      betaLayout,
      setBetaHomeProject,
      setAttachmentContext,
      setProjectsOpen,
      activeRef,
      setPendingLocation,
      setNewDirectory,
      setSessionID,
      directoryRef,
      selectedSessionRef,
      setBetaHome,
      epochRef,
      setDirectory,
      selectionRef,
      setTab,
      setAttachmentPath,
    ]
  );

  const syncSelectedLocation = useCallback((): Promise<string | null> => {
    if (!client || activeRef.current !== active) {
      return Promise.resolve(null);
    }
    const id = selectedSessionRef.current;
    if (!id) {
      return Promise.resolve(directoryRef.current);
    }
    const request = epochRef.current;
    const navigation = selectionRef.current;
    const key = `${request}:${navigation}:${id}`;
    if (locationSyncRef.current?.key === key) {
      return locationSyncRef.current.promise;
    }
    const current = () =>
      activeRef.current === active &&
      request === epochRef.current &&
      navigation === selectionRef.current &&
      selectedSessionRef.current === id;
    const promise = (async () => {
      try {
        const selected = await client.session.get(
          { sessionID: id },
          { signal: AbortSignal.timeout(15_000) }
        );
        if (!current()) {
          return null;
        }
        const next = selected.location.directory;
        if (next === directoryRef.current) {
          setPendingLocation(null);
          return next;
        }
        const leave = await confirmNavigation();
        if (!current()) {
          return null;
        }
        if (!leave) {
          setPendingLocation({ directory: next, sessionID: id });
          return null;
        }
        directoryRef.current = next;
        setDirectory(next);
        setNewDirectory(next);
        setAttachmentPath(undefined);
        setAttachmentContext(undefined);
        setPendingLocation(null);
        return next;
      } catch (error_) {
        if (current()) {
          setError(errorMessage(error_));
        }
        return null;
      }
    })();
    locationSyncRef.current = { key, promise };
    void promise.finally(() => {
      if (locationSyncRef.current?.promise === promise) {
        locationSyncRef.current = null;
      }
    });
    return promise;
  }, [
    active,
    client,
    confirmNavigation,
    setError,
    activeRef,
    setPendingLocation,
    setNewDirectory,
    locationSyncRef,
    selectedSessionRef,
    selectionRef,
    directoryRef,
    epochRef,
    setAttachmentPath,
    setDirectory,
    setAttachmentContext,
  ]);

  const openSession = useCallback(
    (id: string, keepNavigation = false): Promise<boolean> => {
      if (!client || activeRef.current !== active) {
        return Promise.resolve(false);
      }
      const request = epochRef.current;
      selectionRef.current += 1;
      const navigation = selectionRef.current;
      openingSessionRef.current = id;
      const current = () =>
        activeRef.current === active &&
        request === epochRef.current &&
        navigation === selectionRef.current;
      const closeNavigation = () => {
        if (!keepNavigation) {
          setNavigationOpen(false);
        }
      };
      return attempt(
        async () => {
          if (id === selectedSessionRef.current) {
            const next = await syncSelectedLocation();
            if (!next || !current() || selectedSessionRef.current !== id) {
              return false;
            }
            setTab("sessions");
            setBetaHome(false);
            closeNavigation();
            return true;
          }
          const selected = id
            ? await client.session.get(
                { sessionID: id },
                { signal: AbortSignal.timeout(15_000) }
              )
            : null;
          if (!current() || !(await confirmNavigation()) || !current()) {
            return false;
          }
          if (selected) {
            directoryRef.current = selected.location.directory;
            setDirectory(selected.location.directory);
            setNewDirectory(selected.location.directory);
          }
          selectedSessionRef.current = id || null;
          setSessionID(id || null);
          setTab("sessions");
          setBetaHome(!id);
          setAttachmentPath(undefined);
          setAttachmentContext(undefined);
          setPendingLocation(null);
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
            openingSessionRef.current = null;
          }
        }
      );
    },
    [
      active,
      client,
      confirmNavigation,
      syncSelectedLocation,
      recordSessionInfo,
      setError,
      activeRef,
      setPendingLocation,
      setNewDirectory,
      setSessionID,
      selectedSessionRef,
      selectionRef,
      setNavigationOpen,
      openingSessionRef,
      setBetaHome,
      epochRef,
      directoryRef,
      setTab,
      setDirectory,
      setAttachmentPath,
      setAttachmentContext,
    ]
  );

  const createBetaSession = async (requestedTarget?: string) => {
    if (!client || creatingSessionRef.current) {
      return;
    }
    const target = requestedTarget ?? directoryRef.current;
    const owner = activeRef.current;
    const request = epochRef.current;
    selectionRef.current += 1;
    const navigation = selectionRef.current;
    openingSessionRef.current = null;
    const current = () =>
      owner === activeRef.current &&
      request === epochRef.current &&
      navigation === selectionRef.current;
    creatingSessionRef.current = true;
    setCreatingSession(true);
    await attempt(
      async () => {
        if (!(await confirmNavigation()) || !current()) {
          return;
        }
        const created = await client.session.create({
          location: { directory: target },
        });
        if (!current()) {
          return;
        }
        selectedSessionRef.current = created.id;
        directoryRef.current = created.location.directory;
        setSessionID(created.id);
        setDirectory(created.location.directory);
        setNewDirectory(created.location.directory);
        setAttachmentPath(undefined);
        setAttachmentContext(undefined);
        setPendingLocation(null);
        recordSessionInfo(created);
        setTab("sessions");
        setBetaHome(false);
        setRevision((value) => value + 1);
      },
      (error_) => {
        if (current()) {
          setError(errorMessage(error_));
        }
      },
      () => {
        creatingSessionRef.current = false;
        setCreatingSession(false);
      }
    );
  };

  const closeBetaTab = async (id: string) => {
    if (openingSessionRef.current === id) {
      selectionRef.current += 1;
      openingSessionRef.current = null;
    }
    if (id === selectedSessionRef.current) {
      const next = openTabs.find((item) => item.id !== id);
      if (next) {
        const wasHome = betaHome;
        if (!(await openSession(next.id, true))) {
          return;
        }
        setBetaHome(wasHome);
      } else {
        const owner = activeRef.current;
        const request = epochRef.current;
        selectionRef.current += 1;
        const navigation = selectionRef.current;
        if (!(await confirmNavigation())) {
          return;
        }
        if (
          owner !== activeRef.current ||
          request !== epochRef.current ||
          navigation !== selectionRef.current
        ) {
          return;
        }
        selectedSessionRef.current = null;
        setSessionID(null);
        setPendingLocation(null);
        setBetaHome(true);
        setTab("sessions");
      }
    }
    setOpenTabs((current) => current.filter((item) => item.id !== id));
  };

  const afterBetaNavigation = (action: () => void) => {
    const owner = activeRef.current;
    const request = epochRef.current;
    pendingBetaActionRef.current = () => {
      if (owner === activeRef.current && request === epochRef.current) {
        action();
      }
    };
    setNavigationOpen(false);
  };

  const changeTab = async (next: Tab) => {
    if (betaLayout) {
      selectionRef.current += 1;
      openingSessionRef.current = null;
    }
    if (next === "sessions" || next === tab) {
      setTab(next);
      setNavigationOpen(false);
      if (next === "sessions" && selectedSessionRef.current) {
        void syncSelectedLocation();
      }
      return;
    }
    const owner = active;
    const request = epochRef.current;
    const navigation = selectionRef.current;
    if (selectedSessionRef.current && !(await syncSelectedLocation())) {
      return;
    }
    if (
      activeRef.current !== owner ||
      request !== epochRef.current ||
      navigation !== selectionRef.current
    ) {
      return;
    }
    setVisited((current) => ({ ...current, [next]: true }));
    setTab(next);
    setNavigationOpen(false);
  };

  const openBetaPane = (pane: SessionPane) => {
    if (pane === "Session") {
      void changeTab("sessions");
      return;
    }
    setWorkspaceSection(pane);
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
