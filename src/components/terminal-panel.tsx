import type { Pty } from "@opencode/client";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { errorMessage } from "../lib/client";
import type { Client, Connection } from "../lib/client";
import { withAlpha } from "../lib/color";
import { useSheetCoordinator } from "../lib/sheets";
import {
  bufferEdit,
  persistentInputFrame,
  persistentPtySocketUrl,
  ptyControlCursor,
  ptySocketUrl,
} from "../lib/terminal";
import type { TerminalEvent } from "../lib/terminal";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { EdgeFade, useHorizontalEdges } from "./edge-fade";
import { IconButton } from "./icon-button";
import { useSnackbarInset, useUndoableRemoval } from "./snackbar";
import { TerminalRenderer } from "./terminal-renderer";
import type { TerminalRendererHandle } from "./terminal-renderer.types";
import {
  Busy,
  Button,
  Empty,
  ErrorNotice,
  BodyText,
  sans,
  usePressFeedback,
} from "./ui";

interface Props {
  client: Client;
  connection: Connection;
  directory: string;
  sessionID?: string;
}
type Mode = "desktop" | "workspace";
type ConnectionStatus = "connecting" | "connected" | "disconnected";
type ControlMessage = object & Record<"type", unknown>;
const sixDigitHex = /^#[0-9a-f]{6}$/iu;
const selectionColor = (
  colors: ThemeColors,
  scheme: "light" | "dark"
): string =>
  sixDigitHex.test(colors.text)
    ? withAlpha(colors.text, scheme === "dark" ? 0.25 : 0.2)
    : colors.selected;
const MAX_BUFFER_LENGTH = 256;
const SIZE_DEBOUNCE_MS = 120;
const STRIP_PADDING = 12;
const KEY_BAR_GAP = 4;
const KEY_BAR_HEIGHT = 48;
const KEY_BAR_PADDING = 8;
const BACKSPACE = "\u007F";
const terminalKeys = [
  ["Ctrl C", "Control C", "\u0003"],
  ["Esc", "Escape", "\u001B"],
  ["Tab", "Tab", "\t"],
  ["←", "Left arrow", "\u001B[D"],
  ["↓", "Down arrow", "\u001B[B"],
  ["↑", "Up arrow", "\u001B[A"],
  ["→", "Right arrow", "\u001B[C"],
  ["Enter", "Enter", "\r"],
] as const;

const newAttachmentID = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const binaryBytes = (data: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(data, (char) => char.codePointAt(0) ?? 0);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    keyBar: {
      backgroundColor: colors.bg,
      borderColor: colors.border,
      borderTopWidth: 1,
      flexShrink: 0,
      height: KEY_BAR_HEIGHT,
      paddingBottom: 4,
    },
    keyBarContent: {
      alignItems: "center",
      flexGrow: 1,
      gap: KEY_BAR_GAP,
      paddingHorizontal: KEY_BAR_PADDING,
    },
    key: { flexGrow: 1, minWidth: 32 },
    keyboardInput: {
      bottom: 0,
      height: 1,
      left: 0,
      opacity: 0,
      position: "absolute",
      width: 1,
    },
    notice: { flexShrink: 0, paddingBottom: 8, paddingHorizontal: 16 },
    panel: { flex: 1, minHeight: 0 },
    selectedChip: {
      backgroundColor: colors.panel,
      borderColor: colors.borderMuted,
    },
    session: { flex: 1, minHeight: 0 },
    chip: {
      alignItems: "center",
      borderColor: "transparent",
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 8,
      height: 28,
      maxWidth: 240,
      overflow: "hidden",
      paddingEnd: 3,
      paddingStart: 8,
    },
    chipText: {
      flexShrink: 1,
      fontFamily: sans,
      fontSize: 13,
      fontVariant: ["tabular-nums"],
      fontWeight: "400",
      letterSpacing: -0.04,
      lineHeight: 16,
    },
    chipTitle: {
      alignItems: "center",
      alignSelf: "stretch",
      flexShrink: 1,
      justifyContent: "center",
    },
    strip: {
      backgroundColor: colors.bg,
      borderBottomWidth: 1,
      borderColor: colors.border,
      flexShrink: 0,
      height: 49,
    },
    stripContent: {
      alignItems: "center",
      flexGrow: 1,
      gap: 8,
      paddingEnd: STRIP_PADDING,
      paddingStart: STRIP_PADDING,
    },
    terminal: {
      backgroundColor: colors.bg,
      flex: 1,
      minHeight: 0,
    },
  });

const socketListeners = new WeakMap<WebSocket, () => void>();

const detachSocket = (ws: WebSocket) => {
  socketListeners.get(ws)?.();
  socketListeners.delete(ws);
};

const KeyBar = ({
  disabled,
  onKey,
}: {
  disabled: boolean;
  onKey: (data: string) => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  useSnackbarInset(KEY_BAR_HEIGHT);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);
  const [keyWidths, setKeyWidths] = useState<Record<string, number>>({});
  const keysWidth =
    Object.values(keyWidths).reduce((sum, width) => sum + width, 0) +
    KEY_BAR_GAP * (terminalKeys.length - 1) +
    KEY_BAR_PADDING * 2;
  const contentWidth = Math.max(content, keysWidth);
  const overflows = contentWidth > viewport + 1;
  return (
    <View style={styles.keyBar}>
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={styles.keyBarContent}
        onLayout={(layout) => setViewport(layout.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContent(width)}
        onScroll={(scroll) => setOffset(scroll.nativeEvent.contentOffset.x)}
      >
        {terminalKeys.map(([title, label, data]) => (
          <View
            key={title}
            style={styles.key}
            onLayout={(layout) => {
              const { width } = layout.nativeEvent.layout;
              setKeyWidths((widths) =>
                widths[title] === width ? widths : { ...widths, [title]: width }
              );
            }}
          >
            <Button
              title={title}
              accessibilityLabel={label}
              size="compact"
              fullWidth
              disabled={disabled}
              onPress={() => onKey(data)}
            />
          </View>
        ))}
      </ScrollView>
      {overflows && offset > 1 && <EdgeFade side="left" color={colors.bg} />}
      {overflows && offset + viewport < contentWidth - 1 && (
        <EdgeFade side="right" color={colors.bg} />
      )}
    </View>
  );
};

const TerminalSession = ({
  client,
  connection,
  directory,
  terminal,
  mode,
  autoFocus,
  onAutoFocus,
  onExit,
}: Props & {
  autoFocus: boolean;
  terminal: Pty;
  mode: Mode;
  onAutoFocus: () => void;
  onExit: () => void;
}) => {
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { suspended, recoveryPending } = useSheetCoordinator();
  const suspendedRef = useRef(suspended);
  const renderer = useRef<TerminalRendererHandle>(null);
  const socket = useRef<WebSocket | null>(null);
  const cursor = useRef<number | undefined>(undefined);
  const attachmentID = useMemo(() => newAttachmentID(), []);
  const restored = useRef(false);
  const controllerRef = useRef(false);
  const claimed = useRef(false);
  const sizeRef = useRef({ cols: 80, rows: 24 });
  const pending = useRef<string[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExitRef = useRef(onExit);
  const autoFocusPending = useRef(autoFocus);
  const afterAttachRef = useRef<() => void>(() => null);
  const [ready, setReady] = useState(false);
  const [rendererEpoch, setRendererEpoch] = useState(0);
  const [rendererBroken, setRendererBroken] = useState(false);
  const [active, setActive] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
  );
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const stopConnection = useRef<(() => void) | null>(null);
  const [size, setSize] = useState({ cols: 80, rows: 24 });
  const [buffer, setBuffer] = useState("");
  const bufferRef = useRef("");
  const keyboardInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const rendererGeneration = useRef(0);
  const status: ConnectionStatus =
    ready && active && !suspended ? connectionStatus : "disconnected";
  useLayoutEffect(() => {
    suspendedRef.current = suspended;
    onExitRef.current = onExit;
    sizeRef.current = size;
  }, [suspended, onExit, size]);
  const previousSuspended = useRef(suspended);

  const resetTerminalView = useCallback(() => {
    const ws = socket.current;
    socket.current = null;
    if (ws) {
      detachSocket(ws);
      ws.close();
    }
    if (flushTimer.current) {
      clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    pending.current = [];
    cursor.current = undefined;
    restored.current = false;
    controllerRef.current = false;
    rendererGeneration.current += 1;
    setReady(false);
    setRendererBroken(false);
    setConnectionStatus("connecting");
    setRendererEpoch((value) => value + 1);
  }, []);

  useLayoutEffect(() => {
    if (previousSuspended.current === suspended) {
      return;
    }
    previousSuspended.current = suspended;
    resetTerminalView();
    if (suspended) {
      keyboardInput.current?.blur();
    }
  }, [suspended, resetTerminalView]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    renderer.current?.send({
      enabled: Platform.OS !== "android",
      type: "inputEnabled",
    });
    renderer.current?.send({
      colors: {
        background: colors.bg,
        black: colors.bg,
        blue: colors.blue,
        brightBlack: colors.faint,
        brightBlue: colors.blue,
        brightCyan: colors.syntaxProperty,
        brightGreen: colors.success,
        brightMagenta: colors.syntaxKeyword,
        brightRed: colors.danger,
        brightWhite: colors.text,
        brightYellow: colors.syntaxType,
        cyan: colors.syntaxProperty,
        cursor: colors.text,
        cursorAccent: colors.bg,
        foreground: colors.text,
        green: colors.success,
        magenta: colors.syntaxKeyword,
        red: colors.danger,
        selectionBackground: selectionColor(colors, scheme),
        white: colors.muted,
        yellow: colors.syntaxType,
      },
      type: "theme",
    });
  }, [colors, ready, scheme]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setActive(state === "active")
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (ready || rendererBroken || suspended) {
      return;
    }
    const timer = setTimeout(() => {
      setRendererBroken(true);
      setError("The terminal view did not start. Tap Reconnect to reload it.");
    }, 10_000);
    return () => clearTimeout(timer);
  }, [ready, rendererBroken, suspended]);

  const startConnection = useCallback(() => {
    let disposed = false;
    let retries = 0;
    let exited = false;
    let decoder = new TextDecoder();
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let connectTimer: ReturnType<typeof setTimeout> | undefined;
    const abortController = new AbortController();

    const flush = () => {
      flushTimer.current = null;
      if (!pending.current.length) {
        return;
      }
      renderer.current?.send({
        data: pending.current.join(""),
        type: "output",
      });
      pending.current = [];
    };
    const open = async () => {
      const retry = () => {
        if (disposed || suspendedRef.current || retryTimer) {
          return;
        }
        setConnectionStatus("disconnected");
        const delay = Math.min(30_000, 1000 * 2 ** Math.min(retries, 5));
        retries += 1;
        retryTimer = setTimeout(() => {
          retryTimer = undefined;
          void open();
        }, delay);
      };
      if (disposed || suspendedRef.current) {
        return;
      }
      setConnectionStatus("connecting");
      restored.current = false;
      controllerRef.current = false;
      try {
        let url: string;
        if (mode === "desktop") {
          const snapshot = await client.experimental.persistentPty.snapshot(
            { ptyID: terminal.id },
            { signal: abortController.signal }
          );
          if (disposed || suspendedRef.current) {
            return;
          }
          flush();
          decoder = new TextDecoder();
          renderer.current?.send({
            checkpoint: snapshot.checkpoint,
            type: "restore",
            ...snapshot.info.size,
          });
          cursor.current = snapshot.info.output.tail;
          if (snapshot.info.status === "exited") {
            exited = true;
            setConnectionStatus("disconnected");
            setError(
              `Shell exited with code ${snapshot.info.exitCode ?? "unknown"}`
            );
            return;
          }
          const token = await client.experimental.persistentPty.connectToken(
            { ptyID: terminal.id, "x-opencode-ticket": "1" },
            { signal: abortController.signal }
          );
          if (disposed || suspendedRef.current) {
            return;
          }
          url = persistentPtySocketUrl(
            connection.url,
            terminal.id,
            token.ticket,
            {
              attachmentID,
              cursor: snapshot.info.output.tail,
              role: "observer",
            }
          );
        } else {
          const current = await client.pty.get(
            { location: { directory }, ptyID: terminal.id },
            { signal: abortController.signal }
          );
          if (disposed || suspendedRef.current) {
            return;
          }
          if (current.data.status === "exited") {
            onExitRef.current();
            return;
          }
          const token = await client.pty.connect.token(
            {
              location: { directory },
              ptyID: terminal.id,
              "x-opencode-ticket": "1",
            },
            { signal: abortController.signal }
          );
          if (disposed || suspendedRef.current) {
            return;
          }
          url = ptySocketUrl(
            connection.url,
            directory,
            terminal.id,
            token.data.ticket,
            cursor.current
          );
        }
        const ws = new WebSocket(url);
        socket.current = ws;
        ws.binaryType = "arraybuffer";
        connectTimer = setTimeout(() => {
          if (
            ws.readyState === WebSocket.CONNECTING ||
            (mode === "desktop" && !restored.current)
          ) {
            setError("The terminal connection timed out");
            ws.close();
          }
        }, 15_000);
        const handleAttached = (message: ControlMessage) => {
          if (!("inputProtocol" in message) || message.inputProtocol !== 1) {
            setError(
              "Restart the OpenCode server to update its terminal protocol"
            );
            exited = true;
            ws.close();
            return;
          }
          if (
            "replay" in message &&
            message.replay &&
            typeof message.replay === "object" &&
            "truncated" in message.replay &&
            message.replay.truncated === true
          ) {
            setError(
              "The terminal changed during recovery. Reconnect to restore its current screen."
            );
            ws.close();
            return;
          }
          controllerRef.current =
            "role" in message && message.role === "controller";
        };
        const handleReplayComplete = (message: ControlMessage) => {
          restored.current = true;
          clearTimeout(connectTimer);
          setConnectionStatus("connected");
          if (claimed.current && ws.readyState === WebSocket.OPEN) {
            ws.send(persistentInputFrame(sizeRef.current));
          }
          if ("endOffset" in message && typeof message.endOffset === "number") {
            cursor.current = message.endOffset;
          }
          afterAttachRef.current();
        };
        const handleResized = (message: ControlMessage) => {
          if (
            "cols" in message &&
            "rows" in message &&
            "checkpoint" in message &&
            typeof message.cols === "number" &&
            typeof message.rows === "number" &&
            typeof message.checkpoint === "string"
          ) {
            flush();
            decoder = new TextDecoder();
            renderer.current?.send({
              checkpoint: message.checkpoint,
              cols: message.cols,
              rows: message.rows,
              type: "restore",
            });
          }
        };
        const handleExited = (message: ControlMessage) => {
          exited = true;
          setConnectionStatus("disconnected");
          setError(
            `Shell exited with code ${"exitCode" in message ? message.exitCode : "unknown"}`
          );
          onExitRef.current();
        };
        const handleDesktopBinary = (data: ArrayBuffer) => {
          cursor.current = (cursor.current ?? 0) + data.byteLength;
          pending.current.push(
            decoder.decode(new Uint8Array(data), { stream: true })
          );
          if (!flushTimer.current) {
            flushTimer.current = setTimeout(flush, 16);
          }
        };
        const handleDesktopText = (data: string) => {
          let message: unknown;
          try {
            message = JSON.parse(data);
          } catch {
            return;
          }
          if (!message || typeof message !== "object" || !("type" in message)) {
            return;
          }
          if (message.type === "attached") {
            handleAttached(message);
          } else if (message.type === "replay_complete") {
            handleReplayComplete(message);
          } else if (message.type === "controller_changed") {
            controllerRef.current =
              "attachmentID" in message &&
              message.attachmentID === attachmentID;
            if (!controllerRef.current) {
              claimed.current = false;
            }
          } else if (message.type === "resized") {
            handleResized(message);
          } else if (message.type === "exited") {
            handleExited(message);
          }
        };
        const handleWorkspaceData = (data: unknown) => {
          if (data instanceof ArrayBuffer) {
            const position = ptyControlCursor(data);
            if (position !== undefined) {
              cursor.current = position;
            }
            return;
          }
          if (typeof data !== "string") {
            return;
          }
          cursor.current = (cursor.current ?? 0) + data.length;
          pending.current.push(data);
          if (!flushTimer.current) {
            flushTimer.current = setTimeout(flush, 16);
          }
        };
        const onOpen = () => {
          if (disposed || suspendedRef.current) {
            ws.close();
            return;
          }
          retries = 0;
          setError(null);
          if (mode === "workspace") {
            clearTimeout(connectTimer);
            setConnectionStatus("connected");
            afterAttachRef.current();
          }
        };
        const onMessage = (event: MessageEvent) => {
          if (disposed || suspendedRef.current) {
            return;
          }
          if (mode !== "desktop") {
            handleWorkspaceData(event.data);
            return;
          }
          if (event.data instanceof ArrayBuffer) {
            handleDesktopBinary(event.data);
            return;
          }
          if (typeof event.data === "string") {
            handleDesktopText(event.data);
          }
        };
        const onError = () => {
          if (!disposed) {
            setError(
              "The terminal connection failed. Check server access and allowed web origins."
            );
          }
        };
        const onClose = () => {
          clearTimeout(connectTimer);
          if (socket.current === ws) {
            socket.current = null;
          }
          if (!disposed && !exited) {
            retry();
          }
        };
        ws.addEventListener("open", onOpen);
        ws.addEventListener("message", onMessage);
        ws.addEventListener("error", onError);
        ws.addEventListener("close", onClose);
        socketListeners.set(ws, () => {
          ws.removeEventListener("close", onClose);
          ws.removeEventListener("error", onError);
          ws.removeEventListener("message", onMessage);
        });
      } catch (error_) {
        if (!disposed) {
          setError(errorMessage(error_));
          retry();
        }
      }
    };
    void open();
    return () => {
      disposed = true;
      controllerRef.current = false;
      abortController.abort();
      clearTimeout(retryTimer);
      clearTimeout(connectTimer);
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flush();
      }
      const ws = socket.current;
      socket.current = null;
      if (ws) {
        detachSocket(ws);
        ws.close();
      }
    };
  }, [client, connection.url, directory, terminal.id, mode, attachmentID]);

  useEffect(() => {
    if (!ready || !active || suspended) {
      return;
    }
    stopConnection.current = startConnection();
    return () => {
      stopConnection.current?.();
      stopConnection.current = null;
    };
  }, [startConnection, ready, active, suspended]);

  useEffect(() => {
    if (status !== "connected" || suspended) {
      return;
    }
    const requestController = new AbortController();
    const timer = setTimeout(() => {
      if (suspendedRef.current) {
        return;
      }
      if (mode === "desktop") {
        if (
          (controllerRef.current || claimed.current) &&
          restored.current &&
          socket.current?.readyState === WebSocket.OPEN
        ) {
          socket.current.send(persistentInputFrame(size));
        }
        return;
      }
      void client.pty
        .update(
          { location: { directory }, ptyID: terminal.id, size },
          { signal: requestController.signal }
        )
        .catch((error_) => {
          if (!requestController.signal.aborted) {
            setError(errorMessage(error_));
          }
        });
    }, SIZE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      requestController.abort();
    };
  }, [client, directory, terminal.id, size, status, mode, suspended]);

  const send = (data: string, binary = false, reportError = false): boolean => {
    const ws = socket.current;
    if (
      suspendedRef.current ||
      !ready ||
      !ws ||
      ws.readyState !== WebSocket.OPEN
    ) {
      if (reportError) {
        setError("Reconnect to the shell before you send text");
      }
      return false;
    }
    if (mode === "desktop" && !restored.current) {
      return false;
    }
    try {
      if (mode === "desktop") {
        claimed.current = true;
        const bytes = binary
          ? binaryBytes(data)
          : new TextEncoder().encode(data);
        ws.send(persistentInputFrame(sizeRef.current, bytes));
      } else {
        ws.send(binary ? binaryBytes(data).buffer : data);
      }
      return true;
    } catch (error_) {
      if (reportError) {
        setError(errorMessage(error_));
      }
      return false;
    }
  };
  const claimControl = () => {
    claimed.current = true;
    if (
      mode === "desktop" &&
      !suspendedRef.current &&
      restored.current &&
      socket.current?.readyState === WebSocket.OPEN
    ) {
      socket.current.send(persistentInputFrame(sizeRef.current));
    }
  };
  const event = (message: TerminalEvent) => {
    if (suspendedRef.current) {
      return;
    }
    if (message.type === "ready") {
      setReady(true);
    }
    if (message.type === "input") {
      send(message.data, message.binary);
    }
    if (message.type === "tap") {
      claimControl();
      focusInput();
    }
    if (message.type === "resize") {
      setSize((current) =>
        current.cols === message.cols && current.rows === message.rows
          ? current
          : { cols: message.cols, rows: message.rows }
      );
    }
  };
  const reconnect = () => {
    if (suspendedRef.current) {
      return;
    }
    if (rendererBroken) {
      setReady(false);
      cursor.current = undefined;
      pending.current = [];
      rendererGeneration.current += 1;
      setRendererEpoch((value) => value + 1);
      setRendererBroken(false);
    } else if (stopConnection.current) {
      stopConnection.current();
      stopConnection.current = startConnection();
    }
    setError(null);
  };
  const focusInput = () => {
    if (suspendedRef.current) {
      return;
    }
    if (Platform.OS === "android") {
      if (canSend) {
        keyboardInput.current?.focus();
      }
    } else {
      renderer.current?.send({ type: "focus" });
    }
  };
  const sendKey = (data: string) => {
    send(data, false, true);
  };
  const typeText = (text: string) => {
    send(text, false, true);
  };
  const applyBufferChange = (next: string) => {
    const { deletes, insert } = bufferEdit(bufferRef.current, next);
    if (deletes > 0) {
      sendKey(BACKSPACE.repeat(deletes));
    }
    if (insert) {
      typeText(insert);
    }
    const settled = next.length > MAX_BUFFER_LENGTH && next.endsWith(" ");
    bufferRef.current = settled ? "" : next;
    setBuffer(bufferRef.current);
  };
  const clearBuffer = () => {
    bufferRef.current = "";
    setBuffer("");
  };
  const afterAttach = () => {
    if (!autoFocusPending.current) {
      return;
    }
    autoFocusPending.current = false;
    claimControl();
    focusInput();
    onAutoFocus();
  };
  useLayoutEffect(() => {
    afterAttachRef.current = afterAttach;
  });
  const canSend = !suspended && ready && status === "connected";
  const generation = rendererEpoch;
  return (
    <KeyboardAvoidingView
      style={styles.session}
      behavior="padding"
      automaticOffset
    >
      {recoveryPending && (
        <View style={styles.notice}>
          <BodyText accessibilityRole="alert">
            Close this panel to open the connection wizard.
          </BodyText>
        </View>
      )}
      {!recoveryPending && error && (
        <View style={styles.notice}>
          <ErrorNotice error={error} onRetry={reconnect} />
        </View>
      )}
      <View style={styles.terminal}>
        <TerminalRenderer
          key={rendererEpoch}
          ref={renderer}
          onEvent={(message) => {
            if (generation === rendererGeneration.current) {
              event(message);
            }
          }}
          onError={(message) => {
            if (generation !== rendererGeneration.current) {
              return;
            }
            setReady(false);
            setRendererBroken(true);
            setError(message);
          }}
        />
      </View>
      {Platform.OS === "android" && (
        <TextInput
          ref={keyboardInput}
          accessibilityLabel="Terminal keyboard"
          style={styles.keyboardInput}
          value={buffer}
          onChangeText={applyBufferChange}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "Backspace" && buffer === "") {
              sendKey(BACKSPACE);
            }
          }}
          onSubmitEditing={() => {
            sendKey("\r");
            clearBuffer();
          }}
          editable={canSend}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          importantForAutofill="no"
          textContentType="none"
          caretHidden
          contextMenuHidden
          submitBehavior="submit"
          returnKeyType="default"
          multiline={false}
        />
      )}
      {Platform.OS !== "web" && <KeyBar disabled={!canSend} onKey={sendKey} />}
    </KeyboardAvoidingView>
  );
};

type ClientEvent =
  ReturnType<Client["event"]["subscribe"]> extends AsyncIterable<infer E>
    ? E
    : never;
interface InventorySync {
  abortRequest: () => void;
  client: Client;
  desktop: boolean;
  directory: string;
  onError: (message: string) => void;
  refresh: () => Promise<void>;
  sessionID?: string;
}

const REFRESH_DEBOUNCE_MS = 250;
const MAX_INVENTORY_RETRY_MS = 15_000;
const MAX_INVENTORY_BACKOFF_STEP = 4;

const shouldRefreshInventory = (
  event: ClientEvent,
  { desktop, directory, sessionID }: InventorySync
): boolean => {
  if (event.type === "server.connected") {
    return true;
  }
  if (
    desktop &&
    (event.type === "persistent-pty.added" ||
      event.type === "persistent-pty.removed") &&
    event.data.sessionID === sessionID
  ) {
    return true;
  }
  return (
    (event.type === "pty.created" ||
      event.type === "pty.updated" ||
      event.type === "pty.deleted" ||
      event.type === "pty.exited") &&
    (!event.location || event.location.directory === directory)
  );
};

const consumeInventoryEvents = async (
  client: Client,
  signal: AbortSignal,
  onEvent: (event: ClientEvent) => void
): Promise<void> => {
  for await (const event of client.event.subscribe({ signal })) {
    if (signal.aborted) {
      return;
    }
    onEvent(event);
  }
};

const startInventorySync = (options: InventorySync): (() => void) => {
  const controller = new AbortController();
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  const reportError = (error_: unknown) => {
    if (!controller.signal.aborted) {
      options.onError(errorMessage(error_));
    }
  };
  const scheduleRefresh = () => {
    if (refreshTimer) {
      return;
    }
    refreshTimer = setTimeout(() => {
      refreshTimer = undefined;
      void options.refresh();
    }, REFRESH_DEBOUNCE_MS);
  };
  const cycle = async (refreshFirst: boolean): Promise<void> => {
    if (refreshFirst) {
      await options.refresh();
    }
    if (controller.signal.aborted) {
      return;
    }
    await consumeInventoryEvents(options.client, controller.signal, (event) => {
      attempts = 0;
      if (shouldRefreshInventory(event, options)) {
        scheduleRefresh();
      }
    }).catch(() => null);
    if (controller.signal.aborted) {
      return;
    }
    const delay = Math.min(
      1000 * 2 ** Math.min(attempts, MAX_INVENTORY_BACKOFF_STEP),
      MAX_INVENTORY_RETRY_MS
    );
    attempts += 1;
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      cycle(true).catch(reportError);
    }, delay);
  };
  cycle(true).catch(reportError);
  return () => {
    controller.abort();
    options.abortRequest();
    clearTimeout(refreshTimer);
    clearTimeout(retryTimer);
  };
};

interface Shell {
  kind: Mode;
  pty: Pty;
}

const shellKey = (shell: Shell): string => `${shell.kind}:${shell.pty.id}`;
const shellName = (shell: Shell): string =>
  shell.pty.title || shell.pty.command || "Terminal";

const defaultShell = (shells: Shell[]): Shell | undefined =>
  shells.find((shell) => shell.pty.status === "running") ?? shells[0];

const ShellStrip = ({
  busy,
  onClose,
  onCreate,
  onSelect,
  selectedKey,
  shells,
}: {
  busy: boolean;
  onClose: (shell: Shell) => void;
  onCreate: () => void;
  onSelect: (key: string) => void;
  selectedKey: string | undefined;
  shells: Shell[];
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const scroller = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const edges = useHorizontalEdges();
  const chipOffsets = useRef(new Map<string, number>());
  const revealChip = useCallback((key: string) => {
    const x = chipOffsets.current.get(key);
    if (x !== undefined) {
      scroller.current?.scrollTo({
        animated: false,
        x: Math.max(0, x - STRIP_PADDING),
      });
    }
  }, []);
  useEffect(() => {
    if (selectedKey) {
      revealChip(selectedKey);
    }
  }, [revealChip, selectedKey]);
  const mixed =
    shells.some((shell) => shell.kind === "desktop") &&
    shells.some((shell) => shell.kind === "workspace");
  return (
    <View style={styles.strip}>
      <ScrollView
        ref={scroller}
        horizontal
        accessibilityRole="tablist"
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripContent}
        {...edges.handlers}
      >
        {shells.map((shell) => {
          const key = shellKey(shell);
          const selected = key === selectedKey;
          const name = shellName(shell);
          const label = mixed ? `${name}, ${shell.kind} shell` : name;
          return (
            <View
              key={key}
              onLayout={(layout) => {
                chipOffsets.current.set(key, layout.nativeEvent.layout.x);
                if (selected) {
                  revealChip(key);
                }
              }}
              style={[styles.chip, selected && styles.selectedChip]}
            >
              <Pressable
                accessibilityLabel={label}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                android_ripple={android_ripple}
                onPress={() => onSelect(key)}
                style={({ pressed }) => [
                  styles.chipTitle,
                  pressed && pressedStyle,
                ]}
              >
                <BodyText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.chipText,
                    {
                      color:
                        shell.pty.status === "running"
                          ? colors.text
                          : colors.muted,
                    },
                  ]}
                >
                  {name}
                </BodyText>
              </Pressable>
              <IconButton
                icon="close"
                size={24}
                iconSize={14}
                color={colors.text}
                borderless
                accessibilityLabel={`Close ${label}`}
                onPress={() => onClose(shell)}
              />
            </View>
          );
        })}
        <IconButton
          icon="plus"
          size={28}
          iconSize={20}
          color={colors.text}
          busy={busy}
          accessibilityLabel="New shell"
          onPress={onCreate}
        />
      </ScrollView>
      {edges.left && <EdgeFade side="left" color={colors.bg} />}
      {edges.right && <EdgeFade side="right" color={colors.bg} />}
    </View>
  );
};

const TerminalList = ({
  client,
  connection,
  desktop,
  directory,
  sessionID,
}: Props & { desktop: boolean }) => {
  const styles = useThemedStyles(createStyles);
  const { hidden, remove } = useUndoableRemoval<string>("terminals");
  const { suspended } = useSheetCoordinator();
  const [shells, setShells] = useState<Shell[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [autoFocusKey, setAutoFocusKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const seeded = useRef(false);
  const createRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foreground, setForeground] = useState(
    AppState.currentState !== "background" &&
      AppState.currentState !== "inactive"
  );
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    try {
      const [desktopShells, workspaceShells] = await Promise.all([
        desktop && sessionID
          ? client.experimental.persistentPty.list(
              { sessionID },
              { signal: controller.signal }
            )
          : [],
        client.pty.list(
          { location: { directory } },
          { signal: controller.signal }
        ),
      ]);
      if (controller.signal.aborted) {
        return;
      }
      const next = [
        ...desktopShells.map((pty): Shell => ({ kind: "desktop", pty })),
        ...workspaceShells.data.map((pty): Shell => ({
          kind: "workspace",
          pty,
        })),
      ];
      setShells(next);
      setLoaded(true);
      if (!seeded.current) {
        seeded.current = true;
        if (next.length === 0) {
          void createRef.current();
        }
      }
    } catch (error_) {
      if (!controller.signal.aborted) {
        setError(errorMessage(error_));
      }
    }
  }, [client, desktop, directory, sessionID]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current?.abort();
    };
  }, []);

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => listener.remove();
  }, []);

  useEffect(() => {
    if (!foreground || suspended) {
      return;
    }
    return startInventorySync({
      abortRequest: () => request.current?.abort(),
      client,
      desktop,
      directory,
      onError: setError,
      refresh,
      sessionID,
    });
  }, [client, desktop, directory, sessionID, foreground, refresh, suspended]);

  const create = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      let created: Shell;
      if (desktop && sessionID) {
        created = {
          kind: "desktop",
          pty: await client.experimental.persistentPty.create({
            args: [],
            cwd: directory,
            env: {},
            sessionID,
            title: "Terminal",
          }),
        };
      } else {
        const response = await client.pty.create({
          cwd: directory,
          location: { directory },
        });
        created = { kind: "workspace", pty: response.data };
      }
      if (!mounted.current) {
        return;
      }
      const key = shellKey(created);
      request.current?.abort();
      setShells((current) =>
        current.some((item) => shellKey(item) === key)
          ? current.map((item) => (shellKey(item) === key ? created : item))
          : [...current, created]
      );
      setSelectedKey(key);
      setAutoFocusKey(key);
    } catch (error_) {
      if (mounted.current) {
        setError(errorMessage(error_));
      }
    }
    if (mounted.current) {
      setBusy(false);
    }
  }, [client, desktop, directory, sessionID]);

  useLayoutEffect(() => {
    createRef.current = create;
  }, [create]);

  const closeShell = (shell: Shell) => {
    remove(shellKey(shell), {
      commit: async () => {
        await (shell.kind === "desktop"
          ? client.experimental.persistentPty.remove({ ptyID: shell.pty.id })
          : client.pty.remove({
              location: { directory },
              ptyID: shell.pty.id,
            }));
        if (mounted.current) {
          await refresh();
        }
      },
      message: "Shell closed",
      onUndo: () => setSelectedKey(shellKey(shell)),
    });
  };

  const visible = shells.filter((shell) => !hidden.has(shellKey(shell)));
  const selected =
    visible.find((shell) => shellKey(shell) === selectedKey) ??
    defaultShell(visible);
  const selectedShellKey = selected && shellKey(selected);
  const renderSelected = () => {
    if (!selected) {
      return null;
    }
    if (selected.pty.status === "running" || selected.kind === "desktop") {
      return (
        <TerminalSession
          key={selectedShellKey}
          autoFocus={autoFocusKey === selectedShellKey}
          client={client}
          connection={connection}
          directory={directory}
          terminal={selected.pty}
          mode={selected.kind}
          onAutoFocus={() => setAutoFocusKey(null)}
          onExit={() => {
            void refresh();
          }}
        />
      );
    }
    return (
      <Empty
        title="Shell exited"
        detail={`Exit code: ${selected.pty.exitCode ?? "unknown"}. Tap + to start a new shell.`}
      />
    );
  };
  const renderEmpty = () => {
    if (visible.length > 0) {
      return null;
    }
    if (!error && (!loaded || busy)) {
      return <Busy />;
    }
    return (
      <Empty
        title="A shell on your server"
        detail="Tap + to start a shell in this workspace. Shells continue after you leave this screen."
      />
    );
  };
  return (
    <View style={styles.panel}>
      <ShellStrip
        busy={busy}
        shells={visible}
        selectedKey={selectedShellKey}
        onClose={closeShell}
        onCreate={() => {
          void create();
        }}
        onSelect={setSelectedKey}
      />
      {error && (
        <View style={styles.notice}>
          <ErrorNotice
            error={error}
            onRetry={() => {
              void refresh();
            }}
          />
        </View>
      )}
      {renderEmpty()}
      {renderSelected()}
    </View>
  );
};

const Terminals = (props: Props) => {
  const styles = useThemedStyles(createStyles);
  const { suspended } = useSheetCoordinator();
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const retryCheck = useRef<AbortController | null>(null);

  const checkServer = useCallback(
    (signal: AbortSignal) => {
      void props.client.server
        .info({ signal })
        .then((info) => {
          if (signal.aborted) {
            return null;
          }
          setPersistent(info.capabilities?.persistentPty === true);
          return null;
        })
        .catch((error_) => {
          if (!signal.aborted) {
            setError(errorMessage(error_));
          }
        });
    },
    [props.client]
  );

  useEffect(() => {
    if (suspended) {
      return;
    }
    const controller = new AbortController();
    checkServer(controller.signal);
    return () => {
      controller.abort();
      retryCheck.current?.abort();
    };
  }, [checkServer, suspended]);

  return (
    <View style={styles.panel}>
      {persistent === null && !error && <Busy />}
      {error && (
        <View style={styles.notice}>
          <ErrorNotice
            error={error}
            onRetry={() => {
              setError(null);
              retryCheck.current?.abort();
              retryCheck.current = new AbortController();
              checkServer(retryCheck.current.signal);
            }}
          />
        </View>
      )}
      {persistent !== null && (
        <TerminalList
          key={`${persistent && props.sessionID ? "desktop" : "workspace"}:${props.sessionID ?? ""}`}
          {...props}
          desktop={persistent && !!props.sessionID}
        />
      )}
    </View>
  );
};

export const TerminalPanel = (props: Props) => (
  <Terminals key={`${props.connection.id}:${props.directory}`} {...props} />
);
