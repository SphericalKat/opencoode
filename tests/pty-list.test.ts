import assert from "node:assert/strict";
import test from "node:test";

import type { Client } from "../src/lib/client";
import { ptyListOptions } from "../src/lib/queries/panels";

const pty = (id: string) => ({ id }) as never;

const fakeClient = (calls: string[]) =>
  ({
    experimental: {
      persistentPty: {
        list: (input: { sessionID: string }) => {
          calls.push(`desktop:${input.sessionID}`);
          return Promise.resolve([pty("d1")]);
        },
      },
    },
    pty: {
      list: (input: { location: { directory: string } }) => {
        calls.push(`workspace:${input.location.directory}`);
        return Promise.resolve({ data: [pty("w1")] });
      },
    },
  }) as unknown as Client;

const run = (
  options: ReturnType<typeof ptyListOptions>
): Promise<{ kind: string; pty: { id: string } }[]> => {
  const { queryFn } = options;
  if (typeof queryFn !== "function") {
    throw new TypeError("expected a query function");
  }
  return queryFn({ signal: new AbortController().signal } as never) as never;
};

test("pty list merges desktop and workspace shells when persistent shells are on", async () => {
  const calls: string[] = [];
  const shells = await run(
    ptyListOptions("s", fakeClient(calls), "/w", true, "ses_1")
  );
  assert.deepEqual(
    shells.map((shell) => `${shell.kind}:${shell.pty.id}`),
    ["desktop:d1", "workspace:w1"]
  );
  assert.deepEqual(calls.toSorted(), ["desktop:ses_1", "workspace:/w"]);
});

test("pty list skips the desktop call without persistent shells", async () => {
  const calls: string[] = [];
  const shells = await run(
    ptyListOptions("s", fakeClient(calls), "/w", false, "ses_1")
  );
  assert.deepEqual(
    shells.map((shell) => shell.kind),
    ["workspace"]
  );
  assert.deepEqual(calls, ["workspace:/w"]);
});

test("pty list keys differ by mode and stay under the dir.pty prefix", () => {
  const a = ptyListOptions("s", fakeClient([]), "/w", true, "ses_1");
  const b = ptyListOptions("s", fakeClient([]), "/w", false, "ses_1");
  assert.notDeepEqual(a.queryKey, b.queryKey);
  assert.deepEqual(a.queryKey.slice(0, 4), ["s", "dir", "/w", "pty"]);
});
