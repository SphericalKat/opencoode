export type TerminalEvent =
  | { type: 'ready' }
  | { type: 'input'; data: string; binary?: boolean }
  | { type: 'resize'; cols: number; rows: number };

export type TerminalPalette = {
  background: string; foreground: string; cursor: string; cursorAccent: string; selectionBackground: string;
  black: string; brightBlack: string; red: string; brightRed: string; green: string; brightGreen: string;
  blue: string; brightBlue: string; white: string; brightWhite: string;
};

export type TerminalCommand = { type: 'output'; data: string } | { type: 'focus' } | { type: 'theme'; colors: TerminalPalette }
  | { type: 'restore'; checkpoint: string; cols: number; rows: number } | { type: 'inputEnabled'; enabled: boolean };

export function persistentPtySocketUrl(server: string, ptyID: string, ticket: string, options: {
  cursor: number; attachmentID: string; takeover?: boolean; role?: 'controller' | 'observer';
}): string {
  const url = new URL(`${server.replace(/\/+$/, '')}/api/experimental/persistent-pty/${encodeURIComponent(ptyID)}/connect`);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Use an HTTP or HTTPS server URL');
  if (url.username || url.password) throw new Error('Server URLs cannot contain credentials');
  if (!Number.isSafeInteger(options.cursor) || options.cursor < 0) throw new Error('Invalid terminal output position');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('ticket', ticket);
  url.searchParams.set('cursor', String(options.cursor));
  url.searchParams.set('attachment_id', options.attachmentID);
  url.searchParams.set('role', options.role ?? 'controller');
  url.searchParams.set('takeover', String(options.takeover ?? false));
  url.searchParams.set('input_protocol', '1');
  return url.toString();
}

export function persistentInputFrame(size: { cols: number; rows: number }, data?: Uint8Array): ArrayBuffer {
  if (!Number.isInteger(size.cols) || !Number.isInteger(size.rows) || size.cols < 1 || size.rows < 1 || size.cols > 65535 || size.rows > 65535) {
    throw new Error('Invalid terminal size');
  }
  const frame = new Uint8Array(5 + (data?.byteLength ?? 0));
  const view = new DataView(frame.buffer);
  frame[0] = data ? 1 : 0;
  view.setUint16(1, size.cols);
  view.setUint16(3, size.rows);
  if (data) frame.set(data, 5);
  return frame.buffer;
}

export function terminalEvent(value: unknown): TerminalEvent | undefined {
  if (!value || typeof value !== 'object' || !('type' in value)) return;
  if (value.type === 'ready') return { type: 'ready' };
  if (value.type === 'input' && 'data' in value && typeof value.data === 'string') {
    return { type: 'input', data: value.data, binary: 'binary' in value && value.binary === true };
  }
  if (value.type === 'resize' && 'cols' in value && 'rows' in value
    && Number.isInteger(value.cols) && Number.isInteger(value.rows)
    && Number(value.cols) >= 2 && Number(value.cols) <= 1000
    && Number(value.rows) >= 1 && Number(value.rows) <= 1000) {
    return { type: 'resize', cols: Number(value.cols), rows: Number(value.rows) };
  }
}

export function ptySocketUrl(server: string, directory: string, ptyID: string, ticket: string, cursor?: number): string {
  const url = new URL(`${server.replace(/\/+$/, '')}/api/pty/${encodeURIComponent(ptyID)}/connect`);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Use an HTTP or HTTPS server URL');
  if (url.username || url.password) throw new Error('Server URLs cannot contain credentials');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('location[directory]', directory);
  url.searchParams.set('ticket', ticket);
  if (cursor !== undefined) {
    if (!Number.isSafeInteger(cursor) || cursor < 0) throw new Error('Invalid terminal output position');
    url.searchParams.set('cursor', String(cursor));
  }
  return url.toString();
}

export function ptyControlCursor(bytes: ArrayBuffer): number | undefined {
  const data = new Uint8Array(bytes);
  if (data[0] !== 0) return;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(data.subarray(1)));
    if (value && typeof value === 'object' && 'cursor' in value
      && typeof value.cursor === 'number' && Number.isSafeInteger(value.cursor) && value.cursor >= 0) {
      return value.cursor;
    }
  } catch {
    return;
  }
}
