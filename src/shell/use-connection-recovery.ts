import { useCallback } from "react";

import type { Connection } from "../lib/client";
import { useConnectionActions } from "../stores/connection-store";
import { useSheetActions } from "../stores/sheet-store";
import type { SheetCoordinator } from "./types";

interface UseConnectionRecoveryDeps {
  resumeSheets: SheetCoordinator["resumeSheets"];
}

export const useConnectionRecovery = ({
  resumeSheets,
}: UseConnectionRecoveryDeps) => {
  const connectionActions = useConnectionActions();
  const sheetActions = useSheetActions();

  const onProbeHealthy = useCallback(
    (owner: Connection) => {
      if (!connectionActions.clearRecovery(owner)) {
        return;
      }
      if (sheetActions.cancelAutomaticServerRequest()) {
        resumeSheets();
      }
    },
    [resumeSheets, connectionActions, sheetActions]
  );
  return {
    onProbeFailure: connectionActions.markRecovering,
    onProbeHealthy,
  };
};
