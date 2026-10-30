import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createStreamBatch } from '../src/lib/streamBatch';

test('stream batches preserve Unicode and event order with one render per interval', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const batches: string[][] = [];
    const stream = createStreamBatch<string>(events => batches.push(events));
    stream.push('α');
    stream.push('🙂');
    stream.push('世界');
    mock.timers.tick(49);
    assert.deepEqual(batches, []);
    mock.timers.tick(1);
    assert.deepEqual(batches, [['α', '🙂', '世界']]);
    stream.push('Next');
    mock.timers.tick(50);
    assert.deepEqual(batches, [['α', '🙂', '世界'], ['Next']]);
  } finally { mock.timers.reset(); }
});

test('stream flush places pending deltas before a terminal event and cancels the old timer', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const rendered: string[] = [];
    const stream = createStreamBatch<string>(events => rendered.push(...events));
    stream.push('partial');
    stream.flush();
    rendered.push('completed');
    stream.push('next turn');
    mock.timers.tick(50);
    assert.deepEqual(rendered, ['partial', 'completed', 'next turn']);
    mock.timers.tick(100);
    assert.deepEqual(rendered, ['partial', 'completed', 'next turn']);
  } finally { mock.timers.reset(); }
});

test('stream clear discards stale session data and permits a fresh batch', () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const rendered: string[] = [];
    const stream = createStreamBatch<string>(events => rendered.push(...events));
    stream.push('old session');
    stream.clear();
    mock.timers.tick(50);
    assert.deepEqual(rendered, []);
    stream.push('current session');
    mock.timers.tick(50);
    assert.deepEqual(rendered, ['current session']);
  } finally { mock.timers.reset(); }
});
