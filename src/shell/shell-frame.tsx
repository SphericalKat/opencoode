import type { ReactNode } from "react";
import { View } from "react-native";

import {
  BetaSessionNavigation,
  BetaTabStrip,
  SessionSurface,
} from "../components/beta-navigation";
import type {
  SessionPane,
  SessionTabItem,
} from "../components/beta-navigation";
import { ErrorNotice } from "../components/ui";
import {
  SelectionBarOverlay,
  SelectionBarProvider,
} from "../lib/selection-bar";
import { useThemedStyles } from "../lib/theme";
import { useAppLifecycleStore } from "../stores/app-lifecycle-store";
import { useSessionLocationStore } from "../stores/session-location-store";
import { createStyles } from "./styles";
import { useShellRoute } from "./use-shell-view";

interface StatusBannersProps {
  onRetryLocation: () => void;
}

const StatusBanners = ({ onRetryLocation }: StatusBannersProps) => {
  const styles = useThemedStyles(createStyles);
  const error = useAppLifecycleStore((state) => state.error);
  const pendingLocation = useSessionLocationStore(
    (state) => state.pendingLocation
  );
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  return (
    <>
      {error && (
        <View style={styles.banner}>
          <ErrorNotice error={error} />
        </View>
      )}
      {pendingLocation?.sessionID === sessionID && (
        <View style={styles.banner}>
          <ErrorNotice
            error={`This session uses ${pendingLocation.directory}. Update the workspace before you attach files or open its terminal.`}
            onRetry={onRetryLocation}
          />
        </View>
      )}
    </>
  );
};

interface ShellFrameProps {
  children: ReactNode;
  currentOpenTab: SessionTabItem | undefined;
  onMore: () => void;
  onOpenNavigation: () => void;
  onProject: () => void;
  onRetryLocation: () => void;
  onSelectPane: (pane: SessionPane) => void;
  selectedPane: SessionPane;
}

export const ShellFrame = ({
  children,
  currentOpenTab,
  onMore,
  onOpenNavigation,
  onProject,
  onRetryLocation,
  onSelectPane,
  selectedPane,
}: ShellFrameProps) => {
  const betaHome = useSessionLocationStore((state) => state.betaHome);
  const creatingSession = useSessionLocationStore(
    (state) => state.creatingSession
  );
  const directory = useSessionLocationStore((state) => state.directory);
  const sessionID = useSessionLocationStore((state) => state.sessionID);
  const styles = useThemedStyles(createStyles);
  const { framed } = useShellRoute();
  const showSessionNavigation = framed && !betaHome && !!sessionID;
  return (
    <SelectionBarProvider>
      <View style={styles.shell}>
        <View style={styles.main}>
          {framed && (
            <View>
              <BetaTabStrip
                current={currentOpenTab}
                busy={creatingSession}
                onOpen={onOpenNavigation}
              />
              <SelectionBarOverlay />
            </View>
          )}
          <StatusBanners onRetryLocation={onRetryLocation} />
          <SessionSurface style={styles.body} framed={framed}>
            {showSessionNavigation && (
              <BetaSessionNavigation
                pane={selectedPane}
                directory={directory}
                onSelect={onSelectPane}
                onMore={onMore}
                onProject={onProject}
              />
            )}
            {children}
          </SessionSurface>
        </View>
      </View>
    </SelectionBarProvider>
  );
};
