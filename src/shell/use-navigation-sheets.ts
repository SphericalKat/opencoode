import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect } from "react";
import { Keyboard } from "react-native";

import { errorMessage } from "../lib/client";
import { projectsOptions } from "../lib/queries/sessions";
import { useConnectionStoreApi } from "../stores/connection-store";
import { useSheetStoreApi } from "../stores/sheet-store";
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
  const queryClient = useQueryClient();
  const getActive = () => connectionStore.getState().active;
  const getEpoch = () => connectionStore.getState().epoch;
  const getSheets = () => sheetStore.getState();

  const showNavigationSheet = async (
    kind: "servers" | "projects",
    automatic = false
  ) => {
    let serverRequest: number | undefined;
    if (kind === "servers") {
      if (!automatic) {
        sheetStore.setState({ automaticServerRequest: null });
      }
      if (!getActive()) {
        sheetStore.setState({
          serverSheetRequest: getSheets().serverSheetRequest + 1,
        });
        resumeSheets();
        return;
      }
      const request = getSheets().serverSheetRequest + 1;
      serverRequest = request;
      sheetStore.setState({ serverSheetRequest: request });
      if (automatic) {
        sheetStore.setState({ automaticServerRequest: request });
      }
      const owner = getActive();
      const connectionEpoch = getEpoch();
      await suspendSheets();
      if (request !== getSheets().serverSheetRequest) {
        return;
      }
      if (owner !== getActive() || connectionEpoch !== getEpoch()) {
        sheetStore.setState({ automaticServerRequest: null });
        resumeSheets();
        return;
      }
    }
    if (getSheets().navigationOpen || getSheets().navigationPresented) {
      sheetStore.setState({
        navigationOpen: false,
        pendingNavigationSheet: { epoch: getEpoch(), kind, serverRequest },
      });
      return;
    }
    sheetStore.setState({ pendingNavigationSheet: null });
    if (kind === "servers") {
      sheetStore.setState({ automaticServerRequest: null, serversOpen: true });
    } else {
      sheetStore.setState({ projectsOpen: true });
    }
  };

  const openProjects = async () => {
    if (!client) {
      return;
    }
    showNavigationSheet("projects");
    sheetStore.setState({ projectBusy: true, projectError: null });
    const owner = getActive();
    const isOwner = () => getActive() === owner;
    await attempt(
      async () => {
        const result = await queryClient.fetchQuery({
          ...projectsOptions(owner?.id ?? "", client),
          staleTime: 0,
        });
        if (isOwner()) {
          sheetStore.setState({ projects: result });
        }
      },
      (error_) => {
        if (isOwner()) {
          sheetStore.setState({ projectError: errorMessage(error_) });
        }
      },
      () => {
        if (isOwner()) {
          sheetStore.setState({ projectBusy: false });
        }
      }
    );
  };

  const openNavigation = () => {
    Keyboard.dismiss();
    if (getSheets().pendingNavigationSheet?.kind === "servers") {
      sheetStore.setState({
        automaticServerRequest: null,
        serverSheetRequest: getSheets().serverSheetRequest + 1,
      });
      resumeSheets();
    }
    sheetStore.setState({
      navigationOpen: true,
      navigationPresented: true,
      pendingNavigationSheet: null,
    });
  };

  const onNavigationDismissed = () => {
    const { pendingAction, pendingNavigationSheet: pending } = getSheets();
    sheetStore.setState({
      navigationPresented: false,
      pendingAction: null,
      pendingNavigationSheet: null,
    });
    if (!pending && pendingAction) {
      pendingAction();
      return;
    }
    if (
      !pending ||
      pending.epoch !== getEpoch() ||
      !getActive() ||
      (pending.kind === "servers" &&
        pending.serverRequest !== getSheets().serverSheetRequest)
    ) {
      if (pending?.kind === "servers") {
        resumeSheets();
      }
      return;
    }
    if (pending.kind === "servers") {
      sheetStore.setState({ automaticServerRequest: null, serversOpen: true });
    } else {
      sheetStore.setState({ projectsOpen: true });
    }
  };

  // Queued actions call the latest sheet function through the store.
  useLayoutEffect(() => {
    sheetStore.setState({
      showServerSheet: () => {
        void showNavigationSheet("servers");
      },
    });
  });

  return {
    onNavigationDismissed,
    openNavigation,
    openProjects,
    showNavigationSheet,
  };
};
