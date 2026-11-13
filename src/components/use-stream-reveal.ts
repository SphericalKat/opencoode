import { useEffect, useMemo, useRef, useState } from "react";

import { createStreamPacer } from "../lib/stream-pacer";
import {
  RELEASE_INTERVAL,
  SETTLE_AFTER,
  clampReveal,
  pruneChunks,
  releaseText,
} from "../lib/stream-reveal";
import type { RevealRange, RevealState } from "../lib/stream-reveal";
import { useMotionPreference } from "./motion";

export interface VisibleText {
  atomic: RevealRange[];
  text: string;
}

interface HookState extends RevealState {
  length: number;
}

export const useStreamReveal = (
  visible: VisibleText,
  streaming: boolean
): RevealState => {
  const reduced = useMotionPreference();
  const { length } = visible.text;
  const buffering = streaming && !reduced;
  const pacer = useMemo(() => createStreamPacer(), []);
  const [state, setState] = useState<HookState>({
    chunks: [],
    length,
    shown: length,
  });
  // Updating during render keeps new text out of the frame that receives it.
  if (state.length !== length) {
    const hold = buffering && length > state.length;
    setState((current) => {
      const clamped = clampReveal(current, length);
      return { ...clamped, length, shown: hold ? clamped.shown : length };
    });
  }

  const latest = useRef(visible);
  const fedLength = useRef(length);
  useEffect(() => {
    latest.current = visible;
    const added = length - fedLength.current;
    fedLength.current = length;
    if (added > 0 && buffering) {
      pacer.feed(added, Date.now());
    }
  }, [visible, length, buffering, pacer]);

  const buffered = state.shown < length;
  useEffect(() => {
    if (!buffered) {
      return;
    }
    const timer = setInterval(() => {
      const { atomic, text } = latest.current;
      const amount = pacer.drain(RELEASE_INTERVAL);
      setState((current) => ({
        ...current,
        ...releaseText(current, text, atomic, amount, Date.now()),
      }));
    }, RELEASE_INTERVAL);
    return () => clearInterval(timer);
  }, [buffered, pacer]);

  // Fades run on the UI thread, so React only hears about a chunk again when
  // it settles and its text can render as plain text.
  const nextSettle = state.chunks[0]?.startedAt;
  useEffect(() => {
    if (nextSettle === undefined) {
      return;
    }
    const settle = nextSettle + SETTLE_AFTER;
    const timer = setTimeout(
      () => {
        // A timer that fires a millisecond early would otherwise leave the
        // head chunk in place with no timer left to remove it.
        const now = Math.max(Date.now(), settle);
        setState((current) => ({
          ...current,
          chunks: pruneChunks(current.chunks, now),
        }));
      },
      Math.max(0, settle - Date.now())
    );
    return () => clearTimeout(timer);
  }, [nextSettle]);

  return state;
};
