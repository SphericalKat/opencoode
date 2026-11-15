import { AppState } from "react-native";

import { createStoreContext } from "./create-store-context";

export interface AppLifecycleState {
  // Global error banner shown by the shell frame.
  error: string | null;
  foreground: boolean;
}

export const {
  Provider: AppLifecycleStoreProvider,
  useApi: useAppLifecycleStoreApi,
  useSelector: useAppLifecycleStore,
} = createStoreContext<AppLifecycleState>("App lifecycle store", () => ({
  error: null,
  foreground:
    AppState.currentState !== "background" &&
    AppState.currentState !== "inactive",
}));
