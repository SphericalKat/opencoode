import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import type { ForwardedRef } from "react";

import { terminalHtml } from "../generated/terminal-html";
import { terminalEvent } from "../lib/terminal";
import { useTheme } from "../lib/theme";
import type {
  TerminalRendererHandle,
  TerminalRendererProps,
} from "./terminal-renderer.types";

const TerminalRendererBase = (
  { onEvent, onError }: TerminalRendererProps,
  ref: ForwardedRef<TerminalRendererHandle>
) => {
  const { colors } = useTheme();
  const frame = useRef<HTMLIFrameElement>(null);
  const onEventRef = useRef(onEvent);
  useLayoutEffect(() => {
    onEventRef.current = onEvent;
  });
  useImperativeHandle(
    ref,
    () => ({
      send: (command) =>
        frame.current?.contentWindow?.postMessage(
          JSON.stringify({ channel: "opencoode-terminal", ...command }),
          "*"
        ),
    }),
    []
  );
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) {
        return;
      }
      try {
        const data: unknown =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (
          !data ||
          typeof data !== "object" ||
          !("channel" in data) ||
          data.channel !== "opencoode-terminal"
        ) {
          return;
        }
        const parsed = terminalEvent(data);
        if (parsed) {
          onEventRef.current(parsed);
        }
      } catch {
        // Ignore messages that are not valid terminal events.
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  return (
    <iframe
      ref={frame}
      title="Remote terminal"
      srcDoc={terminalHtml}
      sandbox="allow-scripts"
      onError={() => onError("The terminal view did not load")}
      style={{
        background: colors.bg,
        border: 0,
        flex: 1,
        height: "100%",
        minHeight: 0,
        width: "100%",
      }}
    />
  );
};

export const TerminalRenderer = forwardRef<
  TerminalRendererHandle,
  TerminalRendererProps
>(TerminalRendererBase);
