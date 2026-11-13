import React, { useCallback, useRef, useState } from "react";

import { settle } from "../../lib/async";
import type { Alive, SetPanel } from "./types";

export type RunAction = (
  action: () => Promise<unknown>,
  closePanel?: boolean
) => Promise<void>;

interface UseRunActionOptions {
  alive: Alive;
  onSessionChanged: () => void;
  refresh: (signal?: AbortSignal) => Promise<void>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setPanel: SetPanel;
  showError: (reason: unknown) => void;
}

export const useRunAction = ({
  alive,
  onSessionChanged,
  refresh,
  setError,
  setPanel,
  showError,
}: UseRunActionOptions) => {
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const run = useCallback(
    async (action: () => Promise<unknown>, closePanel = false) => {
      if (submitting.current) {
        return;
      }
      submitting.current = true;
      setPending(true);
      setError(null);
      await settle(
        async () => {
          await action();
          if (alive.current) {
            if (closePanel) {
              setPanel(null);
            }
            void refresh().catch(showError);
            onSessionChanged();
          }
        },
        showError,
        () => {
          submitting.current = false;
          if (alive.current) {
            setPending(false);
          }
        }
      );
    },
    [refresh, onSessionChanged, showError, alive, setPanel, setError]
  );

  return { pending, run, submitting };
};
