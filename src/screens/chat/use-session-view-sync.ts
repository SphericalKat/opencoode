import type { SessionInfo } from "@opencode/client";
import { useEffect, useLayoutEffect, useRef } from "react";

import type { OpenCodeClient } from "./session-sync";

interface UseSessionViewSyncOptions {
  foreground: boolean;
  onSessionChanged: () => void;
  onSessionInfo: ((session: SessionInfo) => void) | undefined;
  opencodeClient: OpenCodeClient;
  session: SessionInfo | null;
  sessionID: string;
  showError: (reason: unknown) => void;
  visible: boolean;
}

export const useSessionViewSync = ({
  foreground,
  onSessionChanged,
  onSessionInfo,
  opencodeClient,
  session,
  sessionID,
  showError,
  visible,
}: UseSessionViewSyncOptions) => {
  const onSessionChangedRef = useRef(onSessionChanged);
  useLayoutEffect(() => {
    onSessionChangedRef.current = onSessionChanged;
  });
  useEffect(() => {
    if (session) {
      onSessionInfo?.(session);
    }
  }, [session, onSessionInfo]);
  useEffect(() => {
    if (!opencodeClient || !foreground || !visible || !session?.time.idle) {
      return;
    }
    const controller = new AbortController();
    void opencodeClient.session
      .view(
        { idle: session.time.idle, sessionID },
        { signal: controller.signal }
      )
      .then((result) => {
        if (!controller.signal.aborted) {
          onSessionChangedRef.current();
        }
        return result;
      })
      .catch((error_) => {
        if (!controller.signal.aborted) {
          showError(error_);
        }
      });
    return () => controller.abort();
  }, [
    opencodeClient,
    sessionID,
    session?.time.idle,
    foreground,
    visible,
    showError,
  ]);

  useEffect(() => {
    if (session?.location.directory) {
      onSessionChangedRef.current();
    }
  }, [session?.location.directory]);
};
