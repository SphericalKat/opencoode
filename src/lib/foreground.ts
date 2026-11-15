import { useSyncExternalStore } from "react";
import { AppState } from "react-native";

const isForeground = (state: string | null | undefined) =>
  state !== "background" && state !== "inactive";

const subscribe = (notify: () => void) => {
  const subscription = AppState.addEventListener("change", notify);
  return () => subscription.remove();
};

const snapshot = () => isForeground(AppState.currentState);

export const useForeground = () => useSyncExternalStore(subscribe, snapshot);
