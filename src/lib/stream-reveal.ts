export interface RevealChunk {
  start: number;
  startedAt: number;
}

export interface RevealPiece {
  text: string;
  startedAt?: number;
}

export const REVEAL_DURATION = 600;
export const MERGE_WINDOW = 100;
// A span starts fading when it mounts, which can trail the text's arrival by a
// slow render. A chunk settles only after this grace, so pruning never cuts a
// fade short.
const MOUNT_GRACE = 300;
export const SETTLE_AFTER = REVEAL_DURATION + MOUNT_GRACE;

export const pruneChunks = (
  chunks: RevealChunk[],
  now: number
): RevealChunk[] => {
  const firstLive = chunks.findIndex(
    (chunk) => now - chunk.startedAt < SETTLE_AFTER
  );
  if (firstLive === 0) {
    return chunks;
  }
  return firstLive === -1 ? [] : chunks.slice(firstLive);
};

export const recordGrowth = (
  chunks: RevealChunk[],
  previousLength: number,
  nextLength: number,
  now: number
): RevealChunk[] => {
  const live = pruneChunks(chunks, now);
  if (nextLength <= previousLength) {
    return live.filter((chunk) => chunk.start < nextLength);
  }
  const last = live.at(-1);
  if (last && now - last.startedAt < MERGE_WINDOW) {
    return live;
  }
  return [...live, { start: previousLength, startedAt: now }];
};

const pushPiece = (pieces: RevealPiece[], text: string, startedAt?: number) => {
  if (!text) {
    return;
  }
  const last = pieces.at(-1);
  if (last && last.startedAt === startedAt) {
    last.text += text;
    return;
  }
  pieces.push(startedAt === undefined ? { text } : { startedAt, text });
};

export const splitReveal = (
  text: string,
  start: number,
  chunks: RevealChunk[]
): RevealPiece[] => {
  const pieces: RevealPiece[] = [];
  const end = start + text.length;
  const cut = (offset: number) =>
    Math.min(text.length, Math.max(0, offset - start));
  pushPiece(pieces, text.slice(0, cut(chunks[0]?.start ?? end)));
  for (const [index, chunk] of chunks.entries()) {
    const chunkEnd = chunks[index + 1]?.start ?? end;
    pushPiece(
      pieces,
      text.slice(cut(chunk.start), cut(chunkEnd)),
      chunk.startedAt
    );
  }
  return pieces;
};

const SHORT_HEX = /^#[\da-f]{3,4}$/iu;
const LONG_HEX = /^#(?:[\da-f]{6}|[\da-f]{8})$/iu;
const ANY_DIGIT = /./gu;
const OPAQUE = 255;

const expandHex = (color: string): string | undefined => {
  if (SHORT_HEX.test(color)) {
    return color.slice(1).replaceAll(ANY_DIGIT, "$&$&");
  }
  return LONG_HEX.test(color) ? color.slice(1) : undefined;
};

export const withAlpha = (
  color: string,
  opacity: number
): string | undefined => {
  const hex = expandHex(color);
  if (!hex) {
    return undefined;
  }
  const alpha = hex.length === 8 ? Number.parseInt(hex.slice(6), 16) : OPAQUE;
  const scaled = Math.round(alpha * Math.min(1, Math.max(0, opacity)));
  return `#${hex.slice(0, 6)}${scaled.toString(16).padStart(2, "0")}`;
};
