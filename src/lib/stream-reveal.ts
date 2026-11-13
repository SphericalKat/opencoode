export interface RevealChunk {
  start: number;
  startedAt: number;
}

export interface RevealPiece {
  text: string;
  opacity: number;
}

export const REVEAL_DURATION = 600;
export const MERGE_WINDOW = 100;

export const chunkOpacity = (chunk: RevealChunk, now: number): number =>
  Math.min(1, Math.max(0, (now - chunk.startedAt) / REVEAL_DURATION));

export const pruneChunks = (
  chunks: RevealChunk[],
  now: number
): RevealChunk[] => {
  const firstLive = chunks.findIndex((chunk) => chunkOpacity(chunk, now) < 1);
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

const pushPiece = (pieces: RevealPiece[], text: string, opacity: number) => {
  if (!text) {
    return;
  }
  const last = pieces.at(-1);
  if (last && last.opacity === opacity) {
    last.text += text;
    return;
  }
  pieces.push({ opacity, text });
};

export const splitReveal = (
  text: string,
  start: number,
  chunks: RevealChunk[],
  now: number
): RevealPiece[] => {
  const pieces: RevealPiece[] = [];
  const end = start + text.length;
  const cut = (offset: number) =>
    Math.min(text.length, Math.max(0, offset - start));
  pushPiece(pieces, text.slice(0, cut(chunks[0]?.start ?? end)), 1);
  for (const [index, chunk] of chunks.entries()) {
    const chunkEnd = chunks[index + 1]?.start ?? end;
    pushPiece(
      pieces,
      text.slice(cut(chunk.start), cut(chunkEnd)),
      chunkOpacity(chunk, now)
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
