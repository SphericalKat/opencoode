import { useGlobalSearchParams, useSegments } from "expo-router";

import { useSessionLocationStore } from "../stores/session-location-store";
import { useSessionTabsStore } from "../stores/session-tabs-store";
import { deriveShellView, parseShellRoute } from "./shell-view";
import type { ShellRoute, ShellView } from "./shell-view";

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
  const openTabs = useSessionTabsStore((state) => state.openTabs);
  return deriveShellView({
    betaHome,
    directory,
    openTabs,
    sessionID,
    tab,
    workspaceSection,
  });
};
