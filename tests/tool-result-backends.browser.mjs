import assert from "node:assert/strict";

const verifyPiImages = async (page, failed) => {
  const result = await page.evaluate(async (isFailed) => {
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
      status: isFailed ? "error" : "completed",
    };
    const message = {
      content,
      id: "result",
      isError: isFailed,
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
    const pi = globalThis.createPiClient(connection, (url) =>
      Promise.resolve(
        Response.json(
          String(url).includes("/pi/events") ? events.shift() : initial
        )
      )
    );
    const backend = globalThis.makePiChatBackend(connection, pi);
    const subscription = backend.subscribe({})[Symbol.asyncIterator]();
    await subscription.next();
    const liveUpdate = await subscription.next();
    const live = liveUpdate.value.messages[0].content[0].state;
    const persistedUpdate = await subscription.next();
    const persisted = persistedUpdate.value.messages[0].content[0].state;
    await subscription.return();
    const reopened = globalThis.makePiChatBackend(
      connection,
      globalThis.createPiClient(connection, () =>
        Promise.resolve(
          Response.json({
            ...initial,
            messages: [...initial.messages, message],
          })
        )
      )
    );
    const listed = await reopened.core.message.list({ sessionID: "session" });
    const history = listed.data[0].content[0].state;
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
};

const verifyOpenCodeImages = async (page, failed) => {
  const result = await page.evaluate(async (isFailed) => {
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
          ...(isFailed
            ? { error: { message: "Capture failed", type: "tool-error" } }
            : {}),
        },
        type: isFailed ? "session.tool.failed" : "session.tool.success",
      },
    ];
    const stored = {};
    const client = globalThis.createClient(
      { id: "opencode", name: "OpenCode", url: "http://opencode.invalid" },
      (input) => {
        if (String(input.url || input).includes("/event")) {
          return Promise.resolve(
            new Response(
              events
                .map((event) => `data: ${JSON.stringify(event)}\n\n`)
                .join(""),
              { headers: { "Content-Type": "text/event-stream" } }
            )
          );
        }
        return Promise.resolve(
          Response.json({ cursor: {}, data: stored.history })
        );
      }
    );
    const backend = globalThis.makeOpenCodeChatBackend(client);
    let messages = [];
    for await (const event of backend.core.event.subscribe({})) {
      messages = globalThis.projectLiveEvent(messages, event, "session");
    }
    stored.history = messages;
    const live = messages[0].content[0].state;
    const listed = await globalThis
      .makeOpenCodeChatBackend(client)
      .core.message.list({ sessionID: "session" });
    const reopened = listed.data[0].content[0].state;
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
};

export const verifyBackendImages = async (page) => {
  await verifyPiImages(page, false);
  await verifyPiImages(page, true);
  console.log(
    "PASS Pi preserves ordered tool-result images in live completion/error events, persisted results, and reopened history"
  );
  await verifyOpenCodeImages(page, false);
  await verifyOpenCodeImages(page, true);
  console.log(
    "PASS OpenCode preserves ordered tool-result images and non-image output through live success/failure events and reopened conversation API"
  );
};
