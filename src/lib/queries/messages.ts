import { queryOptions } from "@tanstack/react-query";

import type { ChatBackend } from "../chat-backend";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";
import { withDeadline } from "../request";

export const MESSAGE_PAGE_SIZE = 80;

// The newest page of a transcript. `beforeFetch.current` flushes batched stream events
// so a snapshot never lands ahead of text that is already on screen.
export const sessionMessagesOptions = (
  scope: Scope,
  core: ChatBackend["core"],
  sessionID: string,
  beforeFetch: { current: () => void }
) =>
  queryOptions({
    queryFn: ({ signal }) => {
      beforeFetch.current();
      return withDeadline(signal, (deadline) =>
        core.message.list(
          { limit: MESSAGE_PAGE_SIZE, order: "desc", sessionID },
          { signal: deadline }
        )
      );
    },
    queryKey: queryKeys.session.messages(scope, sessionID),
    // Each fetch must reach the message list, even when the page is unchanged.
    staleTime: Number.POSITIVE_INFINITY,
    structuralSharing: false,
  });
