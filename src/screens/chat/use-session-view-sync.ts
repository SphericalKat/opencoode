import type { SessionInfo } from "@opencode/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef } from "react";

import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import type { OpenCodeClient } from "./types";

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
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const onSessionChangedRef = useRef(onSessionChanged);
  useLayoutEffect(() => {
    onSessionChangedRef.current = onSessionChanged;
  });
  useEffect(() => {
    if (session) {
      onSessionInfo?.(session);
    }
  }, [session, onSessionInfo]);
  const view = useMutation({
    mutationFn: (input: { idle: number }) => {
      if (!opencodeClient) {
        throw new Error("This connection does not track viewed sessions");
      }
      return opencodeClient.session.view({ idle: input.idle, sessionID });
    },
    onError: showError,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.session.detail(scope, sessionID),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.sessions.all(scope),
      });
      onSessionChangedRef.current();
    },
  });
  const { mutate: markViewed } = view;
  const idle = session?.time.idle;
  useEffect(() => {
    if (!opencodeClient || !foreground || !visible || !idle) {
      return;
    }
    markViewed({ idle });
  }, [opencodeClient, idle, foreground, visible, markViewed]);
  useEffect(() => {
    if (session?.location.directory) {
      onSessionChangedRef.current();
    }
  }, [session?.location.directory]);
};
