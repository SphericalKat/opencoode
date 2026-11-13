import type { SessionMessageInfo } from "@opencode/client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { RefObject } from "react";

import { STREAM_TICK_INTERVAL, playHaptic } from "../../lib/haptics";
import { createStreamPacer } from "../../lib/stream-pacer";

interface UseResponseHapticsOptions {
  active: boolean;
  following: boolean;
  foreground: boolean;
  messages: SessionMessageInfo[];
  pendingInputCount: number;
  screenReaderEnabled: RefObject<boolean>;
  sessionID: string;
  stopping: boolean;
  visible: boolean;
}

interface StreamedText {
  length: number;
  messageID: string;
  sessionID: string;
}

const latestAssistantText = (messages: SessionMessageInfo[]) => {
  const message = messages.findLast((item) => item.type === "assistant");
  if (message?.type !== "assistant") {
    return;
  }
  let length = 0;
  for (const part of message.content) {
    if (part.type === "text") {
      length += part.text.length;
    }
  }
  return { failed: Boolean(message.error), length, messageID: message.id };
};

export const useResponseHaptics = ({
  active,
  following,
  foreground,
  messages,
  pendingInputCount,
  screenReaderEnabled,
  sessionID,
  stopping,
  visible,
}: UseResponseHapticsOptions) => {
  const onScreen = foreground && visible;
  const streamed = useRef<StreamedText | null>(null);
  const pacer = useMemo(() => createStreamPacer(), []);
  const ticker = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const wasActive = useRef(active);
  const stoppedTurn = useRef(false);
  const pendingInput = useRef(pendingInputCount);
  const audible = active && onScreen && following;

  const stopTicking = useCallback(() => {
    clearInterval(ticker.current);
    ticker.current = undefined;
    pacer.reset();
  }, [pacer]);

  useEffect(() => {
    if (!audible) {
      stopTicking();
    }
  }, [audible, stopTicking]);

  useEffect(() => stopTicking, [stopTicking]);

  useEffect(() => {
    const latest = latestAssistantText(messages);
    const previous = streamed.current;
    streamed.current = latest ? { ...latest, sessionID } : null;
    // The first text seen for a session only seeds the baseline, so opening a
    // chat mid-response stays silent until new text arrives.
    if (!latest || previous?.sessionID !== sessionID) {
      return;
    }
    const added =
      previous.messageID === latest.messageID
        ? latest.length - previous.length
        : latest.length;
    if (added <= 0 || !audible || screenReaderEnabled.current) {
      return;
    }
    pacer.feed(added, Date.now());
    if (ticker.current !== undefined) {
      return;
    }
    playHaptic("streamTick");
    ticker.current = setInterval(() => {
      if (pacer.take(STREAM_TICK_INTERVAL)) {
        playHaptic("streamTick");
      } else {
        clearInterval(ticker.current);
        ticker.current = undefined;
      }
    }, STREAM_TICK_INTERVAL);
  }, [messages, sessionID, audible, pacer, screenReaderEnabled]);

  useEffect(() => {
    if (stopping) {
      stoppedTurn.current = true;
    }
  }, [stopping]);

  useEffect(() => {
    const started = active && !wasActive.current;
    const finished = !active && wasActive.current;
    wasActive.current = active;
    if (started) {
      stoppedTurn.current = false;
      return;
    }
    if (!finished || stoppedTurn.current || !onScreen) {
      return;
    }
    playHaptic(latestAssistantText(messages)?.failed ? "failure" : "success");
  }, [active, messages, onScreen]);

  useEffect(() => {
    if (pendingInputCount > pendingInput.current && onScreen) {
      playHaptic("attention");
    }
    pendingInput.current = pendingInputCount;
  }, [pendingInputCount, onScreen]);
};
