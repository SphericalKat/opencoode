import { useEffect, useState } from "react";

import { pruneChunks, recordGrowth } from "../lib/stream-reveal";
import type { RevealChunk } from "../lib/stream-reveal";
import { useMotionPreference } from "./motion";

const TICK_INTERVAL = 33;

interface RevealState {
  chunks: RevealChunk[];
  length: number;
  now: number;
}

export const useStreamReveal = (
  length: number,
  streaming: boolean
): RevealState => {
  const reduced = useMotionPreference();
  const [state, setState] = useState<RevealState>({
    chunks: [],
    length,
    now: 0,
  });
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
        now,
      };
    });
  }
  const live = state.chunks.length > 0;
  useEffect(() => {
    if (!live) {
      return;
    }
    const timer = setInterval(() => {
      setState((current) => {
        const now = Date.now();
        return { ...current, chunks: pruneChunks(current.chunks, now), now };
      });
    }, TICK_INTERVAL);
    return () => clearInterval(timer);
  }, [live]);
  return state;
};
