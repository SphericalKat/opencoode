import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { promisify } from "node:util";

import {
  authorizationHeader,
  connect,
  connectionErrorMessage,
  normalizeConnection,
} from "../src/lib/client";

const rejectingFetch =
  (cause: unknown): typeof globalThis.fetch =>
  () =>
    Promise.reject(cause);

test("connection validation rejects credentials in URLs and unsupported schemes", () => {
  for (const url of [
    "file:///private/server",
    "https://user:password@example.com",
    "https://example.com?password=secret",
  ]) {
    assert.throws(() => normalizeConnection({ name: "Server", url }));
  }
  const connection = normalizeConnection({
    name: "  Work  ",
    url: " https://example.com/opencode/ ",
  });
  assert.equal(connection.name, "Work");
  assert.equal(connection.url, "https://example.com/opencode");
});

test("Basic authentication preserves a Unicode password and its colons", () => {
  const header = authorizationHeader({
    id: "one",
    name: "Work",
    token: "sëcret:a:b",
    url: "https://example.com",
  });
  assert.ok(header);
  assert.equal(
    Buffer.from(header.slice(6), "base64").toString("utf-8"),
    "opencode:sëcret:a:b"
  );
});

test("pairing redeems the code as JSON and authenticates the next request under a server path prefix", async () => {
  const requests: {
    path: string | undefined;
    authorization: string | undefined;
    accept: string | undefined;
  }[] = [];
  const server = createServer((request, response) => {
    requests.push({
      accept: request.headers.accept,
      authorization: request.headers.authorization,
      path: request.url,
    });
    response.setHeader("Content-Type", "application/json");
    if (request.url === "/proxy/auth/connect/one-use-code") {
      response.end(JSON.stringify({ token: "paired-token" }));
    } else if (request.url === "/proxy/api/info") {
      response.end(
        JSON.stringify({
          paths: { tmp: "/tmp" },
          pid: 42,
          urls: [],
          version: "2.1.4",
        })
      );
    } else {
      response.writeHead(404).end();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const result = await connect({
      id: "one",
      name: "Work",
      url: `http://127.0.0.1:${address.port}/proxy/auth/connect/one-use-code`,
    });
    assert.equal(
      result.connection.url,
      `http://127.0.0.1:${address.port}/proxy`
    );
    assert.equal(result.connection.token, "paired-token");
    assert.equal(result.info.version, "2.1.4");
    assert.deepEqual(requests, [
      {
        accept: "application/json",
        authorization: undefined,
        path: "/proxy/auth/connect/one-use-code",
      },
      {
        accept: "*/*",
        authorization: `Basic ${Buffer.from("opencode:paired-token").toString("base64")}`,
        path: "/proxy/api/info",
      },
    ]);
  } finally {
    await promisify(server.close.bind(server))();
  }
});

test("connection recovery distinguishes rejected passwords, expired links, and incompatible server responses", async () => {
  const server = createServer((request, response) => {
    if (request.url === "/missing/api/info") {
      response.setHeader("Content-Type", "application/json");
      response.end("{}");
      return;
    }
    if (request.url === "/old/api/info") {
      response.setHeader("Content-Type", "text/html");
      response.end("<html>Another application</html>");
      return;
    }
    response.writeHead(401, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        _tag: "UnauthorizedError",
        message: request.url?.includes("/auth/connect/")
          ? "Pairing link expired or already used"
          : "Authentication required",
      })
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const cases = [
      ["", /rejected this password/u],
      ["/auth/connect/expired-code", /pairing link expired/u],
      ["/old", /did not return an OpenCode 2 API/u],
      ["/missing", /did not return an OpenCode 2 API/u],
    ] as const;
    await Promise.all(
      cases.map(([path, expected]) => {
        const connection = {
          id: "recovery",
          name: "Server",
          token: "incorrect-password",
          url: origin + path,
        };
        return assert.rejects(
          () => connect(connection),
          (error) => {
            const message = connectionErrorMessage(error, connection);
            assert.match(message, expected);
            assert.ok(!message.includes(connection.token));
            return true;
          }
        );
      })
    );
  } finally {
    await promisify(server.close.bind(server))();
  }
});

test("connection recovery provides safe network and timeout guidance", async () => {
  const connection = {
    id: "network",
    name: "Server",
    url: "http://127.0.0.1:4096",
  };
  const cases = [
    [
      new DOMException("signal timed out", "TimeoutError"),
      /did not respond within 15 seconds/u,
    ],
    [new TypeError("Failed to fetch"), /server is unreachable/u],
  ] as const;
  await Promise.all(
    cases.map(([cause, expected]) =>
      assert.rejects(
        () => connect(connection, rejectingFetch(cause)),
        (error) => {
          assert.match(connectionErrorMessage(error, connection), expected);
          return true;
        }
      )
    )
  );
});
