import { useEffect, useState } from "react";

import { SETTLE_AFTER, pruneChunks, recordGrowth } from "../lib/stream-reveal";
import type { RevealChunk } from "../lib/stream-reveal";
import { useMotionPreference } from "./motion";

interface RevealState {
  chunks: RevealChunk[];
  length: number;
}

export const useStreamReveal = (
  length: number,
  streaming: boolean
): RevealChunk[] => {
  const reduced = useMotionPreference();
  const [state, setState] = useState<RevealState>({ chunks: [], length });
  // Recording during render keeps new text from showing opaque for a frame.
  if (state.length !== length) {
    const record = (streaming && !reduced) || length < state.length;
    setState((current) => {
      const now = Date.now();
      return {
        chunks: record
          ? recordGrowth(current.chunks, current.length, length, now)
          : pruneChunks(current.chunks, now),
        length,
      };
    });
  }
  // Fades run on the UI thread, so React only hears about a chunk again when
  // it finishes and its text can render as plain text.
  const nextFinish = state.chunks[0]?.startedAt;
  useEffect(() => {
    if (nextFinish === undefined) {
      return;
    }
    const finish = nextFinish + SETTLE_AFTER;
    const timer = setTimeout(
      () => {
        // A timer that fires a millisecond early would otherwise leave the
        // head chunk in place with no timer left to remove it.
        const now = Math.max(Date.now(), finish);
        setState((current) => ({
          ...current,
          chunks: pruneChunks(current.chunks, now),
        }));
      },
      Math.max(0, finish - Date.now())
    );
    return () => clearTimeout(timer);
  }, [nextFinish]);
  return state.chunks;
};
