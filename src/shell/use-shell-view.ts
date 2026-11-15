import { useGlobalSearchParams, useSegments } from "expo-router";

import { useConnectionStore } from "../stores/connection-store";
import { useSessionLocationStore } from "../stores/session-location-store";
import {
  selectOpenTabs,
  useSessionTabsStore,
} from "../stores/session-tabs-store";
import { deriveShellView, parseShellRoute } from "./shell-view";
import type { ShellRoute, ShellView } from "./shell-view";
import { useTitledTabs } from "./use-titled-tabs";

export const useShellRoute = (): ShellRoute => {
  const segments = useSegments();
  const { section } = useGlobalSearchParams<{ section?: string }>();
  return parseShellRoute(segments, typeof section === "string" ? section : "");
};

export const useShellView = (): ShellView => {
  const { tab, workspaceSection } = useShellRoute();
  const betaHome = useSessionLocationStore((state) => state.betaHome);
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const serverID = useConnectionStore((state) => state.active?.id);
  const storedTabs = useSessionTabsStore(selectOpenTabs(serverID));
  const openTabs = useTitledTabs(serverID, storedTabs);
  return deriveShellView({
    betaHome,
    directory,
    openTabs,
    sessionID,
    tab,
    workspaceSection,
  });
};
