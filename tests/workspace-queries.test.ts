import assert from "node:assert/strict";
import test from "node:test";

import { QueryClient } from "@tanstack/react-query";

import type { Client } from "../src/lib/client";
import {
  directoryFileOptions,
  directoryFilesOptions,
  directoryWorktreesOptions,
} from "../src/lib/queries/workspace";

const entry = (path: string, type: "directory" | "file") => ({
  absolute: `/repo/${path}`,
  ignored: false,
  path,
  type,
});

const fakeClient = (calls: unknown[]) =>
  ({
    file: {
      find: (input: unknown) => {
        calls.push(["find", input]);
        return Promise.resolve({ data: [entry("b.ts", "file")] });
      },
      list: (input: unknown) => {
        calls.push(["list", input]);
        return Promise.resolve({
          data: [
            entry("z.ts", "file"),
            entry("src", "directory"),
            entry("a.ts", "file"),
            entry("lib", "directory"),
          ],
        });
      },
      read: (input: unknown) => {
        calls.push(["read", input]);
        return Promise.resolve(new Uint8Array([1, 2, 3]));
      },
    },
    worktree: {
      list: (input: unknown) => {
        calls.push(["worktrees", input]);
        return Promise.resolve([{ directory: "/repo-wt" }]);
      },
    },
  }) as unknown as Client;

test("directory listing sorts folders first and keeps the request path", async () => {
  const calls: unknown[] = [];
  const entries = await new QueryClient().fetchQuery(
    directoryFilesOptions("s1", fakeClient(calls), {
      directory: "/repo",
      path: "src",
      query: "",
    })
  );
  assert.deepEqual(
    entries.map((item) => item.path),
    ["lib", "src", "a.ts", "z.ts"]
  );
  assert.deepEqual(calls, [
    ["list", { location: { directory: "/repo" }, path: "src" }],
  ]);
});

test("a search request finds files with the trimmed query and caches by query", async () => {
  const calls: unknown[] = [];
  const client = fakeClient(calls);
  const search = directoryFilesOptions("s1", client, {
    directory: "/repo",
    path: "src",
    query: "  b ",
  });
  await new QueryClient().fetchQuery(search);
  assert.deepEqual(calls, [
    ["find", { limit: 200, location: { directory: "/repo" }, query: "b" }],
  ]);
  const listing = directoryFilesOptions("s1", client, {
    directory: "/repo",
    path: "src",
    query: "",
  });
  assert.notDeepEqual(search.queryKey, listing.queryKey);
  assert.equal(search.queryKey[0], "s1");
});

test("a file read returns its bytes and always fetches fresh", async () => {
  const calls: unknown[] = [];
  const options = directoryFileOptions(
    "s1",
    fakeClient(calls),
    "/repo",
    "a.ts"
  );
  const bytes = await new QueryClient().fetchQuery(options);
  assert.deepEqual([...bytes], [1, 2, 3]);
  assert.equal(options.staleTime, 0);
  assert.equal(options.gcTime, 0);
});

test("worktrees wait for the project id", async () => {
  const calls: unknown[] = [];
  const client = fakeClient(calls);
  const queryClient = new QueryClient();
  await assert.rejects(
    queryClient.fetchQuery(
      directoryWorktreesOptions("s1", client, "/repo", undefined)
    )
  );
  assert.deepEqual(calls, []);
  const trees = await queryClient.fetchQuery(
    directoryWorktreesOptions("s1", client, "/repo", "prj_1")
  );
  assert.equal(trees[0].directory, "/repo-wt");
  assert.deepEqual(calls, [["worktrees", { projectID: "prj_1" }]]);
});
