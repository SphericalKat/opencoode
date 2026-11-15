import { ClientError, isUnauthorizedError } from "@opencode/client";
import { useEffect } from "react";
import type { RefObject } from "react";

import type { Connection } from "../lib/client";
import type { ServerClient } from "./types";

const PROBE_INTERVAL_MS = 5000;
const PROBE_TIMEOUT_MS = 5000;
const PROBE_RETRY_MS = 1000;
const PROBE_FAILURES_BEFORE_RECOVERY = 2;

interface ProbeHandle {
  cancel?: () => void;
}

const checkServer = async (client: ServerClient, handle: ProbeHandle) => {
  const controller = new AbortController();
  const timeout = Promise.withResolvers<never>();
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    const pending = client.server.info({ signal: controller.signal });
    handle.cancel = () => {
      controller.abort();
      timeout.reject(new Error("The connection check was canceled"));
    };
    deadline = setTimeout(() => {
      timeout.reject(
        new Error(
          "OpenCode did not respond within five seconds. Check the server address and your network."
        )
      );
      controller.abort();
    }, PROBE_TIMEOUT_MS);
    return await Promise.race([pending, timeout.promise]);
  } finally {
    clearTimeout(deadline);
    handle.cancel = undefined;
  }
};

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

interface ProbeOptions {
  activeRef: RefObject<Connection | null>;
  client: ServerClient;
  epoch: RefObject<number>;
  onFailure: (owner: Connection, cause: unknown) => void;
  onHealthy: (owner: Connection) => void;
  owner: Connection;
  request: number;
}

const startConnectionProbe = ({
  activeRef,
  client,
  epoch,
  onFailure,
  onHealthy,
  owner,
  request,
}: ProbeOptions) => {
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const handle: ProbeHandle = {};
  const current = () =>
    !stopped && activeRef.current === owner && epoch.current === request;
  const probe = async () => {
    if (!current()) {
      return;
    }
    try {
      const result = await checkServer(client, handle);
      if (!current()) {
        return;
      }
      assertOpenCodeTwo(result);
      failures = 0;
      onHealthy(owner);
      timer = setTimeout(() => {
        void probe();
      }, PROBE_INTERVAL_MS);
    } catch (error_) {
      if (!current()) {
        return;
      }
      failures += 1;
      const unauthorized = isProbeUnauthorized(error_);
      if (unauthorized || failures >= PROBE_FAILURES_BEFORE_RECOVERY) {
        onFailure(owner, error_);
      }
      timer = setTimeout(
        () => {
          void probe();
        },
        failures === 1 && !unauthorized ? PROBE_RETRY_MS : PROBE_INTERVAL_MS
      );
    }
  };
  void probe();
  return () => {
    stopped = true;
    clearTimeout(timer);
    handle.cancel?.();
  };
};

type ConnectionProbeProps = Omit<ProbeOptions, "owner" | "request"> & {
  active: Connection;
  enabled: boolean;
};

export const ConnectionProbe = ({
  active,
  activeRef,
  client,
  enabled,
  epoch,
  onFailure,
  onHealthy,
}: ConnectionProbeProps) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    return startConnectionProbe({
      activeRef,
      client,
      epoch,
      onFailure,
      onHealthy,
      owner: active,
      request: epoch.current,
    });
  }, [active, activeRef, client, enabled, epoch, onFailure, onHealthy]);
  return null;
};
