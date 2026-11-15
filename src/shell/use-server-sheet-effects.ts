import { useEffect, useRef } from "react";

import {
  useConnectionActions,
  useConnectionStoreApi,
} from "../stores/connection-store";
import { useSheetStoreApi } from "../stores/sheet-store";

type ShowNavigationSheet = (
  kind: "servers" | "projects",
  automatic?: boolean
) => Promise<void>;

// Opens the Servers sheet for two store events: a call to
// `requestServerSheet` and the start of connection recovery. Mount it once,
// in the shell root, so one listener serves both backends.
export const useServerSheetEffects = (
  showNavigationSheet: ShowNavigationSheet
) => {
  const connectionApi = useConnectionStoreApi();
  const { clearForm } = useConnectionActions();
  const sheetApi = useSheetStoreApi();
  const show = useRef(showNavigationSheet);
  useEffect(() => {
    show.current = showNavigationSheet;
  });

  useEffect(
    () =>
      sheetApi.subscribe((state, previous) => {
        if (state.serverSheetOpenRequest !== previous.serverSheetOpenRequest) {
          void show.current("servers");
        }
      }),
    [sheetApi]
  );

  useEffect(
    () =>
      connectionApi.subscribe((state, previous) => {
        if (!state.recovering || state.recovering === previous.recovering) {
          return;
        }
        if (!sheetApi.getState().serversOpen) {
          clearForm();
          void show.current("servers", true);
        }
      }),
    [clearForm, connectionApi, sheetApi]
  );
};
