import assert from "node:assert/strict";
import test from "node:test";

import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";

import type { ChatBackend } from "../src/lib/chat-backend";
import {
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
