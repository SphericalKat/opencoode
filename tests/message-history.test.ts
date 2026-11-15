import assert from "node:assert/strict";
import test from "node:test";

import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";

import type { ChatBackend } from "../src/lib/chat-backend";
import {
  MESSAGE_PAGE_SIZE,
  flattenMessages,
  sessionMessagesOptions,
} from "../src/lib/queries/messages";
import type { MessagePage, MessagesData } from "../src/lib/queries/messages";

const page = (ids: string[]) =>
  ({
    cursor: { next: null },
    data: ids.map((id) => ({
      id,
      sessionID: "s",
      text: id,
      time: { created: 1 },
      type: "user",
    })),
  }) as unknown as MessagePage;

const core = (ids: string[]) =>
  ({ message: { list: () => Promise.resolve(page(ids)) } }) as never as Pick<
    ChatBackend,
    "core"
  >["core"];

test("the transcript query returns the listed messages through select", async () => {
  const queryClient = new QueryClient();
  const observer = new InfiniteQueryObserver(queryClient, {
    ...sessionMessagesOptions("scope", core(["a", "b"]), "s"),
    select: (data: MessagesData) => flattenMessages(data, undefined),
  });
  const result = await observer.fetchNextPage();
  assert.equal(result.error, null);
  assert.deepEqual(
    result.data?.map((message) => message.id),
    ["a", "b"]
  );
  observer.destroy();
});

test("a refetch with select keeps the transcript readable", async () => {
  const queryClient = new QueryClient();
  const options = {
    ...sessionMessagesOptions("scope", core(["a"]), "s"),
    select: (data: MessagesData) => flattenMessages(data, undefined),
  };
  const observer = new InfiniteQueryObserver(queryClient, options);
  await observer.fetchNextPage();
  const result = await observer.refetch();
  assert.equal(result.error, null);
  assert.equal(result.data?.length, 1);
  observer.destroy();
});

interface ListInput {
  cursor?: string;
  limit?: number;
  order?: string;
}

const recordingCore = (total: number, requests: ListInput[]) =>
  ({
    message: {
      list: (input: ListInput) => {
        requests.push(input);
        const count = Math.min(MESSAGE_PAGE_SIZE, total);
        return Promise.resolve({
          ...page(
            Array.from(
              { length: count },
              (_, index) => `m${index}-${input.cursor ?? "head"}`
            )
          ),
          cursor: { next: "older" },
        });
      },
    },
  }) as never as Pick<ChatBackend, "core">["core"];

test("the head request orders newest first and an older request sends only the cursor", async () => {
  const requests: ListInput[] = [];
  const queryClient = new QueryClient();
  const observer = new InfiniteQueryObserver(queryClient, {
    ...sessionMessagesOptions(
      "scope",
      recordingCore(MESSAGE_PAGE_SIZE, requests),
      "s"
    ),
  });
  await observer.fetchNextPage();
  await observer.fetchNextPage();
  assert.equal(requests[0]?.order, "desc");
  assert.equal(requests[0]?.cursor, undefined);
  assert.equal(requests[1]?.cursor, "older");
  assert.equal(requests[1]?.order, undefined);
  observer.destroy();
});

test("a short first page has no older page even when the server sends a cursor", async () => {
  const queryClient = new QueryClient();
  const observer = new InfiniteQueryObserver(queryClient, {
    ...sessionMessagesOptions("scope", recordingCore(3, []), "s"),
  });
  const result = await observer.fetchNextPage();
  assert.equal(result.hasNextPage, false);
  observer.destroy();
});

test("a full first page has an older page", async () => {
  const queryClient = new QueryClient();
  const observer = new InfiniteQueryObserver(queryClient, {
    ...sessionMessagesOptions(
      "scope",
      recordingCore(MESSAGE_PAGE_SIZE, []),
      "s"
    ),
  });
  const result = await observer.fetchNextPage();
  assert.equal(result.hasNextPage, true);
  observer.destroy();
});
