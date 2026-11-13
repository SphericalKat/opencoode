import type { Project, ServerInfo } from "@opencode/client";
import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { OpenSessionTab } from "../components/beta-navigation";
import type { ConnectionForm } from "../components/connection-flow";
import type { Connection } from "../lib/client";
import type { WorkspaceSection } from "../screens/workspace-screen";
import { isAppForeground } from "./connection-utils";
import { noop } from "./constants";
import type { SessionPanelRequest, Tab } from "./types";

export const useAppState = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [active, setActive] = useState<Connection | null>(null);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [connectionRevision, setConnectionRevision] = useState(0);
  const [booting, setBooting] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [unavailableID, setUnavailableID] = useState<string | null>(null);
  const [foreground, setForeground] = useState(isAppForeground);
  const [error, setError] = useState<string | null>(null);
  const [directory, setDirectory] = useState("");
  const [sessionID, setSessionID] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("sessions");
  const [betaHome, setBetaHome] = useState(true);
  const [betaHomeProject, setBetaHomeProject] = useState<{
    directory: string;
    revision: number;
  }>();
  const [openTabs, setOpenTabs] = useState<OpenSessionTab[]>([]);
  const [workspaceSection, setWorkspaceSection] =
    useState<WorkspaceSection>("Changes");
  const [betaMoreOpen, setBetaMoreOpen] = useState(false);
  const [messageSelected, setMessageSelected] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const creatingSessionRef = useRef(false);
  const [sessionPanelRequest, setSessionPanelRequest] =
    useState<SessionPanelRequest>();
  const panelRequestIDRef = useRef(0);
  const pendingBetaActionRef = useRef<(() => void) | null>(null);
  const [visited, setVisited] = useState<Partial<Record<Tab, boolean>>>({
    sessions: true,
  });
  const [serversOpen, setServersOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectBusy, setProjectBusy] = useState(false);
  const [newDirectory, setNewDirectory] = useState("");
  const [revision, setRevision] = useState(0);
  const [attachmentPath, setAttachmentPath] = useState<string>();
  const [attachmentContext, setAttachmentContext] = useState<string>();
  const [pendingLocation, setPendingLocation] = useState<{
    sessionID: string;
    directory: string;
  } | null>(null);
  const [form, setForm] = useState<ConnectionForm>({
    id: "",
    name: "",
    token: "",
    url: "",
  });
  const [pairingLink, setPairingLink] = useState<string | null>(null);
  const [flowRevision, setFlowRevision] = useState(0);
  const epochRef = useRef(0);
  const pendingNavigationSheetRef = useRef<{
    kind: "servers" | "projects";
    epoch: number;
    serverRequest?: number;
  } | null>(null);
  const navigationPresentedRef = useRef(false);
  const serverSheetRequestRef = useRef(0);
  const automaticServerRequestRef = useRef<number | null>(null);
  const showServerSheetRef = useRef<() => void>(noop);
  const recoveringConnectionRef = useRef<{
    connection: Connection;
    message: string;
  } | null>(null);
  const recoverConnectionRef =
    useRef<(connection: Connection, cause: unknown) => void>(noop);
  const connectingRef = useRef(false);
  const selectionRef = useRef(0);
  const selectedSessionRef = useRef(sessionID);
  const openingSessionRef = useRef<string | null>(null);
  const settingsCanGoBackRef = useRef(false);
  const setSettingsBackState = useCallback((canGoBack: boolean) => {
    settingsCanGoBackRef.current = canGoBack;
  }, []);
  const directoryRef = useRef(directory);
  const locationSyncRef = useRef<{
    key: string;
    promise: Promise<string | null>;
  } | null>(null);
  const activeRef = useRef<Connection | null>(null);
  useLayoutEffect(() => {
    selectedSessionRef.current = sessionID;
    directoryRef.current = directory;
    activeRef.current = active;
  });
  return {
    active,
    activeRef,
    attachmentContext,
    attachmentPath,
    automaticServerRequestRef,
    betaHome,
    betaHomeProject,
    betaMoreOpen,
    booting,
    connecting,
    connectingRef,
    connectionError,
    connectionRevision,
    connections,
    creatingSession,
    creatingSessionRef,
    directory,
    directoryRef,
    epochRef,
    error,
    flowRevision,
    foreground,
    form,
    info,
    locationSyncRef,
    messageSelected,
    navigationOpen,
    navigationPresentedRef,
    newDirectory,
    openTabs,
    openingSessionRef,
    pairingLink,
    panelRequestIDRef,
    pendingBetaActionRef,
    pendingLocation,
    pendingNavigationSheetRef,
    projectBusy,
    projectError,
    projects,
    projectsOpen,
    recoverConnectionRef,
    recoveringConnectionRef,
    revision,
    selectedSessionRef,
    selectionRef,
    serverSheetRequestRef,
    serversOpen,
    sessionID,
    sessionPanelRequest,
    setActive,
    setAttachmentContext,
    setAttachmentPath,
    setBetaHome,
    setBetaHomeProject,
    setBetaMoreOpen,
    setBooting,
    setConnecting,
    setConnectionError,
    setConnectionRevision,
    setConnections,
    setCreatingSession,
    setDirectory,
    setError,
    setFlowRevision,
    setForeground,
    setForm,
    setInfo,
    setMessageSelected,
    setNavigationOpen,
    setNewDirectory,
    setOpenTabs,
    setPairingLink,
    setPendingLocation,
    setProjectBusy,
    setProjectError,
    setProjects,
    setProjectsOpen,
    setRevision,
    setServersOpen,
    setSessionID,
    setSessionPanelRequest,
    setSettingsBackState,
    setTab,
    setUnavailableID,
    setVisited,
    setWorkspaceSection,
    settingsCanGoBackRef,
    showServerSheetRef,
    tab,
    unavailableID,
    visited,
    workspaceSection,
  };
};

export type MobileState = ReturnType<typeof useAppState>;
