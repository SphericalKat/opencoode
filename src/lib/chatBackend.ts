import type { SessionInfo, SessionMessageInfo, SessionStatus } from '@opencode/client';
import type { Client } from './client';

export type ChatCore = {
  session: Pick<Client['session'], 'get' | 'active' | 'switchModel' | 'update' | 'fork'> & {
    prompt: (...args: Parameters<Client['session']['prompt']>) => Promise<void>;
    interrupt: (...args: Parameters<Client['session']['interrupt']>) => Promise<void>;
    compact: (...args: Parameters<Client['session']['compact']>) => Promise<void>;
  };
  message: Pick<Client['message'], 'list'>;
  model: Pick<Client['model'], 'list'>;
  event?: Pick<Client['event'], 'subscribe'>;
};

export type ChatCapabilities = {
  attachments: boolean;
  delivery: boolean;
  defaultVariant: boolean;
  rename: boolean;
  forkSession: boolean;
  forkMessage: boolean;
  compact: boolean;
  archive: boolean;
  remove: boolean;
  move: boolean;
  files: boolean;
  agents: boolean;
  commands: boolean;
  skills: boolean;
  shell: boolean;
  inbox: boolean;
  forms: boolean;
  permissions: boolean;
  diff: boolean;
  context: boolean;
  export: boolean;
  instructions: boolean;
  schedules: boolean;
  background: boolean;
  children: boolean;
  sideQuestion: boolean;
  resources: boolean;
  statistics: boolean;
};

export type ChatBackendSnapshot = {
  session: SessionInfo;
  messages: SessionMessageInfo[];
  active: boolean;
  status?: SessionStatus | null;
  activityNotice?: string;
  waiting?: { kind: 'approval' | 'question'; title: string };
};

export type ChatBackend = {
  kind: 'opencode' | 'pi';
  core: ChatCore;
  capabilities: ChatCapabilities;
  opencodeClient?: Client;
  activityNotice?: string;
  canForkMessage?: (message: SessionMessageInfo) => boolean;
  subscribe?: (options: { signal?: AbortSignal }) => AsyncIterable<ChatBackendSnapshot>;
};

export function makeOpenCodeChatBackend(client: Client): ChatBackend {
  return {
    kind: 'opencode',
    core: {
      session: {
        get: client.session.get,
        active: client.session.active,
        switchModel: client.session.switchModel,
        update: client.session.update,
        fork: client.session.fork,
        prompt: async (...args) => { await client.session.prompt(...args); },
        interrupt: async (...args) => { await client.session.interrupt(...args); },
        compact: async (...args) => { await client.session.compact(...args); },
      },
      message: { list: client.message.list },
      model: { list: client.model.list },
      event: { subscribe: client.event.subscribe },
    },
    capabilities: {
      attachments: true,
      delivery: true,
      defaultVariant: true,
      rename: true,
      forkSession: true,
      forkMessage: true,
      compact: true,
      archive: true,
      remove: true,
      move: true,
      files: true,
      agents: true,
      commands: true,
      skills: true,
      shell: true,
      inbox: true,
      forms: true,
      permissions: true,
      diff: true,
      context: true,
      export: true,
      instructions: true,
      schedules: true,
      background: true,
      children: true,
      sideQuestion: true,
      resources: true,
      statistics: true,
    },
    opencodeClient: client,
  };
}
