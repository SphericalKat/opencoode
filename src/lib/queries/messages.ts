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
// `liveIDs` lists the assistant messages in `pages[0]` that a live event wrote.
// A snapshot that is fetched later must not replace one of them with older
// text. The list travels with the cache data, so copies of the data keep it.
export type MessagesData = InfiniteData<MessagePage, string | undefined> & {
  liveIDs?: string[];
};

export const nextCursor = (page: MessagePage) => page.cursor.next ?? undefined;

const isLiveAssistant = (
  message: SessionMessageInfo | undefined,
  liveIDs: ReadonlySet<string>
): message is SessionMessageAssistant =>
  message?.type === "assistant" && liveIDs.has(message.id);

// A snapshot wins only when both copies are complete and the snapshot
// completed no earlier than the live copy.
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
  next: MessagePage,
  previousLive: ReadonlySet<string>,
  nextLive: ReadonlySet<string>
): { liveIDs: string[]; page: MessagePage } => {
  const previousById = new Map(
    previous.data.map((message) => [message.id, message])
  );
  const nextIds = new Set(next.data.map((message) => message.id));
  const liveIDs = new Set<string>();
  const data: SessionMessageInfo[] = next.data.map((message) => {
    const live = previousById.get(message.id);
    if (nextLive.has(message.id)) {
      liveIDs.add(message.id);
      return message;
    }
    if (!isLiveAssistant(live, previousLive)) {
      return message;
    }
    if (snapshotSupersedes(message, live)) {
      return message;
    }
    liveIDs.add(message.id);
    return live;
  });
  for (const message of previous.data) {
    if (isLiveAssistant(message, previousLive) && !nextIds.has(message.id)) {
      data.push(message);
      liveIDs.add(message.id);
    }
  }
  return { liveIDs: [...liveIDs], page: { ...next, data } };
};

const hasPages = (value: unknown): value is MessagesData =>
  typeof value === "object" &&
  value !== null &&
  Array.isArray((value as MessagesData).pages);

// Keeps live assistant messages in `pages[0]` when a head snapshot arrives.
// Older pages never hold live messages, so they pass through unchanged.
// TanStack also runs this over the result of `select`, which is a message
// list and not a page set. That result passes through unchanged.
export const mergeMessagesData = (
  previous: unknown,
  next: unknown
): unknown => {
  if (!hasPages(previous) || !hasPages(next)) {
    return next;
  }
  const before = previous;
  const after = next;
  const [head] = before.pages;
  const [nextHead] = after.pages;
  if (!head || !nextHead) {
    return next;
  }
  const merged = mergeHeadPage(
    head,
    nextHead,
    new Set(before.liveIDs),
    new Set(after.liveIDs)
  );
  return {
    ...after,
    liveIDs: merged.liveIDs,
    pages: [merged.page, ...after.pages.slice(1)],
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
  queryClient.setQueryData<MessagesData>(queryKey, (current) => {
    const head = current?.pages[0];
    if (!current || !head) {
      return current;
    }
    const data = projectLiveEvents(head.data, events, sessionID);
    if (data === head.data) {
      return current;
    }
    const touched = new Set<string>();
    for (const event of events) {
      const { assistantMessageID } = event.data as Record<string, unknown>;
      if (typeof assistantMessageID === "string") {
        touched.add(assistantMessageID);
      }
    }
    const liveIDs = new Set(current.liveIDs);
    for (const message of data) {
      if (message.type === "assistant" && touched.has(message.id)) {
        liveIDs.add(message.id);
      }
    }
    return {
      ...current,
      liveIDs: [...liveIDs],
      pages: [{ ...head, data }, ...current.pages.slice(1)],
    };
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
  const head = await withDeadline(undefined, (signal) =>
    core.message.list(
      { limit: MESSAGE_PAGE_SIZE, order: "desc", sessionID },
      { signal }
    )
  );
  void queryClient.cancelQueries({ exact: true, queryKey }, { revert: false });
  queryClient.setQueryData<MessagesData>(queryKey, (current) =>
    current?.pages[0]
      ? {
          pageParams: current.pageParams,
          pages: [head, ...current.pages.slice(1)],
        }
      : current
  );
};

// Keeps only page 0 without marking the query stale. The merge in
// `structuralSharing` restores the live message list.
export const trimMessagesToHead = (
  queryClient: QueryClient,
  scope: Scope,
  sessionID: string
) => {
  queryClient.setQueryData<MessagesData>(
    queryKeys.session.messages(scope, sessionID),
    (current) =>
      current
        ? {
            pageParams: current.pageParams.slice(0, 1),
            pages: current.pages.slice(0, 1),
          }
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
  trimMessagesToHead(queryClient, scope, sessionID);
  await queryClient.invalidateQueries({
    queryKey: queryKeys.session.messages(scope, sessionID),
  });
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
