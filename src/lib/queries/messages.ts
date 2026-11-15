import type {
  OpenCodeEvent,
  SessionMessageAssistant,
  SessionMessageInfo,
} from "@opencode/client";
import { infiniteQueryOptions } from "@tanstack/react-query";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { mergeMessages, projectLiveEvents, withoutReverted } from "../chat";
import type { ChatBackend } from "../chat-backend";
import { queryKeys } from "../query-keys";
import type { Scope } from "../query-keys";
import { withDeadline } from "../request";

export const MESSAGE_PAGE_SIZE = 80;

type Core = ChatBackend["core"];
export type MessagePage = Awaited<ReturnType<Core["message"]["list"]>>;
export type MessagesData = InfiniteData<MessagePage, string | undefined>;

// A short page means there is no older history.
export const nextCursor = (page: MessagePage) =>
  page.data.length === MESSAGE_PAGE_SIZE
    ? (page.cursor.next ?? undefined)
    : undefined;

// Assistant messages that a live event wrote into the cache. A snapshot that is
// fetched later must not replace one of them with older text. The cache itself
// is the live state, so this set marks which cached messages came from events.
const liveMessages = new WeakSet<SessionMessageInfo>();

const isLiveAssistant = (
  message: SessionMessageInfo | undefined
): message is SessionMessageAssistant =>
  message?.type === "assistant" && liveMessages.has(message);

// The old rule of `liveMessagesRef`: a snapshot wins only when both copies are
// complete and the snapshot completed no earlier than the live copy.
const snapshotSupersedes = (
  snapshot: SessionMessageInfo,
  live: SessionMessageAssistant
) =>
  snapshot.type === "assistant" &&
  Boolean(live.time.completed) &&
  Boolean(snapshot.time.completed) &&
  (snapshot.time.completed ?? 0) >= (live.time.completed ?? 0);

const mergeHeadPage = (
  previous: MessagePage,
  next: MessagePage
): MessagePage => {
  const previousById = new Map(
    previous.data.map((message) => [message.id, message])
  );
  const nextIds = new Set(next.data.map((message) => message.id));
  const data: SessionMessageInfo[] = next.data.map((message) => {
    const live = previousById.get(message.id);
    if (liveMessages.has(message) || !isLiveAssistant(live)) {
      return message;
    }
    return snapshotSupersedes(message, live) ? message : live;
  });
  for (const message of previous.data) {
    if (isLiveAssistant(message) && !nextIds.has(message.id)) {
      data.push(message);
    }
  }
  return { ...next, data };
};

// Keeps live assistant messages in `pages[0]` when a head snapshot arrives.
// It replaces the `liveMessagesRef` rule. Older pages never hold live
// messages, so they pass through unchanged.
export const mergeMessagesData = (
  previous: unknown,
  next: unknown
): unknown => {
  const before = previous as MessagesData | undefined;
  const after = next as MessagesData | undefined;
  const head = before?.pages[0];
  const nextHead = after?.pages[0];
  if (!before || !after || !head || !nextHead) {
    return next;
  }
  return {
    ...after,
    pages: [mergeHeadPage(head, nextHead), ...after.pages.slice(1)],
  } satisfies MessagesData;
};

// The transcript list: all loaded pages, merged by id, minus the reverted
// range. `revertMessageID` comes from `session.detail`. Use it as `select`.
export const flattenMessages = (
  data: MessagesData,
  revertMessageID: string | undefined
): SessionMessageInfo[] =>
  withoutReverted(
    mergeMessages(...data.pages.map((page) => page.data)),
    revertMessageID
  );

export const sessionMessagesOptions = (
  scope: Scope,
  core: Core,
  sessionID: string
) =>
  infiniteQueryOptions({
    getNextPageParam: nextCursor,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      withDeadline(signal, (deadline) =>
        core.message.list(
          {
            cursor: pageParam,
            limit: MESSAGE_PAGE_SIZE,
            order: "desc",
            sessionID,
          },
          { signal: deadline }
        )
      ),
    queryKey: queryKeys.session.messages(scope, sessionID),
    staleTime: Number.POSITIVE_INFINITY,
    structuralSharing: mergeMessagesData,
  });

const updateHead = (
  queryClient: QueryClient,
  scope: Scope,
  sessionID: string,
  update: (head: MessagePage) => MessagePage
) => {
  const queryKey = queryKeys.session.messages(scope, sessionID);
  queryClient.setQueryData<MessagesData>(queryKey, (current) => {
    const head = current?.pages[0];
    return current && head
      ? { ...current, pages: [update(head), ...current.pages.slice(1)] }
      : current;
  });
};

// Applies streamed events to `pages[0]` of an open transcript. A session whose
// transcript is not in the cache is ignored.
export const applyLiveMessageEvents = (
  queryClient: QueryClient,
  scope: Scope,
  sessionID: string,
  events: OpenCodeEvent[]
) => {
  const queryKey = queryKeys.session.messages(scope, sessionID);
  void queryClient.cancelQueries({ exact: true, queryKey }, { revert: false });
  updateHead(queryClient, scope, sessionID, (head) => {
    const data = projectLiveEvents(head.data, events, sessionID);
    if (data === head.data) {
      return head;
    }
    const touched = new Set<string>();
    for (const event of events) {
      const { assistantMessageID } = event.data as Record<string, unknown>;
      if (typeof assistantMessageID === "string") {
        touched.add(assistantMessageID);
      }
    }
    for (const message of data) {
      if (message.type === "assistant" && touched.has(message.id)) {
        liveMessages.add(message);
      }
    }
    return { ...head, data };
  });
};

// Fetches page 0 and merges it into `pages[0]`. A plain invalidation would
// refetch every loaded page. Without cached data it falls back to the
// ordinary first fetch.
export const refreshMessagesHead = async (
  queryClient: QueryClient,
  scope: Scope,
  core: Core,
  sessionID: string
) => {
  const queryKey = queryKeys.session.messages(scope, sessionID);
  if (!queryClient.getQueryData(queryKey)) {
    await queryClient.invalidateQueries({ queryKey });
    return;
  }
  const head = await core.message.list({
    limit: MESSAGE_PAGE_SIZE,
    order: "desc",
    sessionID,
  });
  queryClient.setQueryData<MessagesData>(queryKey, (current) =>
    current?.pages[0]
      ? { ...current, pages: [head, ...current.pages.slice(1)] }
      : current
  );
};

// Keeps only page 0 and marks the query stale. `resetQueries` would blank the
// transcript, so this is the only reset. The refetch then replaces page 0.
export const resetMessages = async (
  queryClient: QueryClient,
  scope: Scope,
  sessionID: string
) => {
  const queryKey = queryKeys.session.messages(scope, sessionID);
  queryClient.setQueryData<MessagesData>(queryKey, (current) =>
    current
      ? {
          pageParams: current.pageParams.slice(0, 1),
          pages: current.pages.slice(0, 1),
        }
      : current
  );
  await queryClient.invalidateQueries({ queryKey });
};

// Pi sends whole snapshots. A snapshot replaces the cache with one page,
// because the adapter is the only writer.
export const writeMessagesSnapshot = (
  queryClient: QueryClient,
  scope: Scope,
  sessionID: string,
  messages: SessionMessageInfo[]
) => {
  const queryKey = queryKeys.session.messages(scope, sessionID);
  queryClient.setQueryData<MessagesData>(queryKey, {
    pageParams: [undefined],
    pages: [{ cursor: { next: null }, data: messages } as MessagePage],
  });
};
