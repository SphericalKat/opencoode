import type {
  SessionInfo,
  SessionMessageInfo,
  SessionStatus,
} from "@opencode/client";

import type { Client } from "./client";

export interface ChatCore {
  session: Pick<
    Client["session"],
    "get" | "active" | "switchModel" | "update" | "fork"
  > & {
    prompt: (...args: Parameters<Client["session"]["prompt"]>) => Promise<void>;
    interrupt: (
      ...args: Parameters<Client["session"]["interrupt"]>
    ) => Promise<void>;
    compact: (
      ...args: Parameters<Client["session"]["compact"]>
    ) => Promise<void>;
  };
  message: Pick<Client["message"], "list">;
  model: Pick<Client["model"], "list">;
  event?: Pick<Client["event"], "subscribe">;
}

export interface ChatCapabilities {
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
}

export interface ChatBackendSnapshot {
  session: SessionInfo;
  messages: SessionMessageInfo[];
  active: boolean;
  status?: SessionStatus | null;
  activityNotice?: string;
  waiting?: { kind: "approval" | "question"; title: string };
}

export interface ChatBackend {
  kind: "opencode" | "pi";
  core: ChatCore;
  capabilities: ChatCapabilities;
  opencodeClient?: Client;
  activityNotice?: string;
  canForkMessage?: (message: SessionMessageInfo) => boolean;
  subscribe?: (options: {
    signal?: AbortSignal;
  }) => AsyncIterable<ChatBackendSnapshot>;
}

export const makeOpenCodeChatBackend = (client: Client): ChatBackend => ({
  capabilities: {
    agents: true,
    archive: true,
    attachments: true,
    background: true,
    children: true,
    commands: true,
    compact: true,
    context: true,
    defaultVariant: true,
    delivery: true,
    diff: true,
    export: true,
    files: true,
    forkMessage: true,
    forkSession: true,
    forms: true,
    inbox: true,
    instructions: true,
    move: true,
    permissions: true,
    remove: true,
    rename: true,
    resources: true,
    schedules: true,
    shell: true,
    sideQuestion: true,
    skills: true,
    statistics: true,
  },
  core: {
    event: { subscribe: client.event.subscribe },
    message: { list: client.message.list },
    model: { list: client.model.list },
    session: {
      active: client.session.active,
      compact: async (...args) => {
        await client.session.compact(...args);
      },
      fork: client.session.fork,
      get: client.session.get,
      interrupt: async (...args) => {
        await client.session.interrupt(...args);
      },
      prompt: async (...args) => {
        await client.session.prompt(...args);
      },
      switchModel: client.session.switchModel,
      update: client.session.update,
    },
  },
  kind: "opencode",
  opencodeClient: client,
});
