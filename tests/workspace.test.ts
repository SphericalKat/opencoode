import assert from "node:assert/strict";
import test from "node:test";

import {
  decodeEditableFile,
  EDITABLE_FILE_LIMIT,
  saveEditableFile,
} from "../src/lib/workspace";

const encode = (text: string) => new TextEncoder().encode(text);

test("the editor preserves UTF-8, byte-order marks, and line endings", async () => {
  let stored: Uint8Array = encode("\uFEFFHello 世界\r\n");
  const original = new Uint8Array(stored);
  const text = decodeEditableFile(original);
  assert.equal(text, "\uFEFFHello 世界\r\n");
  const written = await saveEditableFile(
    {
      read: () => Promise.resolve(stored),
      write: (bytes) => {
        stored = bytes;
        return Promise.resolve();
      },
    },
    original,
    `${text}More\r\n`
  );
  assert.deepEqual(stored, encode("\uFEFFHello 世界\r\nMore\r\n"));
  assert.deepEqual(written, stored);
});

test("the editor refuses stale writes and leaves the newer server file intact", async () => {
  let stored: Uint8Array = encode("Changed remotely");
  await assert.rejects(
    saveEditableFile(
      {
        read: () => Promise.resolve(stored),
        write: (bytes) => {
          stored = bytes;
          return Promise.resolve();
        },
      },
      encode("Original"),
      "My edits"
    ),
    /changed on the server/u
  );
  assert.equal(new TextDecoder().decode(stored), "Changed remotely");
});

test("the editor rejects binary, invalid UTF-8, and oversized files", () => {
  assert.throws(
    () => decodeEditableFile(new Uint8Array([65, 0, 66])),
    /binary/u
  );
  assert.throws(() => decodeEditableFile(new Uint8Array([0xff])), /UTF-8/u);
  assert.throws(
    () => decodeEditableFile(new Uint8Array(EDITABLE_FILE_LIMIT + 1)),
    /512 KB/u
  );
});

test("a failed read or write rejects without reporting a successful save", async () => {
  let writes = 0;
  await assert.rejects(
    saveEditableFile(
      {
        read: () => Promise.reject(new Error("Offline")),
        write: () => {
          writes += 1;
          return Promise.resolve();
        },
      },
      encode("A"),
      "B"
    ),
    /Offline/u
  );
  assert.equal(writes, 0);
  await assert.rejects(
    saveEditableFile(
      {
        read: () => Promise.resolve(encode("A")),
        write: () => Promise.reject(new Error("Read-only")),
      },
      encode("A"),
      "B"
    ),
    /Read-only/u
  );
});
