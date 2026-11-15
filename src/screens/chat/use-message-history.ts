import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import type { ChatBackend } from "../../lib/chat-backend";
import {
  flattenMessages,
  sessionMessagesOptions,
} from "../../lib/queries/messages";
import type { MessagesData } from "../../lib/queries/messages";
import { useServerScope } from "../../lib/server-scope";

interface UseMessageHistoryOptions {
  backend: ChatBackend;
  live: boolean;
  revertMessageID: string | undefined;
  sessionID: string;
}

const NO_MESSAGES: ReturnType<typeof flattenMessages> = [];

// The transcript is the infinite messages query. Live events and snapshots
// write into its first page, and `select` removes the reverted range.
export const useMessageHistory = ({
  backend,
  live,
  revertMessageID,
  sessionID,
}: UseMessageHistoryOptions) => {
  const scope = useServerScope();
  const select = useCallback(
    (data: MessagesData) => flattenMessages(data, revertMessageID),
    [revertMessageID]
  );
  const page = useInfiniteQuery({
    ...sessionMessagesOptions(scope, backend.core, sessionID),
    enabled: live,
    select,
  });
  return {
    fetchNextPage: page.fetchNextPage,
    hasNextPage: page.hasNextPage,
    isFetchingNextPage: page.isFetchingNextPage,
    messages: page.data ?? NO_MESSAGES,
    messagesError: page.isFetchNextPageError ? null : page.error,
    messagesPending: page.isPending,
  };
};
