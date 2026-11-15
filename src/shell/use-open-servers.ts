import { useCallback } from "react";

import { useConnectionActions } from "../stores/connection-store";
import { useSheetActions } from "../stores/sheet-store";

// Opens the Servers sheet with an empty form. The sheet mounts the form on each open.
export const useOpenServers = () => {
  const { resetForm } = useConnectionActions();
  const { requestServerSheet } = useSheetActions();
  return useCallback(() => {
    resetForm();
    requestServerSheet();
  }, [requestServerSheet, resetForm]);
};
