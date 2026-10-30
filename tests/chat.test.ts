import assert from 'node:assert/strict';
import test from 'node:test';
import type { OpenCodeEvent, SessionMessageAssistant, SessionMessageInfo } from '@opencode/client';
import { mergeMessages, parseComposer, projectLiveEvent, serverFileUri } from '../src/lib/chat';
import { createStreamBatch } from '../src/lib/streamBatch';

const base = { id: 'event', created: 1, durable: { aggregateID: 's1', seq: 1, version: 1 as const } };
const owned = { sessionID: 's1', assistantMessageID: 'a1' };

test('chat displays text and reasoning deltas with independent fragment ordinals', () => {
  const events: OpenCodeEvent[] = [
    { ...base, type: 'session.step.started', data: { ...owned, agent: 'build', model: { id: 'm', providerID: 'p' }, started: 1 } },
    { ...base, type: 'session.reasoning.started', data: { ...owned, ordinal: 0 } },
    { ...base, type: 'session.reasoning.delta', data: { ...owned, ordinal: 0, delta: 'Think' } },
    { ...base, type: 'session.text.started', data: { ...owned, ordinal: 0 } },
    { ...base, type: 'session.text.delta', data: { ...owned, ordinal: 0, delta: 'Hello ' } },
    { ...base, type: 'session.text.delta', data: { ...owned, ordinal: 0, delta: 'world' } },
    { ...base, type: 'session.text.ended', data: { ...owned, ordinal: 0, text: 'Hello world!' } },
  ];
  const messages = events.reduce((current, event) => projectLiveEvent(current, event, 's1'), [] as SessionMessageInfo[]);
  const message = messages[0] as SessionMessageAssistant;
  assert.deepEqual(message.content, [{ type: 'reasoning', text: 'Think' }, { type: 'text', text: 'Hello world!' }]);
  assert.equal(projectLiveEvent(messages, { ...base, type: 'session.text.delta', data: { ...owned, sessionID: 'other', ordinal: 0, delta: 'leak' } }, 's1'), messages);
});

test('chat updates the right concurrent tool and preserves the terminal result', () => {
  const events: OpenCodeEvent[] = [
    { ...base, type: 'session.step.started', data: { ...owned, agent: 'build', model: { id: 'm', providerID: 'p' }, started: 1 } },
    { ...base, type: 'session.tool.input.started', data: { ...owned, id: 'one', name: 'read' } },
    { ...base, type: 'session.tool.input.started', data: { ...owned, id: 'two', name: 'shell' } },
    { ...base, type: 'session.tool.input.delta', data: { ...owned, id: 'one', delta: '{"path":' } },
    { ...base, type: 'session.tool.input.delta', data: { ...owned, id: 'one', delta: '"a"}' } },
    { ...base, type: 'session.tool.called', data: { ...owned, id: 'one', input: { path: 'a' }, executed: true } },
    { ...base, durable: { ...base.durable, version: 2 }, type: 'session.tool.success', data: { ...owned, id: 'one', executed: true, content: [{ type: 'text', text: 'Contents' }] } },
  ];
  const message = events.reduce((current, event) => projectLiveEvent(current, event, 's1'), [] as SessionMessageInfo[])[0] as SessionMessageAssistant;
  const [first, second] = message.content;
  assert.equal(first.type, 'tool');
  if (first.type === 'tool') assert.deepEqual(first.state, { status: 'completed', input: { path: 'a' }, content: [{ type: 'text', text: 'Contents' }], metadata: undefined });
  assert.equal(second.type, 'tool');
  if (second.type === 'tool') assert.deepEqual(second.state, { status: 'streaming', input: '' });
});

test('composer routes registered commands and shell input while preserving absolute paths as prompts', () => {
  assert.deepEqual(parseComposer('/review file.ts\nCheck errors', ['review']), { type: 'command', name: 'review', text: 'file.ts\nCheck errors' });
  assert.deepEqual(parseComposer('/Users/me/project', ['review']), { type: 'prompt', text: '/Users/me/project' });
  assert.deepEqual(parseComposer('! pwd', []), { type: 'shell', command: 'pwd' });
  assert.deepEqual(parseComposer('!', []), { type: 'prompt', text: '!' });
  assert.equal(serverFileUri('/a/file #1.ts'), 'file:///a/file%20%231.ts');
  assert.throws(() => serverFileUri('../phone/file'), /absolute/);
});

test('message pages deduplicate overlap and retain the latest content in chronological order', () => {
  const early: SessionMessageInfo = { id: 'one', type: 'user', text: 'Before', time: { created: 1 } };
  const late: SessionMessageInfo = { id: 'two', type: 'user', text: 'Later', time: { created: 2 } };
  const updated = { ...early, text: 'After' };
  assert.deepEqual(mergeMessages([late, early], [updated]), [updated, late]);
});

test('batched token updates flush before the authoritative text end and cannot append afterward', async () => {
  let messages: SessionMessageInfo[] = [];
  const batch = createStreamBatch<OpenCodeEvent>(events => { messages = events.reduce((current, event) => projectLiveEvent(current, event, 's1'), messages); }, { delayMs: 50 });
  const dispatch = (event: OpenCodeEvent) => {
    if (event.type.endsWith('.delta')) batch.push(event);
    else { batch.flush(); messages = projectLiveEvent(messages, event, 's1'); }
  };
  dispatch({ ...base, type: 'session.step.started', data: { ...owned, agent: 'build', model: { id: 'm', providerID: 'p' }, started: 1 } });
  dispatch({ ...base, type: 'session.text.started', data: { ...owned, ordinal: 0 } });
  dispatch({ ...base, type: 'session.text.delta', data: { ...owned, ordinal: 0, delta: 'Hello ' } });
  dispatch({ ...base, type: 'session.text.delta', data: { ...owned, ordinal: 0, delta: 'world' } });
  dispatch({ ...base, type: 'session.text.ended', data: { ...owned, ordinal: 0, text: 'Hello world!' } });
  assert.deepEqual((messages[0] as SessionMessageAssistant).content, [{ type: 'text', text: 'Hello world!' }]);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.deepEqual((messages[0] as SessionMessageAssistant).content, [{ type: 'text', text: 'Hello world!' }]);
  batch.clear();
});
