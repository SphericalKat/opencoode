import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { errorMessage } from "../lib/client";
import { locationOptions } from "../lib/queries/sessions";
import { queryKeys } from "../lib/query-keys";
import { routes } from "../lib/routes";
import { useAppLifecycleActions } from "../stores/app-lifecycle-store";
import { useComposerActions } from "../stores/composer-store";
import { useConnectionStoreApi } from "../stores/connection-store";
import {
  useSessionLocationActions,
  useSessionLocationStoreApi,
} from "../stores/session-location-store";
import { useSheetActions, useSheetStoreApi } from "../stores/sheet-store";
import { attempt } from "./connection-utils";
import type { ServerClient } from "./types";

interface UseWorkspaceActionsDeps {
  changeDirectory: (directory: string) => void;
  client: ServerClient | null;
  syncSelectedLocation: () => Promise<string | null>;
}

export const useWorkspaceActions = ({
  changeDirectory,
  client,
  syncSelectedLocation,
}: UseWorkspaceActionsDeps) => {
  const connectionStore = useConnectionStoreApi();
  const locationStore = useSessionLocationStoreApi();
  const locationActions = useSessionLocationActions();
  const { setError } = useAppLifecycleActions();
  const sheetStore = useSheetStoreApi();
  const sheetActions = useSheetActions();
  const composerActions = useComposerActions();
  const queryClient = useQueryClient();
  const router = useRouter();
  const getConnection = () => connectionStore.getState();
  const createSession = useMutation({
    mutationFn: (target: string) => {
      if (!client) {
        throw new Error("There is no active connection");
      }
      return client.session.create({ location: { directory: target } });
    },
    onSuccess: () => {
      const { active } = getConnection();
      if (active) {
        return queryClient.invalidateQueries({
          queryKey: queryKeys.sessions.all(active.id),
        });
      }
    },
  });
  const openDirectory = async (nextDirectory?: string) => {
    if (!client) {
      return;
    }
    const target = (nextDirectory ?? sheetStore.getState().newDirectory).trim();
    if (
      !target.startsWith("/") &&
      !/^[A-Za-z]:[\\/]/u.test(target) &&
      !target.startsWith("\\\\")
    ) {
      sheetActions.setProjectError("Enter an absolute directory on the server");
      return;
    }
    const owner = getConnection().active;
    const isCurrent = () => getConnection().active === owner;
    sheetActions.beginProjectsLoad();
    await attempt(
      async () => {
        if (!owner) {
          return;
        }
        const location = await queryClient.fetchQuery({
          ...locationOptions(owner.id, client, target),
          staleTime: 0,
        });
        if (!isCurrent()) {
          return;
        }
        changeDirectory(location.directory);
      },
      (error_) => {
        if (isCurrent()) {
          sheetActions.setProjectError(errorMessage(error_));
        }
      },
      () => {
        if (isCurrent()) {
          sheetActions.finishProjectsLoad();
        }
      }
    );
  };

  const attachFile = async (
    path: string,
    contextText?: string
  ): Promise<boolean> => {
    if (!client) {
      return false;
    }
    const owner = getConnection().active;
    const { directory, sessionID: startSessionID } = locationStore.getState();
    const isCurrent = () =>
      getConnection().active === owner &&
      locationStore.getState().directory === directory &&
      locationStore.getState().sessionID === startSessionID;
    try {
      if (locationStore.getState().sessionID) {
        const nextDirectory = await syncSelectedLocation();
        if (!nextDirectory) {
          return false;
        }
        if (nextDirectory !== directory) {
          if (isCurrent()) {
            setError(
              "The session moved to another directory. Choose the file again in its current workspace."
            );
          }
          return false;
        }
      }
      let selected = locationStore.getState().sessionID;
      if (!selected) {
        const created = await createSession.mutateAsync(directory);
        selected = created.id;
      }
      if (!isCurrent()) {
        return false;
      }
      composerActions.setHandoff(selected, { context: contextText, path });
      locationActions.setSelection({ sessionID: selected });
      router.navigate(routes.sessions);
      return true;
    } catch (error_) {
      if (isCurrent()) {
        setError(errorMessage(error_));
      }
      return false;
    }
  };
  return {
    attachFile,
    openDirectory,
  };
};
