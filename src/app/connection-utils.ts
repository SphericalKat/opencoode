import { isLocationNotFoundError } from "@opencode/client";
import { AppState } from "react-native";

import { createClient, withServerDeadline } from "../lib/client";
import type { Connection } from "../lib/client";
import type { ConnectResult, ServerClient, WorkspaceSnapshot } from "./types";

const getWorkspaceLocation = (
  nextClient: ServerClient,
  workspace: { directory?: string } | null | undefined,
  signal: AbortSignal,
  onFallback: () => void
) =>
  nextClient.location
    .get(
      workspace?.directory
        ? { location: { directory: workspace.directory } }
        : undefined,
      { signal }
    )
    .catch((error_) => {
      if (
        signal.aborted ||
        !workspace?.directory ||
        !isLocationNotFoundError(error_)
      ) {
        throw error_;
      }
      onFallback();
      return nextClient.location.get(undefined, { signal });
    });

export const attempt = async <T>(
  work: () => Promise<T>,
  onError: (error: unknown) => T,
  onFinally?: () => void
): Promise<T> => {
  try {
    return await work();
  } catch (error_) {
    return onError(error_);
  } finally {
    onFinally?.();
  }
};

const usernameOf = (connection: Connection) =>
  connection.username || "opencode";

export const mergeMatchingConnection = (
  result: Connection,
  requested: Connection,
  current: Connection[],
  explicitName: boolean
): Connection => {
  if (explicitName || current.some((item) => item.id === requested.id)) {
    return result;
  }
  const matching = current.find(
    (item) => item.url === result.url && usernameOf(item) === usernameOf(result)
  );
  return matching
    ? { ...result, id: matching.id, name: matching.name }
    : result;
};

export const isSameServer = (owner: Connection | null, connected: Connection) =>
  owner?.id === connected.id &&
  owner.url === connected.url &&
  owner.backend === connected.backend &&
  usernameOf(owner) === usernameOf(connected);

export const locateWorkspace = async (
  result: ConnectResult,
  connected: Connection,
  workspace: WorkspaceSnapshot
): Promise<{ directory: string; sessionID: string | undefined }> => {
  if (result.backend === "pi") {
    return {
      directory: result.info.session.cwd,
      sessionID: result.info.session.id,
    };
  }
  let sessionID = workspace?.sessionID;
  const location = await withServerDeadline((signal) =>
    getWorkspaceLocation(createClient(connected), workspace, signal, () => {
      sessionID = undefined;
    })
  );
  return { directory: location.directory, sessionID };
};

export const isAppForeground = () =>
  AppState.currentState !== "background" &&
  AppState.currentState !== "inactive";

export const flowError = (
  connectionError: string | null,
  active: Connection | null,
  error: string | null
) => connectionError ?? (active ? null : error);
