import assert from "node:assert/strict";
import test from "node:test";

import {
  externalURL,
  saveConfigFile,
  validateConfig,
} from "../src/lib/settings";
import {
  filterSections,
  resolveSelected,
  sectionMenuEntries,
} from "../src/screens/settings/sections";
import type { Section } from "../src/screens/settings/sections";

test("configuration accepts comments and trailing commas but rejects non-objects and syntax errors", () => {
  validateConfig('{ // Project options\n "default_agent": "build",\n}');
  assert.throws(() => validateConfig('{"model": }'), /Invalid configuration/u);
  assert.throws(() => validateConfig("[]"), /JSON object/u);
});

test("configuration preserves a newer server file instead of overwriting it", async () => {
  let writes = 0;
  await assert.rejects(
    saveConfigFile(
      {
        experimental: {
          file: {
            write: () => {
              writes += 1;
              return Promise.resolve({
                data: { path: "/project/opencode.jsonc" },
                location: { directory: "/project" },
              });
            },
          },
        },
        file: {
          read: () =>
            Promise.resolve(new TextEncoder().encode('{"model":"newer"}')),
        },
      },
      "/project",
      "/project/opencode.jsonc",
      "{}",
      '{"model":"requested"}'
    ),
    /changed on the server/u
  );
  assert.equal(writes, 0);
});

test("new configuration refuses to overwrite a file created after the editor opened", async () => {
  let writes = 0;
  await assert.rejects(
    saveConfigFile(
      {
        experimental: {
          file: {
            write: () => {
              writes += 1;
              return Promise.resolve({
                data: { path: "/project/opencode.jsonc" },
                location: { directory: "/project" },
              });
            },
          },
        },
        file: { read: () => Promise.resolve(new TextEncoder().encode("{}")) },
      },
      "/project",
      "/project/opencode.jsonc",
      null,
      '{"default_agent":"build"}'
    ),
    /changed on the server/u
  );
  assert.equal(writes, 0);
});

test("configuration validates before reading or writing and saves the exact edited bytes", async () => {
  let reads = 0;
  const written: Uint8Array[] = [];
  const client = {
    experimental: {
      file: {
        write: (input: { payload: Uint8Array }) => {
          written.push(input.payload);
          return Promise.resolve({
            data: { path: "/project/opencode.jsonc" },
            location: { directory: "/project" },
          });
        },
      },
    },
    file: {
      read: () => {
        reads += 1;
        return Promise.resolve(new TextEncoder().encode("{}"));
      },
    },
  };
  await assert.rejects(
    saveConfigFile(
      client,
      "/project",
      "/project/opencode.jsonc",
      "{}",
      "{bad}"
    ),
    /Invalid configuration/u
  );
  assert.equal(reads, 0);
  const source = '{\n  // Keep this comment\n  "default_agent": "build",\n}';
  await saveConfigFile(
    client,
    "/project",
    "/project/opencode.jsonc",
    "{}",
    source
  );
  assert.equal(reads, 1);
  assert.equal(new TextDecoder().decode(written[0]), source);
});

test("integration links permit browser URLs and block executable schemes", () => {
  assert.equal(
    externalURL("https://example.com/authorize?state=abc"),
    "https://example.com/authorize?state=abc"
  );
  assert.throws(
    () => externalURL(["javascript", "alert(1)"].join(":")),
    /unsupported link/u
  );
  assert.throws(() => externalURL("file:///etc/passwd"), /unsupported link/u);
});

test("settings without a server connection keep only Look and feel and Models", () => {
  const all: Section[] = ["Look and feel", "Config", "Models", "Accounts"];
  assert.deepEqual(filterSections(all, false, true), [
    "Look and feel",
    "Models",
  ]);
  assert.deepEqual(filterSections(all, false, false), ["Look and feel"]);
  assert.deepEqual(filterSections(all, true, false), all);
});

test("settings open the first section when the chosen one is unavailable", () => {
  const available: Section[] = ["Look and feel", "Models"];
  assert.equal(resolveSelected(null, available), "Look and feel");
  assert.equal(resolveSelected("Config", available), "Look and feel");
  assert.equal(resolveSelected("Models", available), "Models");
  assert.equal(resolveSelected(null, []), null);
});

test("section menu separates groups and lists Servers first among connections", () => {
  const entries = sectionMenuEntries(
    ["Look and feel", "Config", "Accounts", "Models", "Advanced"],
    true
  );
  assert.deepEqual(
    entries.map((entry) => ("type" in entry ? "-" : entry.label)),
    [
      "Look and feel",
      "Config",
      "-",
      "Servers",
      "Accounts",
      "Models",
      "-",
      "Advanced",
    ]
  );
  const local = sectionMenuEntries(["Look and feel"], false);
  assert.deepEqual(local, [{ label: "Look and feel", value: "Look and feel" }]);
});
