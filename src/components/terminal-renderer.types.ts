import type { TerminalCommand, TerminalEvent } from "../lib/terminal";

export interface TerminalRendererHandle {
  send: (command: TerminalCommand) => void;
}
export interface TerminalRendererProps {
  onEvent: (event: TerminalEvent) => void;
  onError: (message: string) => void;
}
