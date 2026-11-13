import type { ReactNode } from "react";
import { View } from "react-native";

import {
  BetaSessionNavigation,
  BetaTabStrip,
  SessionSurface,
} from "../components/beta-navigation";
import type {
  OpenSessionTab,
  SessionPane,
} from "../components/beta-navigation";
import { ErrorNotice } from "../components/ui";
import { useThemedStyles } from "../lib/theme";
import { createStyles } from "./styles";
import type { Tab } from "./types";

interface StatusBannersProps {
  error: string | null;
  onRetryLocation: () => void;
  pendingLocation: { directory: string; sessionID: string } | null;
  sessionID: string | null;
}

const StatusBanners = ({
  error,
  onRetryLocation,
  pendingLocation,
  sessionID,
}: StatusBannersProps) => {
  const styles = useThemedStyles(createStyles);
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
  betaHome: boolean;
  betaLayout: boolean;
  children: ReactNode;
  creatingSession: boolean;
  currentOpenTab: OpenSessionTab | undefined;
  directory: string;
  error: string | null;
  navigation: ReactNode;
  onMore: () => void;
  onOpenNavigation: () => void;
  onProject: () => void;
  onRetryLocation: () => void;
  onSelectPane: (pane: SessionPane) => void;
  openTabCount: number;
  pendingLocation: { directory: string; sessionID: string } | null;
  selectedPane: SessionPane;
  sessionID: string | null;
  showMessageSelection: boolean;
  tab: Tab;
  wide: boolean;
}

export const ShellFrame = ({
  betaHome,
  betaLayout,
  children,
  creatingSession,
  currentOpenTab,
  directory,
  error,
  navigation,
  onMore,
  onOpenNavigation,
  onProject,
  onRetryLocation,
  onSelectPane,
  openTabCount,
  pendingLocation,
  selectedPane,
  sessionID,
  showMessageSelection,
  tab,
  wide,
}: ShellFrameProps) => {
  const styles = useThemedStyles(createStyles);
  const framed = betaLayout && tab !== "settings" && !showMessageSelection;
  const showSessionNavigation = framed && !betaHome && !!sessionID;
  return (
    <View style={styles.shell}>
      {wide && <View style={styles.sidebar}>{navigation}</View>}
      <View style={styles.main}>
        {framed && (
          <BetaTabStrip
            current={currentOpenTab}
            count={openTabCount}
            busy={creatingSession}
            onOpen={onOpenNavigation}
          />
        )}
        <StatusBanners
          error={error}
          onRetryLocation={onRetryLocation}
          pendingLocation={pendingLocation}
          sessionID={sessionID}
        />
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
  );
};
