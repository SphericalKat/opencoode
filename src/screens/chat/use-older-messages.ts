import { useState } from "react";

import { mergeMessages } from "../../lib/chat";
import { PAGE_SIZE, nextCursor } from "./session-sync";
import type { CoreClient } from "./session-sync";
import type { Alive } from "./types";
import type { SessionState } from "./use-session-state";
import { settle } from "./util";

interface UseOlderMessagesOptions {
  alive: Alive;
  client: CoreClient;
  sessionID: string;
  showError: (reason: unknown) => void;
  sync: SessionState;
}

export const useOlderMessages = ({
  alive,
  client,
  sessionID,
  showError,
  sync,
}: UseOlderMessagesOptions) => {
  const { setMessages, cursor, setCursor, historyEpochRef } = sync;
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadOlder = async () => {
    if (!cursor || loadingOlder) {
      return;
    }
    setLoadingOlder(true);
    const historyVersion = historyEpochRef.current;
    await settle(
      async () => {
        const page = await client.message.list({
          cursor,
          limit: PAGE_SIZE,
          sessionID,
        });
        if (alive.current && historyVersion === historyEpochRef.current) {
          setMessages((current) => mergeMessages(page.data, current));
          setCursor(nextCursor(page));
        }
      },
      showError,
      () => {
        if (alive.current) {
          setLoadingOlder(false);
        }
      }
    );
  };

  return { loadOlder, loadingOlder };
};
