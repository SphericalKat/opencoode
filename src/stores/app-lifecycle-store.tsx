import { useEffect } from "react";
import type { ReactNode } from "react";
import { AppState } from "react-native";
import type { StoreApi } from "zustand/vanilla";

import { createStoreContext } from "./create-store-context";

export interface AppLifecycleState {
  // Global error banner shown by the shell frame.
  error: string | null;
  foreground: boolean;
}

const isForeground = (state: string | null | undefined) =>
  state !== "background" && state !== "inactive";

const createActions = (store: StoreApi<AppLifecycleState>) => ({
  clearError: () => store.setState({ error: null }),
  setError: (error: string | null) => store.setState({ error }),
  setForeground: (foreground: boolean) => store.setState({ foreground }),
});

const {
  Provider: BaseProvider,
  useActions: useAppLifecycleActions,
  useApi: useAppLifecycleStoreApi,
  useSelector: useAppLifecycleStore,
} = createStoreContext<AppLifecycleState, ReturnType<typeof createActions>>(
  "App lifecycle store",
  () => ({
    error: null,
    foreground: isForeground(AppState.currentState),
  }),
  createActions
);

// The only `AppState` listener in the app. Everything else reads `foreground`.
const ForegroundListener = () => {
  const { setForeground } = useAppLifecycleActions();
  useEffect(() => {
    setForeground(isForeground(AppState.currentState));
    const subscription = AppState.addEventListener("change", (state) =>
      setForeground(isForeground(state))
    );
    return () => subscription.remove();
  }, [setForeground]);
  return null;
};

export const AppLifecycleStoreProvider = ({
  children,
}: {
  children: ReactNode;
}) => (
  <BaseProvider>
    <ForegroundListener />
    {children}
  </BaseProvider>
);

export const useForeground = () =>
  useAppLifecycleStore((state) => state.foreground);

export {
  useAppLifecycleActions,
  useAppLifecycleStore,
  useAppLifecycleStoreApi,
};
