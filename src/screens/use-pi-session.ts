import type { SessionInfo } from "@opencode/client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { PiCommand } from "../../packages/pi-mobile/protocol";
import type { SessionTabItem } from "../components/beta-navigation";
import { errorMessage } from "../lib/client";
import type { Connection } from "../lib/client";
import type { makePiChatBackend } from "../lib/pi-chat-backend";
import type { PiClient } from "../lib/pi-client";
import { useUnsavedGuard } from "../lib/unsaved";

interface UsePiSessionOptions {
  backend: ReturnType<typeof makePiChatBackend>;
  client: PiClient;
  connection: Connection;
  foreground: boolean;
  onConnectionLost: (error: unknown) => void;
}

const tabOf = (session: SessionInfo): SessionTabItem => ({
  directory: session.location.directory,
  id: session.id,
  title: session.title || "New session",
});

// The open Pi session, its tabs and the commands that change it. The state
// resets when the connection object changes.
export const usePiSession = ({
  backend,
  client,
  connection,
  foreground,
  onConnectionLost,
}: UsePiSessionOptions) => {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [tabs, setTabs] = useState<SessionTabItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState(connection);
  if (owner !== connection) {
    setOwner(connection);
    setSession(null);
    setTabs([]);
    setBusy(false);
    setError(null);
  }
  const lifetime = useRef(new AbortController());
  const sessionRef = useRef(session);
  const operation = useRef(false);
  const lostConnection = useRef(onConnectionLost);
  const confirmNavigation = useUnsavedGuard();
  useLayoutEffect(() => {
    sessionRef.current = session;
    lostConnection.current = onConnectionLost;
  });
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);

  const recordSession = useCallback((next: SessionInfo) => {
    setSession((current) =>
      current?.id === next.id &&
      current.title === next.title &&
      current.location.directory === next.location.directory
        ? current
        : next
    );
    const tab = tabOf(next);
    setTabs((current) => {
      const previous = current.find((item) => item.id === next.id);
      if (
        previous?.title === tab.title &&
        previous.directory === tab.directory
      ) {
        return current;
      }
      return previous
        ? current.map((item) => (item.id === tab.id ? tab : item))
        : [...current, tab];
    });
  }, []);

  const refreshSession = useCallback(
    async (requested?: AbortSignal) => {
      const signal = requested ?? lifetime.current.signal;
      const info = await client.info(signal);
      const next = await backend.core.session.get(
        { sessionID: info.session.id },
        { signal }
      );
      if (!signal.aborted) {
        recordSession(next);
      }
    },
    [backend, client, recordSession]
  );

  useEffect(() => {
    if (!foreground || session) {
      return;
    }
    const controller = new AbortController();
    const load = async () => {
      try {
        await refreshSession(controller.signal);
      } catch (error_) {
        if (controller.signal.aborted) {
          return;
        }
        setError(errorMessage(error_));
        lostConnection.current(error_);
      }
    };
    void load();
    return () => controller.abort();
  }, [foreground, session, refreshSession]);

  const changeSession = async (
    command: Extract<PiCommand, { type: "new" | "switch" }>
  ) => {
    if (operation.current || !foreground) {
      return;
    }
    const { signal } = lifetime.current;
    if (!(await confirmNavigation()) || signal.aborted) {
      return;
    }
    operation.current = true;
    setBusy(true);
    setError(null);
    try {
      const { current } = sessionRef;
      if (current) {
        await client.command({ ...command, expectedSessionID: current.id });
        await refreshSession(signal);
      }
    } catch (error_) {
      setError(errorMessage(error_));
    }
    operation.current = false;
    setBusy(false);
  };

  const openSession = (id: string) => {
    if (!id || id === sessionRef.current?.id) {
      return;
    }
    void changeSession({ sessionID: id, type: "switch" });
  };

  const openChatSession = async (id: string) => {
    if (!id || !foreground) {
      return;
    }
    const { signal } = lifetime.current;
    try {
      const info = await client.info(signal);
      if (info.session.id === id) {
        recordSession(
          await backend.core.session.get({ sessionID: id }, { signal })
        );
      } else {
        await changeSession({ sessionID: id, type: "switch" });
      }
    } catch (error_) {
      setError(errorMessage(error_));
    }
  };

  const onSessionChanged = async () => {
    try {
      await refreshSession();
    } catch (error_) {
      setError(errorMessage(error_));
    }
  };

  const onRetry = async () => {
    setError(null);
    await onSessionChanged();
  };

  return {
    busy,
    changeSession,
    error,
    onRetry,
    onSessionChanged,
    openChatSession,
    openSession,
    recordSession,
    session,
    sessionRef,
    setError,
    tabs,
  };
};
