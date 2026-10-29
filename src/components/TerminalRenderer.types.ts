import type { TerminalCommand, TerminalEvent } from '../lib/terminal';

export type TerminalRendererHandle = { send: (command: TerminalCommand) => void };
export type TerminalRendererProps = {
  onEvent: (event: TerminalEvent) => void;
  onError: (message: string) => void;
};
