import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { errorMessage, isConnectionUnauthorized } from "../../lib/client";
import type { Alive } from "./types";

interface UseChatErrorsOptions {
  alive: Alive;
  onConnectionLost: ((error: unknown) => void) | undefined;
}

export const useChatErrors = ({
  alive,
  onConnectionLost,
}: UseChatErrorsOptions) => {
  const [error, setError] = useState<string | null>(null);
  const connectionFailures = useRef(0);
  const connectionLost = useRef(onConnectionLost);
  const reportConnectionFailure = useCallback((reason: unknown) => {
    connectionFailures.current += 1;
    if (isConnectionUnauthorized(reason) || connectionFailures.current >= 2) {
      connectionLost.current?.(reason);
    }
  }, []);
  useLayoutEffect(() => {
    connectionLost.current = onConnectionLost;
  });
  const showError = useCallback(
    (reason: unknown) => {
      if (!alive.current) {
        return;
      }
      setError(errorMessage(reason));
      if (isConnectionUnauthorized(reason)) {
        connectionLost.current?.(reason);
      }
    },
    [alive]
  );
  return {
    connectionFailures,
    error,
    reportConnectionFailure,
    setError,
    showError,
  };
};
