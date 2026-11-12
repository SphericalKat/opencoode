import assert from 'node:assert/strict';

export async function verifyBackendImages(page) {
  for (const failed of [false, true]) {
    const result = await page.evaluate(async failed => {
      const connection = { id: 'pi', name: 'Pi', url: 'http://pi.invalid' };
      const content = [{ type: 'text', text: 'Captured' }, { type: 'image', mimeType: 'image/png', data: 'Zmlyc3Q=' }, { type: 'image', mimeType: 'image/jpeg', data: 'c2Vjb25k' }];
      const initial = {
        cursor: 0, instanceID: 'server', session: { id: 'session', cwd: '/project', name: 'Images', idle: false, thinkingLevel: '' }, tools: [],
        messages: [{ id: 'assistant', role: 'assistant', timestamp: 1, content: [{ type: 'toolCall', id: 'capture', name: 'screenshot', arguments: {} }] }],
      };
      const completed = { id: 'capture', name: 'screenshot', input: {}, status: failed ? 'error' : 'completed', output: 'Captured', content };
      const message = { id: 'result', timestamp: 2, role: 'toolResult', toolCallId: 'capture', content, isError: failed };
      const events = [
        { cursor: 1, instanceID: 'server', events: [{ type: 'tool', tool: completed }] },
        { cursor: 2, instanceID: 'server', events: [{ type: 'message', message }] },
      ];
      const json = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
      const pi = globalThis.createPiClient(connection, async url => json(String(url).includes('/pi/events') ? events.shift() : initial));
      const backend = globalThis.makePiChatBackend(connection, pi);
      const subscription = backend.subscribe({})[Symbol.asyncIterator]();
      await subscription.next();
      const live = (await subscription.next()).value.messages[0].content[0].state;
      const persisted = (await subscription.next()).value.messages[0].content[0].state;
      await subscription.return();
      const reopened = globalThis.makePiChatBackend(connection, globalThis.createPiClient(connection, async () => json({ ...initial, messages: [...initial.messages, message] })));
      const history = (await reopened.core.message.list({ sessionID: 'session' })).data[0].content[0].state;
      return [live, persisted, history].map(state => ({ status: state.status, content: state.content }));
    }, failed);
    const expected = { status: failed ? 'error' : 'completed', content: [
      { type: 'text', text: 'Captured' },
      { type: 'file', mime: 'image/png', uri: 'data:image/png;base64,Zmlyc3Q=' },
      { type: 'file', mime: 'image/jpeg', uri: 'data:image/jpeg;base64,c2Vjb25k' },
    ] };
    assert.deepEqual(result, [expected, expected, expected]);
  }
  console.log('PASS Pi preserves ordered tool-result images in live completion/error events, persisted results, and reopened history');

  for (const failed of [false, true]) {
    const result = await page.evaluate(async failed => {
      const content = [
        { type: 'text', text: 'Captured' },
        { type: 'file', name: 'First.png', mime: 'image/png', uri: 'file:///project/First.png' },
        { type: 'file', name: 'Second.jpg', mime: 'image/jpeg', uri: 'https://example.com/Second.jpg' },
        { type: 'file', name: 'report.txt', mime: 'text/plain', uri: 'data:text/plain,report' },
      ];
      const owner = { sessionID: 'session', assistantMessageID: 'assistant' };
      const base = { id: 'event', created: 1, durable: { aggregateID: 'session', seq: 1, version: 1 } };
      const events = [
        { ...base, type: 'session.step.started', data: { ...owner, agent: 'build', model: { id: 'model', providerID: 'provider' }, started: 1 } },
        { ...base, type: 'session.tool.input.started', data: { ...owner, id: 'capture', name: 'screenshot' } },
        { ...base, type: failed ? 'session.tool.failed' : 'session.tool.success', data: { ...owner, id: 'capture', executed: true, content, ...(failed ? { error: { type: 'tool-error', message: 'Capture failed' } } : {}) } },
      ];
      let history;
      const client = globalThis.createClient({ id: 'opencode', name: 'OpenCode', url: 'http://opencode.invalid' }, async input => {
        if (String(input.url || input).includes('/event')) return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
        return new Response(JSON.stringify({ data: history, cursor: {} }), { headers: { 'Content-Type': 'application/json' } });
      });
      const backend = globalThis.makeOpenCodeChatBackend(client);
      let messages = [];
      for await (const event of backend.core.event.subscribe({})) messages = globalThis.projectLiveEvent(messages, event, 'session');
      history = messages;
      const live = messages[0].content[0].state;
      const reopened = (await globalThis.makeOpenCodeChatBackend(client).core.message.list({ sessionID: 'session' })).data[0].content[0].state;
      return [live.content, reopened.content];
    }, failed);
    const expected = [
      { type: 'text', text: 'Captured' },
      { type: 'file', name: 'First.png', mime: 'image/png', uri: 'file:///project/First.png' },
      { type: 'file', name: 'Second.jpg', mime: 'image/jpeg', uri: 'https://example.com/Second.jpg' },
      { type: 'file', name: 'report.txt', mime: 'text/plain', uri: 'data:text/plain,report' },
    ];
    assert.deepEqual(result, [expected, expected]);
  }
  console.log('PASS OpenCode preserves ordered tool-result images and non-image output through live success/failure events and reopened conversation API');
}
