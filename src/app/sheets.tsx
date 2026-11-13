import type { Project } from "@opencode/client";
import type { ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BetaMoreSheet, BetaTabsSheet } from "../components/beta-navigation";
import type {
  OpenSessionTab,
  SessionPane,
} from "../components/beta-navigation";
import { MotionDrawer } from "../components/motion";
import { ProjectDirectoryBrowser } from "../components/project-directory-browser";
import { Sheet } from "../components/ui";
import type { Connection } from "../lib/client";
import { useThemedStyles } from "../lib/theme";
import { createStyles } from "./styles";
import type { ServerClient } from "./types";

interface NavigationDrawerProps {
  active: Connection | null;
  betaLayout: boolean;
  children: ReactNode;
  onClose: () => void;
  onDismiss: () => void;
  open: boolean;
  wide: boolean;
}

export const NavigationDrawer = ({
  active,
  betaLayout,
  children,
  onClose,
  onDismiss,
  open,
  wide,
}: NavigationDrawerProps) => {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  return (
    <MotionDrawer
      visible={open && !wide && !!active && !betaLayout}
      width={Math.min(width - 32, 352)}
      onClose={onClose}
      onDismiss={onDismiss}
      panelStyle={styles.drawer}
    >
      <SafeAreaView style={styles.full} edges={["top", "bottom", "left"]}>
        {children}
      </SafeAreaView>
    </MotionDrawer>
  );
};

interface BetaSheetsProps {
  active: Connection | null;
  betaLayout: boolean;
  currentTabID: string | undefined;
  moreOpen: boolean;
  navigationOpen: boolean;
  onCloseMore: () => void;
  onCloseNavigation: () => void;
  onCloseTab: (id: string) => void;
  onDetails: () => void;
  onDismissMore: () => void;
  onDismissNavigation: () => void;
  onHelp: () => void;
  onHome: () => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onServer: () => void;
  onSettings: () => void;
  onUsage: () => void;
  onView: (pane: SessionPane) => void;
  openTabs: OpenSessionTab[];
  selectedPane: SessionPane;
}

export const BetaSheets = ({
  active,
  betaLayout,
  currentTabID,
  moreOpen,
  navigationOpen,
  onCloseMore,
  onCloseNavigation,
  onCloseTab,
  onDetails,
  onDismissMore,
  onDismissNavigation,
  onHelp,
  onHome,
  onNew,
  onSelect,
  onServer,
  onSettings,
  onUsage,
  onView,
  openTabs,
  selectedPane,
}: BetaSheetsProps) => {
  if (!betaLayout) {
    return null;
  }
  return (
    <>
      {active && (
        <BetaTabsSheet
          visible={navigationOpen}
          tabs={openTabs}
          selectedID={currentTabID}
          serverLabel={active.name}
          onServer={onServer}
          onClose={onCloseNavigation}
          onDismiss={onDismissNavigation}
          onSelect={onSelect}
          onCloseTab={onCloseTab}
          onNew={onNew}
          onHome={onHome}
          onSettings={onSettings}
          onHelp={onHelp}
        />
      )}
      <BetaMoreSheet
        visible={moreOpen}
        pane={selectedPane}
        onClose={onCloseMore}
        onDismiss={onDismissMore}
        onView={onView}
        onUsage={onUsage}
        onDetails={onDetails}
      />
    </>
  );
};

interface ServersSheetProps {
  active: Connection | null;
  children: ReactNode;
  onClose: () => void;
  onDismiss: () => void;
  open: boolean;
  unavailableID: string | null;
}

export const ServersSheet = ({
  active,
  children,
  onClose,
  onDismiss,
  open,
  unavailableID,
}: ServersSheetProps) => (
  <Sheet
    visible={open && !!active}
    title={unavailableID === active?.id ? "Connection" : "Servers"}
    allowDuringRecovery
    onClose={onClose}
    onDismiss={onDismiss}
  >
    {open && active && children}
  </Sheet>
);

interface ProjectsSheetProps {
  active: Connection | null;
  busy: boolean;
  client: ServerClient | null;
  connectionRevision: number;
  directory: string;
  error: string | null;
  onChangeValue: (value: string) => void;
  onClose: () => void;
  onOpenDirectory: (value: string) => void;
  open: boolean;
  projects: Project[];
  value: string;
}

export const ProjectsSheet = ({
  active,
  busy,
  client,
  connectionRevision,
  directory,
  error,
  onChangeValue,
  onClose,
  onOpenDirectory,
  open,
  projects,
  value,
}: ProjectsSheetProps) => (
  <Sheet visible={open} title="Open a project" scroll={false} onClose={onClose}>
    {open && client && active && (
      <ProjectDirectoryBrowser
        key={`${active.id}:${connectionRevision}:${directory}`}
        client={client}
        directory={directory}
        value={value}
        projects={projects}
        busy={busy}
        error={error}
        onChangeValue={onChangeValue}
        onOpenDirectory={onOpenDirectory}
      />
    )}
  </Sheet>
);
