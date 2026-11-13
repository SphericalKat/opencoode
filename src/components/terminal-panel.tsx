import type { Pty, SessionInfo } from "@opencode/client";
import React, {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { errorMessage } from "../lib/client";
import type { Client, Connection } from "../lib/client";
import { useSheetCoordinator } from "../lib/sheets";
import {
  persistentInputFrame,
  persistentPtySocketUrl,
  ptyControlCursor,
  ptySocketUrl,
} from "../lib/terminal";
import type { TerminalEvent } from "../lib/terminal";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { useUnsavedChanges, useUnsavedGuard } from "../lib/unsaved";
import { useMotionPreference } from "./motion";
import { TerminalRenderer } from "./terminal-renderer";
import type { TerminalRendererHandle } from "./terminal-renderer.types";
import {
  Busy,
  Button,
  confirmAction,
  Empty,
  ErrorNotice,
  BodyText,
  mono,
  Row,
  Sheet,
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
const ModalSafeAreaRoot =
  Platform.OS === "web" ? React.Fragment : SafeAreaProvider;

const newAttachmentID = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const binaryBytes = (data: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(data, (char) => char.codePointAt(0) ?? 0);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    connectionBar: {
      flexShrink: 0,
      flexWrap: "nowrap",
      paddingBottom: 8,
      paddingHorizontal: 16,
    },
    fullscreen: { backgroundColor: colors.bg, flex: 1, paddingTop: 8 },
    keys: { flexGrow: 0, flexShrink: 0, height: 54 },
    modes: { flexGrow: 0, flexShrink: 0, height: 50 },
    nativeComposer: {
      flexShrink: 0,
      flexWrap: "nowrap",
      paddingHorizontal: 8,
      paddingTop: 8,
    },
    nativeInput: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 6,
      borderWidth: 1,
      color: colors.text,
      flex: 1,
      fontFamily: mono,
      fontSize: 15,
      minHeight: 44,
      minWidth: 0,
      padding: 10,
    },
    notice: { flexShrink: 0, paddingBottom: 8, paddingHorizontal: 16 },
    panel: { flex: 1, minHeight: 0 },
    selectedTab: {
      backgroundColor: colors.selected,
      borderColor: colors.focus,
    },
    session: { flex: 1, minHeight: 0 },
    tab: {
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    tabs: { flexGrow: 0, flexShrink: 0, height: 48 },
    terminal: {
      borderBottomWidth: 1,
      borderColor: colors.border,
      borderTopWidth: 1,
      flex: 1,
      minHeight: 0,
    },
    toolbar: {
      flexShrink: 0,
      paddingBottom: 8,
      paddingHorizontal: 16,
      paddingTop: 6,
    },
  });

const socketListeners = new WeakMap<WebSocket, () => void>();

const detachSocket = (ws: WebSocket) => {
  socketListeners.get(ws)?.();
  socketListeners.delete(ws);
};

const connectionLabel = (
  status: ConnectionStatus,
  active: boolean,
  mode: Mode,
  controller: boolean,
  size: { cols: number; rows: number }
) => {
  if (status === "connected") {
    let role = "Connected";
    if (mode === "desktop") {
      role = controller ? "In control" : "View only";
    }
    return `${role} · ${size.cols} × ${size.rows}`;
  }
  if (!active) {
    return "Paused in background";
  }
  return status === "connecting" ? "Connect to shell…" : "Disconnected";
};

const composerPlaceholder = (
  canSend: boolean,
  mode: Mode,
  controller: boolean
) => {
  if (canSend) {
    return "Text for the terminal";
  }
  return mode === "desktop" && !controller
    ? "Take control to send text"
    : "Connect to send text";
};

const TerminalSession = ({
  client,
  connection,
  directory,
  terminal,
  mode,
  onExit,
}: Props & { terminal: Pty; mode: Mode; onExit: () => void }) => {
  const reducedMotion = useMotionPreference();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { suspended, recoveryPending, presentSheet, dismissSheet } =
    useSheetCoordinator();
  const modalID = useId();
  const suspendedRef = useRef(suspended);
  const renderer = useRef<TerminalRendererHandle>(null);
  const socket = useRef<WebSocket | null>(null);
  const cursor = useRef<number | undefined>(undefined);
  const attachmentID = useMemo(() => newAttachmentID(), []);
  const restored = useRef(false);
  const controllerRef = useRef(false);
  const sizeRef = useRef({ cols: 80, rows: 24 });
  const pending = useRef<string[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExitRef = useRef(onExit);
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
  const [controller, setController] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [nativeText, setNativeText] = useState("");
  useUnsavedChanges(
    `terminal-input:${connection.id}:${terminal.id}`,
    "Terminal input",
    nativeText.length > 0
  );
  const [privateInput, setPrivateInput] = useState(false);
  const nativeInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const rendererGeneration = useRef(0);
  const effectiveFullscreen = fullscreen && !suspended;
  const status: ConnectionStatus =
    ready && active && !suspended ? connectionStatus : "disconnected";
  const requestedModal = useRef(effectiveFullscreen);
  useLayoutEffect(() => {
    suspendedRef.current = suspended;
    onExitRef.current = onExit;
    sizeRef.current = size;
    requestedModal.current = effectiveFullscreen;
  }, [suspended, onExit, size, effectiveFullscreen]);
  const previousModalVisible = useRef(effectiveFullscreen);
  const pendingModalDismiss = useRef(false);
  const previousSuspended = useRef(suspended);

  const notifyModalDismissed = useCallback(() => {
    if (requestedModal.current || !pendingModalDismiss.current) {
      return;
    }
    pendingModalDismiss.current = false;
    dismissSheet(modalID);
  }, [dismissSheet, modalID]);

  useLayoutEffect(() => {
    if (effectiveFullscreen) {
      pendingModalDismiss.current = false;
      presentSheet(modalID);
    } else if (previousModalVisible.current) {
      pendingModalDismiss.current = true;
    }
    previousModalVisible.current = effectiveFullscreen;
  }, [effectiveFullscreen, presentSheet, modalID]);

  useEffect(
    () => () => {
      dismissSheet(modalID);
    },
    [dismissSheet, modalID]
  );

  useEffect(() => {
    if (
      effectiveFullscreen ||
      !pendingModalDismiss.current ||
      Platform.OS !== "android"
    ) {
      return;
    }
    const frame = requestAnimationFrame(notifyModalDismissed);
    return () => cancelAnimationFrame(frame);
  }, [effectiveFullscreen, notifyModalDismissed]);

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
    setController(false);
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
      nativeInput.current?.blur();
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
        brightGreen: colors.success,
        brightRed: colors.danger,
        brightWhite: colors.text,
        cursor: colors.focus,
        cursorAccent: colors.bg,
        foreground: colors.text,
        green: colors.success,
        red: colors.danger,
        selectionBackground: colors.selected,
        white: colors.muted,
      },
      type: "theme",
    });
  }, [colors, ready]);

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
      setController(false);
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
          setController(controllerRef.current);
        };
        const handleReplayComplete = (message: ControlMessage) => {
          restored.current = true;
          clearTimeout(connectTimer);
          setConnectionStatus("connected");
          if ("endOffset" in message && typeof message.endOffset === "number") {
            cursor.current = message.endOffset;
          }
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
            setController(controllerRef.current);
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
    if (mode === "desktop") {
      if (
        !suspendedRef.current &&
        controller &&
        restored.current &&
        socket.current?.readyState === WebSocket.OPEN
      ) {
        socket.current.send(persistentInputFrame(size));
      }
      return;
    }
    const requestController = new AbortController();
    const timer = setTimeout(() => {
      if (suspendedRef.current) {
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
    }, 120);
    return () => {
      clearTimeout(timer);
      requestController.abort();
    };
  }, [
    client,
    directory,
    terminal.id,
    size,
    status,
    controller,
    mode,
    suspended,
  ]);

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
    if (mode === "desktop" && (!restored.current || !controllerRef.current)) {
      if (reportError) {
        setError("Take control of the terminal before you send text");
      }
      return false;
    }
    try {
      if (mode === "desktop") {
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
  const takeControl = () => {
    if (
      !suspendedRef.current &&
      restored.current &&
      socket.current?.readyState === WebSocket.OPEN
    ) {
      socket.current.send(persistentInputFrame(size));
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
  const changeFullscreen = (next: boolean) => {
    if (suspendedRef.current) {
      return;
    }
    resetTerminalView();
    setFullscreen(next);
  };
  const submitNative = (appendReturn: boolean, text = nativeText) => {
    if (!text && !appendReturn) {
      return;
    }
    if (send(`${text}${appendReturn ? "\r" : ""}`, false, true)) {
      setNativeText("");
    }
  };
  const focusInput = () => {
    if (suspendedRef.current) {
      return;
    }
    if (Platform.OS === "android") {
      nativeInput.current?.focus();
    } else {
      renderer.current?.send({ type: "focus" });
    }
  };
  const canSend =
    !suspended &&
    ready &&
    status === "connected" &&
    (mode !== "desktop" || controller);
  const generation = rendererEpoch;
  const renderNotice = () =>
    recoveryPending ? (
      <View style={styles.notice}>
        <BodyText accessibilityRole="alert">
          Close this panel to open the connection wizard.
        </BodyText>
      </View>
    ) : (
      error && (
        <View style={styles.notice}>
          <ErrorNotice error={error} />
        </View>
      )
    );
  const renderAndroidInput = () =>
    Platform.OS === "android" &&
    (fullscreen ? (
      <Row style={styles.nativeComposer}>
        <TextInput
          ref={nativeInput}
          accessibilityLabel="Terminal text"
          placeholder={composerPlaceholder(canSend, mode, controller)}
          placeholderTextColor={colors.faint}
          style={styles.nativeInput}
          value={nativeText}
          onChangeText={setNativeText}
          editable={canSend}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          secureTextEntry={privateInput}
          textContentType="none"
          autoComplete="off"
          importantForAutofill="no"
          submitBehavior="submit"
          returnKeyType="send"
          onSubmitEditing={(submitEvent) =>
            submitNative(true, submitEvent.nativeEvent.text)
          }
        />
        <Button
          title="Send line"
          compact
          variant="primary"
          disabled={!canSend}
          onPress={() => submitNative(true)}
        />
      </Row>
    ) : (
      <View style={styles.notice}>
        <Button
          title="Open full screen to type"
          compact
          onPress={() => changeFullscreen(true)}
        />
      </View>
    ));
  const renderAndroidKeys = () =>
    Platform.OS === "android" &&
    fullscreen && (
      <>
        <Button
          title="Send text"
          compact
          disabled={!canSend || !nativeText}
          onPress={() => submitNative(false)}
        />
        <Button
          title={privateInput ? "Show text" : "Hide text"}
          compact
          onPress={() => setPrivateInput((value) => !value)}
        />
      </>
    );
  const content = (
    <View style={styles.session}>
      <Row style={styles.connectionBar}>
        <BodyText muted style={{ flex: 1, fontSize: 12 }}>
          {connectionLabel(status, active, mode, controller, size)}
        </BodyText>
        {mode === "desktop" && status === "connected" && !controller && (
          <Button title="Take control" compact onPress={takeControl} />
        )}
        <Button
          title={fullscreen ? "Close" : "Full screen"}
          compact
          onPress={() => changeFullscreen(!fullscreen)}
        />
      </Row>
      {fullscreen && (
        <Row style={styles.connectionBar}>
          <BodyText muted style={{ flex: 1 }} numberOfLines={1}>
            {terminal.title || terminal.command}
          </BodyText>
          <Button title="Reconnect" compact onPress={reconnect} />
        </Row>
      )}
      {renderNotice()}
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
      {renderAndroidInput()}
      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        style={styles.keys}
        contentContainerStyle={{ gap: 6, padding: 8 }}
      >
        {renderAndroidKeys()}
        {(
          [
            ["Enter", "\r"],
            ["Esc", "\u001B"],
            ["Tab", "\t"],
            ["Ctrl C", "\u0003"],
            ["Ctrl D", "\u0004"],
            ["↑", "\u001B[A"],
            ["↓", "\u001B[B"],
            ["←", "\u001B[D"],
            ["→", "\u001B[C"],
            ["Ctrl L", "\u000C"],
            ["Ctrl Z", "\u001A"],
            ["Ctrl R", "\u0012"],
            ["Home", "\u001B[H"],
            ["End", "\u001B[F"],
            ["Delete", "\u001B[3~"],
          ] as const
        ).map(([title, data]) => (
          <Button
            key={title}
            title={title}
            accessibilityLabel={`Send ${title} to terminal`}
            compact
            disabled={!canSend}
            onPress={() => {
              send(data, false, true);
              focusInput();
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
  return (
    <View style={styles.session}>
      {!fullscreen && content}
      <Modal
        visible={effectiveFullscreen}
        animationType={reducedMotion ? "fade" : "slide"}
        presentationStyle="fullScreen"
        supportedOrientations={[
          "portrait",
          "portrait-upside-down",
          "landscape-left",
          "landscape-right",
        ]}
        onRequestClose={() => changeFullscreen(false)}
        onDismiss={notifyModalDismissed}
      >
        <ModalSafeAreaRoot>
          <SafeAreaView
            style={styles.fullscreen}
            edges={["top", "bottom", "left", "right"]}
          >
            <KeyboardAvoidingView
              style={styles.session}
              behavior="padding"
              automaticOffset
            >
              {fullscreen && content}
            </KeyboardAvoidingView>
          </SafeAreaView>
        </ModalSafeAreaRoot>
      </Modal>
    </View>
  );
};

type ClientEvent =
  ReturnType<Client["event"]["subscribe"]> extends AsyncIterable<infer E>
    ? E
    : never;
interface InventorySync {
  abortRequest: () => void;
  client: Client;
  directory: string;
  mode: Mode;
  onError: (message: string) => void;
  refresh: () => Promise<void>;
  sessionID?: string;
}

const REFRESH_DEBOUNCE_MS = 250;
const MAX_INVENTORY_RETRY_MS = 15_000;
const MAX_INVENTORY_BACKOFF_STEP = 4;

const shouldRefreshInventory = (
  event: ClientEvent,
  { directory, mode, sessionID }: InventorySync
): boolean => {
  if (event.type === "server.connected") {
    return true;
  }
  if (
    mode === "desktop" &&
    (event.type === "persistent-pty.added" ||
      event.type === "persistent-pty.removed") &&
    event.data.sessionID === sessionID
  ) {
    return true;
  }
  return (
    mode === "workspace" &&
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

const TerminalList = ({
  client,
  connection,
  directory,
  sessionID,
  mode,
}: Props & { mode: Mode }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const confirmUnsaved = useUnsavedGuard();
  const { suspended } = useSheetCoordinator();
  const [terminals, setTerminals] = useState<Pty[]>([]);
  const [selectedID, setSelectedID] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    setLoading(true);
    setError(null);
    try {
      let data: Pty[];
      if (mode === "desktop" && sessionID) {
        data = await client.experimental.persistentPty.list(
          { sessionID },
          { signal: controller.signal }
        );
      } else {
        const response = await client.pty.list(
          { location: { directory } },
          { signal: controller.signal }
        );
        ({ data } = response);
      }
      if (controller.signal.aborted) {
        return;
      }
      setTerminals(data);
      setSelectedID((current) =>
        data.some((item) => item.id === current)
          ? current
          : (data.find((item) => item.status === "running")?.id ??
            data[0]?.id ??
            null)
      );
    } catch (error_) {
      if (!controller.signal.aborted) {
        setError(errorMessage(error_));
      }
    }
    if (!controller.signal.aborted) {
      setLoading(false);
    }
  }, [client, directory, sessionID, mode]);

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
      directory,
      mode,
      onError: setError,
      refresh,
      sessionID,
    });
  }, [client, directory, mode, sessionID, foreground, refresh, suspended]);

  const create = async () => {
    if (!(await confirmUnsaved())) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let terminal: Pty;
      if (mode === "desktop" && sessionID) {
        terminal = await client.experimental.persistentPty.create({
          args: [],
          cwd: directory,
          env: {},
          sessionID,
          title: "Terminal",
        });
      } else {
        const response = await client.pty.create({
          cwd: directory,
          location: { directory },
        });
        terminal = response.data;
      }
      if (!mounted.current) {
        return;
      }
      request.current?.abort();
      setLoading(false);
      setTerminals((current) =>
        current.some((item) => item.id === terminal.id)
          ? current.map((item) => (item.id === terminal.id ? terminal : item))
          : [...current, terminal]
      );
      setSelectedID(terminal.id);
    } catch (error_) {
      if (mounted.current) {
        setError(errorMessage(error_));
      }
    }
    if (mounted.current) {
      setBusy(false);
    }
  };

  const selectTerminal = async (next: string) => {
    if (next === selectedID || !(await confirmUnsaved())) {
      return;
    }
    setSelectedID(next);
  };

  const terminate = async () => {
    if (
      !selectedID ||
      !(await confirmAction(
        "Terminate this shell?",
        "The server will stop this shell and its child processes."
      ))
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await (mode === "desktop"
        ? client.experimental.persistentPty.remove({ ptyID: selectedID })
        : client.pty.remove({ location: { directory }, ptyID: selectedID }));
      if (mounted.current) {
        await refresh();
      }
    } catch (error_) {
      if (mounted.current) {
        setError(errorMessage(error_));
      }
    }
    if (mounted.current) {
      setBusy(false);
    }
  };

  const selected = terminals.find((item) => item.id === selectedID);
  const renderSelected = () => {
    if (!selected) {
      return (
        !loading && (
          <Empty
            title="A shell on your server"
            detail="Create a terminal to run commands in this workspace. Shells continue after you leave this screen."
          />
        )
      );
    }
    if (selected.status === "running" || mode === "desktop") {
      return (
        <TerminalSession
          key={selected.id}
          client={client}
          connection={connection}
          directory={directory}
          terminal={selected}
          mode={mode}
          onExit={() => {
            void refresh();
          }}
        />
      );
    }
    return (
      <Empty
        title="Shell exited"
        detail={`Exit code: ${selected.exitCode ?? "unknown"}. Create a new shell to continue.`}
      />
    );
  };
  return (
    <View style={styles.panel}>
      <Row style={styles.toolbar}>
        <Button
          title="New shell"
          compact
          variant="primary"
          onPress={() => {
            void create();
          }}
          busy={busy}
        />
        <Button
          title="Refresh"
          compact
          onPress={() => {
            void refresh();
          }}
          disabled={busy || loading}
        />
        {selected && (
          <Button
            title="Terminate"
            compact
            variant="danger"
            onPress={() => {
              void terminate();
            }}
            disabled={busy}
          />
        )}
      </Row>
      <View style={styles.notice}>
        <ErrorNotice
          error={error}
          onRetry={() => {
            void refresh();
          }}
        />
      </View>
      {loading && terminals.length === 0 ? <Busy /> : null}
      {terminals.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={{
            gap: 8,
            paddingBottom: 10,
            paddingHorizontal: 16,
          }}
        >
          {terminals.map((terminal) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: selectedID === terminal.id }}
              key={terminal.id}
              onPress={() => {
                void selectTerminal(terminal.id);
              }}
              style={[
                styles.tab,
                selectedID === terminal.id && styles.selectedTab,
              ]}
            >
              <BodyText
                style={{
                  color:
                    terminal.status === "running"
                      ? colors.success
                      : colors.muted,
                }}
              >
                {terminal.status === "running" ? "●" : "○"}{" "}
                {terminal.title || terminal.command}
              </BodyText>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {renderSelected()}
    </View>
  );
};

const Terminals = (props: Props) => {
  const styles = useThemedStyles(createStyles);
  const confirmUnsaved = useUnsavedGuard();
  const { suspended } = useSheetCoordinator();
  const capabilityKnown = useRef(false);
  const [persistent, setPersistent] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("workspace");
  const [sessionID, setSessionID] = useState(props.sessionID);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionPicker, setSessionPicker] = useState(false);
  const [sessionCursor, setSessionCursor] = useState<string | undefined>(
    undefined
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const retryCheck = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const [previousSessionID, setPreviousSessionID] = useState(props.sessionID);
  if (previousSessionID !== props.sessionID) {
    setPreviousSessionID(props.sessionID);
    setSessionID(props.sessionID);
  }
  const checkServer = useCallback(
    (signal: AbortSignal) => {
      void props.client.server
        .info({ signal })
        .then((info) => {
          if (signal.aborted) {
            return null;
          }
          const supported = info.capabilities?.persistentPty === true;
          setPersistent(supported);
          if (!supported || !capabilityKnown.current) {
            setMode(supported ? "desktop" : "workspace");
          }
          capabilityKnown.current = true;
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
    mounted.current = true;
    const controller = new AbortController();
    checkServer(controller.signal);
    return () => {
      mounted.current = false;
      controller.abort();
      retryCheck.current?.abort();
    };
  }, [checkServer, suspended]);

  const pickSession = async (cursor?: string) => {
    setSessionPicker(true);
    setLoading(true);
    setError(null);
    try {
      const result = await props.client.session.list({
        cursor,
        directory: props.directory,
        limit: 50,
      });
      if (!mounted.current) {
        return;
      }
      setSessions((current) =>
        cursor ? [...current, ...result.data] : result.data
      );
      setSessionCursor(result.cursor.next ?? undefined);
    } catch (error_) {
      if (mounted.current) {
        setError(errorMessage(error_));
      }
    }
    if (mounted.current) {
      setLoading(false);
    }
  };

  const selectMode = async (next: Mode) => {
    if (next === mode || !(await confirmUnsaved())) {
      return;
    }
    setMode(next);
  };

  const selectSession = async (next: string) => {
    if (next !== sessionID && !(await confirmUnsaved())) {
      return;
    }
    setSessionID(next);
    setSessionPicker(false);
  };

  const renderTerminals = () =>
    persistent !== null && (mode === "workspace" || sessionID) ? (
      <TerminalList
        key={`${mode}:${sessionID ?? ""}`}
        {...props}
        sessionID={sessionID}
        mode={mode}
      />
    ) : (
      persistent !== null && (
        <Empty
          title="Choose a desktop session"
          detail="Desktop terminals belong to a session. Choose its session to see the same terminals on your phone."
        />
      )
    );

  return (
    <View style={styles.panel}>
      {persistent && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.modes}
          contentContainerStyle={{
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 6,
          }}
        >
          <Button
            title="Desktop terminals"
            compact
            variant={mode === "desktop" ? "primary" : "ghost"}
            onPress={() => {
              void selectMode("desktop");
            }}
          />
          <Button
            title="Workspace shells"
            compact
            variant={mode === "workspace" ? "primary" : "ghost"}
            onPress={() => {
              void selectMode("workspace");
            }}
          />
          {mode === "desktop" && (
            <Button
              title="Choose session"
              compact
              onPress={() => {
                void pickSession();
              }}
            />
          )}
        </ScrollView>
      )}
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
      {renderTerminals()}
      {persistent !== null && mode === "desktop" && !sessionID && (
        <View style={styles.notice}>
          <Button
            title="Choose session"
            variant="primary"
            onPress={() => {
              void pickSession();
            }}
          />
        </View>
      )}
      <Sheet
        visible={sessionPicker}
        title="Terminal session"
        onClose={() => setSessionPicker(false)}
      >
        <ErrorNotice error={error} />
        {loading && sessions.length === 0 && <Busy />}
        {sessions.map((session) => (
          <Button
            key={session.id}
            title={session.title || session.id}
            variant={sessionID === session.id ? "primary" : "secondary"}
            onPress={() => {
              void selectSession(session.id);
            }}
          />
        ))}
        {!loading && sessions.length === 0 && (
          <BodyText muted>
            Create a session from the Sessions tab first.
          </BodyText>
        )}
        {sessionCursor && (
          <Button
            title="More sessions"
            busy={loading}
            onPress={() => {
              void pickSession(sessionCursor);
            }}
          />
        )}
      </Sheet>
    </View>
  );
};

export const TerminalPanel = (props: Props) => (
  <Terminals key={`${props.connection.id}:${props.directory}`} {...props} />
);
