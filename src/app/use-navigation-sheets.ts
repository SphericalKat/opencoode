import { Keyboard } from "react-native";

import { errorMessage } from "../lib/client";
import { attempt } from "./connection-utils";
import type { ServerClient, SheetCoordinator } from "./types";
import type { MobileState } from "./use-app-state";

interface UseNavigationSheetsDeps {
  client: ServerClient | null;
  resumeSheets: SheetCoordinator["resumeSheets"];
  suspendSheets: SheetCoordinator["suspendSheets"];
}

export const useNavigationSheets = (
  model: MobileState,
  deps: UseNavigationSheetsDeps
) => {
  const {
    activeRef,
    automaticServerRequestRef,
    epochRef,
    navigationOpen,
    navigationPresentedRef,
    pendingBetaActionRef,
    pendingNavigationSheetRef,
    serverSheetRequestRef,
    setNavigationOpen,
    setProjectBusy,
    setProjectError,
    setProjects,
    setProjectsOpen,
    setServersOpen,
  } = model;
  const { client, resumeSheets, suspendSheets } = deps;
  const showNavigationSheet = async (
    kind: "servers" | "projects",
    automatic = false
  ) => {
    let serverRequest: number | undefined;
    if (kind === "servers") {
      if (!automatic) {
        automaticServerRequestRef.current = null;
      }
      if (!activeRef.current) {
        serverSheetRequestRef.current += 1;
        resumeSheets();
        return;
      }
      serverSheetRequestRef.current += 1;
      const request = serverSheetRequestRef.current;
      serverRequest = request;
      if (automatic) {
        automaticServerRequestRef.current = request;
      }
      const owner = activeRef.current;
      const connectionEpoch = epochRef.current;
      await suspendSheets();
      if (request !== serverSheetRequestRef.current) {
        return;
      }
      if (owner !== activeRef.current || connectionEpoch !== epochRef.current) {
        automaticServerRequestRef.current = null;
        resumeSheets();
        return;
      }
    }
    if (navigationOpen || navigationPresentedRef.current) {
      pendingNavigationSheetRef.current = {
        epoch: epochRef.current,
        kind,
        serverRequest,
      };
      setNavigationOpen(false);
      return;
    }
    pendingNavigationSheetRef.current = null;
    if (kind === "servers") {
      automaticServerRequestRef.current = null;
      setServersOpen(true);
    } else {
      setProjectsOpen(true);
    }
  };

  const openProjects = async () => {
    if (!client) {
      return;
    }
    showNavigationSheet("projects");
    setProjectBusy(true);
    setProjectError(null);
    const owner = activeRef.current;
    const isOwner = () => activeRef.current === owner;
    await attempt(
      async () => {
        const result = await client.project.list();
        if (isOwner()) {
          setProjects(result);
        }
      },
      (error_) => {
        if (isOwner()) {
          setProjectError(errorMessage(error_));
        }
      },
      () => {
        if (isOwner()) {
          setProjectBusy(false);
        }
      }
    );
  };

  const openNavigation = () => {
    Keyboard.dismiss();
    if (pendingNavigationSheetRef.current?.kind === "servers") {
      serverSheetRequestRef.current += 1;
      automaticServerRequestRef.current = null;
      resumeSheets();
    }
    pendingNavigationSheetRef.current = null;
    navigationPresentedRef.current = true;
    setNavigationOpen(true);
  };

  const onNavigationDismissed = () => {
    navigationPresentedRef.current = false;
    const pending = pendingNavigationSheetRef.current;
    pendingNavigationSheetRef.current = null;
    const betaAction = pendingBetaActionRef.current;
    pendingBetaActionRef.current = null;
    if (!pending && betaAction) {
      betaAction();
      return;
    }
    if (
      !pending ||
      pending.epoch !== epochRef.current ||
      !activeRef.current ||
      (pending.kind === "servers" &&
        pending.serverRequest !== serverSheetRequestRef.current)
    ) {
      if (pending?.kind === "servers") {
        resumeSheets();
      }
      return;
    }
    if (pending.kind === "servers") {
      automaticServerRequestRef.current = null;
      setServersOpen(true);
    } else {
      setProjectsOpen(true);
    }
  };
  return {
    onNavigationDismissed,
    openNavigation,
    openProjects,
    showNavigationSheet,
  };
};
