import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { createClient } from "../src/lib/client";
import type { Connection } from "../src/lib/client";

const fixture = JSON.parse(
  await readFile("/tmp/opencoode-live-connection.json", "utf-8")
) as { connection: Connection; directory: string };
const client = createClient(fixture.connection, (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20_000) })
);
const location = await client.location.get({
  location: { directory: fixture.directory },
});
const created = await client.worktree.create({
  name: `mobile-smoke-${Date.now()}`,
  projectID: location.project.id,
});
const treeLocation = { directory: created.directory };
let original: Uint8Array | undefined;
try {
  const list = await client.worktree.list({ projectID: location.project.id });
  assert.ok(list.some((tree) => tree.directory === created.directory));
  const tree = await client.location.get({ location: treeLocation });
  assert.equal(tree.project.id, location.project.id);
  original = await client.file.read({
    location: treeLocation,
    path: "README.md",
  });
  await client.experimental.file.write({
    location: treeLocation,
    path: "README.md",
    payload: new TextEncoder().encode("Uncommitted mobile smoke edit.\n"),
  });
  await assert.rejects(
    client.worktree.remove({
      directory: created.directory,
      force: false,
      projectID: location.project.id,
    })
  );
  assert.equal(
    new TextDecoder().decode(
      await client.file.read({ location: treeLocation, path: "README.md" })
    ),
    "Uncommitted mobile smoke edit.\n"
  );
  console.log(
    "Worktree create, list, location scope, and dirty removal protection passed"
  );
} finally {
  if (original) {
    await client.experimental.file.write({
      location: treeLocation,
      path: "README.md",
      payload: original,
    });
  }
  await client.worktree.remove({
    directory: created.directory,
    force: false,
    projectID: location.project.id,
  });
}
const list = await client.worktree.list({ projectID: location.project.id });
assert.ok(!list.some((tree) => tree.directory === created.directory));
console.log("Clean worktree removal passed");
