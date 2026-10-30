export const PI_MOBILE_PROTOCOL = 1;

export type PiModel = { id: string; provider: string; name: string; reasoning: boolean; contextWindow: number; thinkingLevels: string[] };
export type PiContent =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'toolCall'; id: string; name: string; arguments: Record<string, unknown> }
  | { type: 'image'; mimeType: string; data: string };
export type PiMessage = {
  id: string;
  role: 'user' | 'assistant' | 'toolResult' | 'custom';
  content: PiContent[];
  timestamp: number;
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  errorMessage?: string;
};
export type PiSession = {
  id: string;
  name: string;
  cwd: string;
  idle: boolean;
  model?: PiModel;
  thinkingLevel: string;
  context?: { tokens: number | null; contextWindow: number; percent: number | null };
};
export type PiServerInfo = {
  backend: 'pi';
  protocol: 1;
  version: string;
  instanceID: string;
  session: PiSession;
};
export type PiToolActivity = { id: string; name: string; input: Record<string, unknown>; output?: string; status: 'running' | 'completed' | 'error' };
export type PiSnapshot = {
  cursor: number;
  instanceID: string;
  session: PiSession;
  messages: PiMessage[];
  tools: PiToolActivity[];
  waiting?: { kind: string; title?: string };
};
export type PiSessionSummary = { id: string; name: string; cwd: string; updated: number; active: boolean };
export type PiEvent =
  | { type: 'message'; message: PiMessage }
  | { type: 'tool'; tool: PiToolActivity }
  | { type: 'session'; session: PiSession }
  | { type: 'waiting'; waiting?: { kind: string; title?: string } }
  | { type: 'reset' };
export type PiEventBatch = { cursor: number; instanceID: string; events: PiEvent[]; reset?: boolean };
export type PiCommand =
  | { type: 'prompt'; text: string; delivery?: 'steer' | 'followUp'; images?: { mimeType: string; data: string }[] }
  | { type: 'abort' }
  | { type: 'compact'; instructions?: string }
  | { type: 'model'; provider: string; id: string }
  | { type: 'thinking'; level: string }
  | { type: 'rename'; name: string }
  | { type: 'new' }
  | { type: 'switch'; sessionID: string }
  | { type: 'fork'; entryID: string };
