import { useQueryClient } from "@tanstack/react-query";
import { Keyboard } from "react-native";

import { errorMessage } from "../lib/client";
import { projectsOptions } from "../lib/queries/sessions";
import { useConnectionStoreApi } from "../stores/connection-store";
import { useSheetActions, useSheetStoreApi } from "../stores/sheet-store";
import { attempt } from "./connection-utils";
import type { ServerClient, SheetCoordinator } from "./types";

interface UseNavigationSheetsDeps {
  client: ServerClient | null;
  resumeSheets: SheetCoordinator["resumeSheets"];
  suspendSheets: SheetCoordinator["suspendSheets"];
}

export const useNavigationSheets = ({
  client,
  resumeSheets,
  suspendSheets,
}: UseNavigationSheetsDeps) => {
  const connectionStore = useConnectionStoreApi();
  const sheetStore = useSheetStoreApi();
  const sheetActions = useSheetActions();
  const queryClient = useQueryClient();
  const getActive = () => connectionStore.getState().active;

  const showSheet = (kind: "servers" | "projects") => {
    if (kind === "servers") {
      sheetActions.showServers();
    } else {
      sheetActions.showProjects();
    }
  };

  const showNavigationSheet = async (
    kind: "servers" | "projects",
    automatic = false
  ) => {
    let serverRequest: number | undefined;
    if (kind === "servers") {
      if (!automatic) {
        sheetActions.clearAutomaticServerRequest();
      }
      if (!getActive()) {
        sheetActions.invalidateServerRequest();
        resumeSheets();
        return;
      }
      const request = sheetActions.beginServerRequest(automatic);
      serverRequest = request;
      const owner = getActive();
      await suspendSheets();
      if (request !== sheetStore.getState().serverSheetRequest) {
        return;
      }
      if (owner !== getActive()) {
        sheetActions.clearAutomaticServerRequest();
        resumeSheets();
        return;
      }
    }
    const { navigationOpen, navigationPresented } = sheetStore.getState();
    if (navigationOpen || navigationPresented) {
      sheetActions.deferNavigationSheet({
        kind,
        serverID: getActive()?.id ?? null,
        serverRequest,
      });
      return;
    }
    sheetActions.clearPendingNavigationSheet();
    showSheet(kind);
  };

  const openProjects = async () => {
    if (!client) {
      return;
    }
    showNavigationSheet("projects");
    sheetActions.beginProjectsLoad();
    const owner = getActive();
    const isOwner = () => getActive() === owner;
    await attempt(
      async () => {
        const result = await queryClient.fetchQuery({
          ...projectsOptions(owner?.id ?? "", client),
          staleTime: 0,
        });
        if (isOwner()) {
          sheetActions.setProjects(result);
        }
      },
      (error_) => {
        if (isOwner()) {
          sheetActions.setProjectError(errorMessage(error_));
        }
      },
      () => {
        if (isOwner()) {
          sheetActions.finishProjectsLoad();
        }
      }
    );
  };

  const openNavigation = () => {
    Keyboard.dismiss();
    if (sheetStore.getState().pendingNavigationSheet?.kind === "servers") {
      sheetActions.invalidateServerRequest();
      resumeSheets();
    }
    sheetActions.presentNavigation();
  };

  const onNavigationDismissed = () => {
    const { pendingAction, pendingNavigationSheet: pending } =
      sheetActions.finishNavigationDismissal();
    if (!pending && pendingAction) {
      pendingAction();
      return;
    }
    const active = getActive();
    if (
      !pending ||
      !active ||
      pending.serverID !== active.id ||
      (pending.kind === "servers" &&
        pending.serverRequest !== sheetStore.getState().serverSheetRequest)
    ) {
      if (pending?.kind === "servers") {
        resumeSheets();
      }
      return;
    }
    showSheet(pending.kind);
  };

  return {
    onNavigationDismissed,
    openNavigation,
    openProjects,
    showNavigationSheet,
  };
};
