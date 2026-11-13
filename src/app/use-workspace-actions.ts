import { confirmAction } from "../components/ui";
import { errorMessage } from "../lib/client";
import type { Connection } from "../lib/client";
import { saveActiveConnectionId, saveConnections } from "../lib/storage";
import { attempt } from "./connection-utils";
import type { ConfirmNavigation, ServerClient } from "./types";
import type { MobileState } from "./use-app-state";

interface UseWorkspaceActionsDeps {
  changeDirectory: (directory: string) => void;
  client: ServerClient | null;
  confirmNavigation: ConfirmNavigation;
  syncSelectedLocation: () => Promise<string | null>;
}

export const useWorkspaceActions = (
  model: MobileState,
  deps: UseWorkspaceActionsDeps
) => {
  const {
    active,
    activeRef,
    connections,
    directory,
    directoryRef,
    epochRef,
    newDirectory,
    selectedSessionRef,
    selectionRef,
    sessionID,
    setActive,
    setAttachmentContext,
    setAttachmentPath,
    setBetaHome,
    setConnectionError,
    setConnections,
    setDirectory,
    setError,
    setPendingLocation,
    setProjectBusy,
    setProjectError,
    setRevision,
    setSessionID,
    setTab,
  } = model;
  const { changeDirectory, client, confirmNavigation, syncSelectedLocation } =
    deps;
  const openDirectory = async (nextDirectory = newDirectory) => {
    if (!client) {
      return;
    }
    const target = nextDirectory.trim();
    if (
      !target.startsWith("/") &&
      !/^[A-Za-z]:[\\/]/u.test(target) &&
      !target.startsWith("\\\\")
    ) {
      setProjectError("Enter an absolute directory on the server");
      return;
    }
    const owner = active;
    const request = epochRef.current;
    const isCurrent = () =>
      activeRef.current === owner && request === epochRef.current;
    setProjectBusy(true);
    setProjectError(null);
    await attempt(
      async () => {
        const location = await client.location.get(
          { location: { directory: target } },
          { signal: AbortSignal.timeout(15_000) }
        );
        if (!isCurrent()) {
          return;
        }
        changeDirectory(location.directory);
      },
      (error_) => {
        if (isCurrent()) {
          setProjectError(errorMessage(error_));
        }
      },
      () => {
        if (isCurrent()) {
          setProjectBusy(false);
        }
      }
    );
  };

  const removeConnection = async (connection: Connection) => {
    if (
      activeRef.current?.id === connection.id &&
      !(await confirmNavigation())
    ) {
      return;
    }
    if (
      !(await confirmAction(
        "Remove server?",
        `Remove the saved connection to ${connection.name}?`
      ))
    ) {
      return;
    }
    try {
      const next = connections.filter((item) => item.id !== connection.id);
      await saveConnections(next);
      if (activeRef.current?.id === connection.id) {
        epochRef.current += 1;
        await saveActiveConnectionId(null);
        selectedSessionRef.current = null;
        directoryRef.current = "";
        setActive(null);
        setSessionID(null);
        setDirectory("");
        setAttachmentPath(undefined);
        setAttachmentContext(undefined);
        setPendingLocation(null);
      }
      setConnections(next);
    } catch (error_) {
      setConnectionError(errorMessage(error_));
    }
  };

  const attachFile = async (
    path: string,
    contextText?: string
  ): Promise<boolean> => {
    if (!client) {
      return false;
    }
    const owner = activeRef.current;
    const request = epochRef.current;
    const navigation = selectionRef.current;
    try {
      if (selectedSessionRef.current) {
        const nextDirectory = await syncSelectedLocation();
        if (!nextDirectory) {
          return false;
        }
        if (nextDirectory !== directory) {
          if (
            activeRef.current === owner &&
            epochRef.current === request &&
            selectionRef.current === navigation
          ) {
            setError(
              "The session moved to another directory. Choose the file again in its current workspace."
            );
          }
          return false;
        }
      }
      let selected = sessionID;
      if (!selected) {
        const created = await client.session.create({
          location: { directory },
        });
        selected = created.id;
      }
      if (
        activeRef.current !== owner ||
        epochRef.current !== request ||
        selectionRef.current !== navigation
      ) {
        return false;
      }
      selectedSessionRef.current = selected;
      setSessionID(selected);
      setBetaHome(false);
      setAttachmentContext(contextText);
      setAttachmentPath(path);
      setRevision((value) => value + 1);
      setTab("sessions");
      return true;
    } catch (error_) {
      if (
        activeRef.current === owner &&
        epochRef.current === request &&
        selectionRef.current === navigation
      ) {
        setError(errorMessage(error_));
      }
      return false;
    }
  };
  return {
    attachFile,
    openDirectory,
    removeConnection,
  };
};
