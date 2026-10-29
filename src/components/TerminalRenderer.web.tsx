import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { terminalHtml } from '../generated/terminal-html';
import { terminalEvent } from '../lib/terminal';
import { useTheme } from '../lib/theme';
import type { TerminalRendererHandle, TerminalRendererProps } from './TerminalRenderer.types';

export const TerminalRenderer = forwardRef<TerminalRendererHandle, TerminalRendererProps>(function TerminalRenderer({ onEvent, onError }, ref) {
  const { colors } = useTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  useImperativeHandle(ref, () => ({
    send: command => frame.current?.contentWindow?.postMessage(JSON.stringify({ channel: 'opencoode-terminal', ...command }), '*'),
  }), []);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      try {
        const data: unknown = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || typeof data !== 'object' || !('channel' in data) || data.channel !== 'opencoode-terminal') return;
        const parsed = terminalEvent(data);
        if (parsed) onEventRef.current(parsed);
      } catch { return; }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  return <iframe ref={frame} title="Remote terminal" srcDoc={terminalHtml} sandbox="allow-scripts" onError={() => onError('The terminal view did not load')} style={{ border: 0, flex: 1, width: '100%', height: '100%', background: colors.bg, minHeight: 0 }} />;
});
