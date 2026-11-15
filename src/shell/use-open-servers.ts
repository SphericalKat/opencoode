import { useCallback } from "react";

import {
  emptyConnectionForm,
  useConnectionStoreApi,
} from "../stores/connection-store";
import { useSheetStoreApi } from "../stores/sheet-store";

// Opens the Servers sheet with an empty form. The sheet mounts the form on each open.
export const useOpenServers = () => {
  const connectionApi = useConnectionStoreApi();
  const sheetApi = useSheetStoreApi();
  return useCallback(() => {
    connectionApi.setState({
      connectionError: null,
      form: emptyConnectionForm(),
      pairingLink: null,
    });
    // Use the latest coordinator because queued tab actions retain stale navigation state.
    sheetApi.getState().showServerSheet();
  }, [connectionApi, sheetApi]);
};
