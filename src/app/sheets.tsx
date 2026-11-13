import type { Project } from "@opencode/client";
import type { ReactNode } from "react";

import { BetaMoreSheet, BetaTabsSheet } from "../components/beta-navigation";
import type {
  OpenSessionTab,
  SessionPane,
} from "../components/beta-navigation";
import { ProjectDirectoryBrowser } from "../components/project-directory-browser";
import { Sheet } from "../components/ui";
import type { Connection } from "../lib/client";
import { useSheetVisibility } from "../lib/sheet-visibility";
import type { ServerClient } from "./types";

interface BetaSheetsProps {
  active: Connection | null;
  currentTabID: string | undefined;
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
  currentTabID,
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
  const navigationOpen = useSheetVisibility((state) => state.navigationOpen);
  const moreOpen = useSheetVisibility((state) => state.moreOpen);
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
