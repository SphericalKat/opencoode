import { ClientError, isUnauthorizedError } from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import type { Connection } from "../lib/client";
import { queryKeys } from "../lib/query-keys";
import { withDeadline } from "../lib/request";
import { useServerScope } from "../lib/server-scope";
import type { ServerClient } from "./types";

const PROBE_INTERVAL_MS = 5000;
const PROBE_TIMEOUT_MS = 5000;
const PROBE_RETRY_MS = 1000;
const PROBE_TIMEOUT_MESSAGE =
  "OpenCode did not respond within five seconds. Check the server address and your network.";

const assertOpenCodeTwo = (
  result: { version?: unknown } | null | undefined
) => {
  if (
    !result ||
    typeof result.version !== "string" ||
    !result.version.startsWith("2.")
  ) {
    throw new Error("This address no longer returns an OpenCode 2 server.");
  }
};

const hasUnauthorizedStatus = (error: unknown) =>
  error instanceof ClientError &&
  error.reason === "UnexpectedStatus" &&
  !!error.cause &&
  typeof error.cause === "object" &&
  "status" in error.cause &&
  error.cause.status === 401;

const isProbeUnauthorized = (error: unknown) =>
  isUnauthorizedError(error) || hasUnauthorizedStatus(error);

const retryProbe = (failureCount: number, error: unknown) =>
  failureCount < 1 && !isProbeUnauthorized(error);

interface ConnectionProbeProps {
  active: Connection;
  client: ServerClient;
  enabled: boolean;
  onFailure: (owner: Connection, cause: unknown) => void;
  onHealthy: (owner: Connection) => void;
}

export const ConnectionProbe = ({
  active,
  client,
  enabled,
  onFailure,
  onHealthy,
}: ConnectionProbeProps) => {
  const scope = useServerScope();
  const { dataUpdatedAt, error, errorUpdatedAt, isSuccess } = useQuery({
    enabled,
    queryFn: ({ signal }) =>
      withDeadline(
        signal,
        async (deadline) => {
          const info = await client.server.info({ signal: deadline });
          assertOpenCodeTwo(info);
          return info;
        },
        { message: PROBE_TIMEOUT_MESSAGE, timeoutMs: PROBE_TIMEOUT_MS }
      ),
    queryKey: queryKeys.server.info(scope),
    refetchInterval: PROBE_INTERVAL_MS,
    retry: retryProbe,
    retryDelay: PROBE_RETRY_MS,
    staleTime: 0,
  });
  useEffect(() => {
    if (isSuccess && dataUpdatedAt) {
      onHealthy(active);
    }
  }, [active, dataUpdatedAt, isSuccess, onHealthy]);
  useEffect(() => {
    if (error && errorUpdatedAt) {
      onFailure(active, error);
    }
  }, [active, error, errorUpdatedAt, onFailure]);
  return null;
};
