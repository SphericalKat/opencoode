import assert from "node:assert/strict";

export async function verifyBackendImages(page) {
  for (const failed of [false, true]) {
    const result = await page.evaluate(async (failed) => {
      const connection = { id: "pi", name: "Pi", url: "http://pi.invalid" };
      const content = [
        { text: "Captured", type: "text" },
        { data: "Zmlyc3Q=", mimeType: "image/png", type: "image" },
        { data: "c2Vjb25k", mimeType: "image/jpeg", type: "image" },
      ];
      const initial = {
        cursor: 0,
        instanceID: "server",
        messages: [
          {
            content: [
              {
                arguments: {},
                id: "capture",
                name: "screenshot",
                type: "toolCall",
              },
            ],
            id: "assistant",
            role: "assistant",
            timestamp: 1,
          },
        ],
        session: {
          cwd: "/project",
          id: "session",
          idle: false,
          name: "Images",
          thinkingLevel: "",
        },
        tools: [],
      };
      const completed = {
        content,
        id: "capture",
        input: {},
        name: "screenshot",
        output: "Captured",
        status: failed ? "error" : "completed",
      };
      const message = {
        content,
        id: "result",
        isError: failed,
        role: "toolResult",
        timestamp: 2,
        toolCallId: "capture",
      };
      const events = [
        {
          cursor: 1,
          events: [{ tool: completed, type: "tool" }],
          instanceID: "server",
        },
        {
          cursor: 2,
          events: [{ message, type: "message" }],
          instanceID: "server",
        },
      ];
      const json = (body) =>
        new Response(JSON.stringify(body), {
          headers: { "Content-Type": "application/json" },
        });
      const pi = globalThis.createPiClient(connection, async (url) =>
        json(String(url).includes("/pi/events") ? events.shift() : initial)
      );
      const backend = globalThis.makePiChatBackend(connection, pi);
      const subscription = backend.subscribe({})[Symbol.asyncIterator]();
      await subscription.next();
      const live = (await subscription.next()).value.messages[0].content[0]
        .state;
      const persisted = (await subscription.next()).value.messages[0].content[0]
        .state;
      await subscription.return();
      const reopened = globalThis.makePiChatBackend(
        connection,
        globalThis.createPiClient(connection, async () =>
          json({ ...initial, messages: [...initial.messages, message] })
        )
      );
      const history = (
        await reopened.core.message.list({ sessionID: "session" })
      ).data[0].content[0].state;
      return [live, persisted, history].map((state) => ({
        content: state.content,
        status: state.status,
      }));
    }, failed);
    const expected = {
      content: [
        { text: "Captured", type: "text" },
        {
          mime: "image/png",
          type: "file",
          uri: "data:image/png;base64,Zmlyc3Q=",
        },
        {
          mime: "image/jpeg",
          type: "file",
          uri: "data:image/jpeg;base64,c2Vjb25k",
        },
      ],
      status: failed ? "error" : "completed",
    };
    assert.deepEqual(result, [expected, expected, expected]);
  }
  console.log(
    "PASS Pi preserves ordered tool-result images in live completion/error events, persisted results, and reopened history"
  );

  for (const failed of [false, true]) {
    const result = await page.evaluate(async (failed) => {
      const content = [
        { text: "Captured", type: "text" },
        {
          mime: "image/png",
          name: "First.png",
          type: "file",
          uri: "file:///project/First.png",
        },
        {
          mime: "image/jpeg",
          name: "Second.jpg",
          type: "file",
          uri: "https://example.com/Second.jpg",
        },
        {
          mime: "text/plain",
          name: "report.txt",
          type: "file",
          uri: "data:text/plain,report",
        },
      ];
      const owner = { assistantMessageID: "assistant", sessionID: "session" };
      const base = {
        created: 1,
        durable: { aggregateID: "session", seq: 1, version: 1 },
        id: "event",
      };
      const events = [
        {
          ...base,
          data: {
            ...owner,
            agent: "build",
            model: { id: "model", providerID: "provider" },
            started: 1,
          },
          type: "session.step.started",
        },
        {
          ...base,
          data: { ...owner, id: "capture", name: "screenshot" },
          type: "session.tool.input.started",
        },
        {
          ...base,
          data: {
            ...owner,
            content,
            executed: true,
            id: "capture",
            ...(failed
              ? { error: { message: "Capture failed", type: "tool-error" } }
              : {}),
          },
          type: failed ? "session.tool.failed" : "session.tool.success",
        },
      ];
      let history;
      const client = globalThis.createClient(
        { id: "opencode", name: "OpenCode", url: "http://opencode.invalid" },
        async (input) => {
          if (String(input.url || input).includes("/event")) {
            return new Response(
              events
                .map((event) => `data: ${JSON.stringify(event)}\n\n`)
                .join(""),
              { headers: { "Content-Type": "text/event-stream" } }
            );
          }
          return new Response(JSON.stringify({ cursor: {}, data: history }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      );
      const backend = globalThis.makeOpenCodeChatBackend(client);
      let messages = [];
      for await (const event of backend.core.event.subscribe({})) {
        messages = globalThis.projectLiveEvent(messages, event, "session");
      }
      history = messages;
      const live = messages[0].content[0].state;
      const reopened = (
        await globalThis
          .makeOpenCodeChatBackend(client)
          .core.message.list({ sessionID: "session" })
      ).data[0].content[0].state;
      return [live.content, reopened.content];
    }, failed);
    const expected = [
      { text: "Captured", type: "text" },
      {
        mime: "image/png",
        name: "First.png",
        type: "file",
        uri: "file:///project/First.png",
      },
      {
        mime: "image/jpeg",
        name: "Second.jpg",
        type: "file",
        uri: "https://example.com/Second.jpg",
      },
      {
        mime: "text/plain",
        name: "report.txt",
        type: "file",
        uri: "data:text/plain,report",
      },
    ];
    assert.deepEqual(result, [expected, expected]);
  }
  console.log(
    "PASS OpenCode preserves ordered tool-result images and non-image output through live success/failure events and reopened conversation API"
  );
}
