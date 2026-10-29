import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { terminalHtml } from '../generated/terminal-html';
import { terminalEvent } from '../lib/terminal';
import { useTheme } from '../lib/theme';
import type { TerminalRendererHandle, TerminalRendererProps } from './TerminalRenderer.types';

const source = { html: terminalHtml, baseUrl: 'about:blank' };

export const TerminalRenderer = forwardRef<TerminalRendererHandle, TerminalRendererProps>(function TerminalRenderer({ onEvent, onError }, ref) {
  const { colors } = useTheme();
  const view = useRef<WebView<object>>(null);
  useImperativeHandle(ref, () => ({
    send: command => view.current?.postMessage(JSON.stringify({ channel: 'opencoode-terminal', ...command })),
  }), []);
  return <WebView<object>
    ref={view}
    source={source}
    style={{ flex: 1, backgroundColor: colors.bg }}
    originWhitelist={['*']}
    onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
    onMessage={event => {
      try {
        const data: unknown = JSON.parse(event.nativeEvent.data);
        if (!data || typeof data !== 'object' || !('channel' in data) || data.channel !== 'opencoode-terminal') return;
        const parsed = terminalEvent(data);
        if (parsed) onEvent(parsed);
      } catch { return; }
    }}
    onError={event => onError(event.nativeEvent.description)}
    onContentProcessDidTerminate={() => onError('The terminal view stopped. Reopen the terminal to restore it.')}
    javaScriptCanOpenWindowsAutomatically={false}
    allowFileAccess={false}
    allowUniversalAccessFromFileURLs={false}
    setSupportMultipleWindows={false}
    mixedContentMode="never"
    keyboardDisplayRequiresUserAction={false}
    hideKeyboardAccessoryView={false}
    scrollEnabled={false}
    bounces={false}
    textZoom={100}
  />;
});
