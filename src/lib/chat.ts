import type { OpenCodeEvent, SessionMessageAssistant, SessionMessageInfo } from '@opencode/client';

export function mergeMessages(...pages: SessionMessageInfo[][]): SessionMessageInfo[] {
  const messages = new Map<string, SessionMessageInfo>();
  for (const page of pages) for (const message of page) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => a.time.created - b.time.created || a.id.localeCompare(b.id));
}

export type ComposerSubmission = { type: 'prompt'; text: string } | { type: 'shell'; command: string } | { type: 'command'; name: string; text: string };

export function parseComposer(text: string, commandNames: string[]): ComposerSubmission {
  const trimmed = text.trim();
  if (trimmed.startsWith('!') && trimmed.slice(1).trim()) return { type: 'shell', command: trimmed.slice(1).trim() };
  const command = /^\/([^\s]+)(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (command && commandNames.includes(command[1])) return { type: 'command', name: command[1], text: command[2] ?? '' };
  return { type: 'prompt', text: trimmed };
}

export function serverFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  if (!path.startsWith('/')) throw new Error('The server file path must be absolute');
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function projectLiveEvent(messages: SessionMessageInfo[], event: OpenCodeEvent, sessionID: string): SessionMessageInfo[] {
  return projectLiveEvents(messages, [event], sessionID);
}

export function projectLiveEvents(messages: SessionMessageInfo[], events: OpenCodeEvent[], sessionID: string): SessionMessageInfo[] {
  if (!events.length) return messages;
  const indices = new Map(messages.map((message, index) => [message.id, index]));
  const changed = new Set<string>();
  let next = messages;
  let inserted = false;
  const store = (assistant: SessionMessageAssistant) => {
    if (next === messages) next = [...messages];
    const index = indices.get(assistant.id);
    if (index === undefined) {
      indices.set(assistant.id, next.length);
      next.push(assistant);
      inserted = true;
    } else next[index] = assistant;
    changed.add(assistant.id);
    return assistant;
  };
  for (const event of events) {
    if (!('sessionID' in event.data) || event.data.sessionID !== sessionID || !('assistantMessageID' in event.data)) continue;
    const messageID = event.data.assistantMessageID;
    if (event.type === 'session.step.started') {
      store({ id: messageID, type: 'assistant', agent: event.data.agent, model: event.data.model, content: [], time: { created: event.data.started } });
      continue;
    }
    const index = indices.get(messageID);
    const current = index === undefined ? undefined : next[index];
    if (!current || current.type !== 'assistant') continue;
    const mutable = () => changed.has(messageID) ? current : store({ ...current, content: [...current.content], time: { ...current.time } });
    if (current.retry && (event.type.startsWith('session.text.') || event.type.startsWith('session.reasoning.') || event.type.startsWith('session.tool.') || event.type.startsWith('session.step.'))) delete mutable().retry;
    const fragment = (kind: 'text' | 'reasoning', ordinal: number) => {
      let count = 0;
      return current.content.findIndex(part => part.type === kind && count++ === ordinal);
    };
    switch (event.type) {
    case 'session.text.started':
    case 'session.reasoning.started': {
      const kind = event.type === 'session.text.started' ? 'text' : 'reasoning';
      if (fragment(kind, event.data.ordinal) < 0) mutable().content.push(kind === 'reasoning' ? { type: kind, text: '', time: { created: event.created } } : { type: kind, text: '' });
      break;
    }
    case 'session.text.delta':
    case 'session.reasoning.delta':
    case 'session.text.ended':
    case 'session.reasoning.ended': {
      const kind = event.type.startsWith('session.text.') ? 'text' : 'reasoning';
      let index = fragment(kind, event.data.ordinal);
      const assistant = mutable();
      if (index < 0) { assistant.content.push(kind === 'reasoning' ? { type: kind, text: '', time: { created: event.created } } : { type: kind, text: '' }); index = assistant.content.length - 1; }
      const part = assistant.content[index];
      if (part.type === 'text' || part.type === 'reasoning') assistant.content[index] = { ...part, text: 'delta' in event.data ? part.text + event.data.delta : event.data.text, ...(part.type === 'reasoning' && event.type === 'session.reasoning.ended' ? { time: { created: part.time?.created ?? event.created, completed: event.created } } : {}) };
      break;
    }
    case 'session.tool.input.started': {
      if (!current.content.some(part => part.type === 'tool' && part.id === event.data.id)) mutable().content.push({ type: 'tool', id: event.data.id, name: event.data.name, state: { status: 'streaming', input: '' }, time: { created: event.created } });
      break;
    }
    case 'session.tool.input.delta':
    case 'session.tool.input.ended':
    case 'session.tool.called':
    case 'session.tool.progress':
    case 'session.tool.success':
    case 'session.tool.failed': {
      const index = current.content.findIndex(part => part.type === 'tool' && part.id === event.data.id);
      const part = current.content[index];
      if (!part || part.type !== 'tool') break;
      if ((event.type === 'session.tool.input.delta' || event.type === 'session.tool.input.ended') && part.state.status !== 'streaming') break;
      if (event.type === 'session.tool.progress' && part.state.status !== 'running') break;
      const tool = { ...part, time: { ...part.time } };
      if (event.type === 'session.tool.input.delta' && tool.state.status === 'streaming') tool.state = { status: 'streaming', input: tool.state.input + event.data.delta };
      if (event.type === 'session.tool.input.ended' && tool.state.status === 'streaming') tool.state = { status: 'streaming', input: event.data.text };
      if (event.type === 'session.tool.called') { tool.executed = event.data.executed; tool.state = { status: 'running', input: event.data.input, metadata: {} }; tool.time.ran = event.created; }
      if (event.type === 'session.tool.progress' && tool.state.status === 'running') tool.state = { ...tool.state, metadata: { ...tool.state.metadata, ...event.data } };
      if (event.type === 'session.tool.success') { tool.state = { status: 'completed', input: typeof tool.state.input === 'string' ? {} : tool.state.input, content: event.data.content, metadata: event.data.metadata }; tool.time.completed = event.created; }
      if (event.type === 'session.tool.failed') { tool.state = { status: 'error', input: typeof tool.state.input === 'string' ? {} : tool.state.input, error: event.data.error, content: event.data.content, metadata: event.data.metadata }; tool.time.completed = event.created; }
      mutable().content[index] = tool;
      break;
    }
    case 'session.step.streamed': mutable().time.streamed = event.created; break;
    case 'session.step.ended': {
      const assistant = mutable();
      assistant.time.completed = event.created; assistant.finish = event.data.finish; assistant.cost = event.data.cost; assistant.tokens = event.data.tokens;
      break;
    }
    case 'session.step.failed': {
      const assistant = mutable();
      assistant.time.completed = event.created; assistant.finish = 'error'; assistant.error = event.data.error;
      break;
    }
    case 'session.retry.scheduled': mutable().retry = { attempt: event.data.attempt, at: event.data.at, error: event.data.error }; break;
    }
  }
  if (inserted) next.sort((a, b) => a.time.created - b.time.created || a.id.localeCompare(b.id));
  return next;
}
