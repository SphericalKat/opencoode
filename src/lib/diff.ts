export interface DiffLine {
  type: "context" | "added" | "removed";
  oldNumber?: number;
  newNumber?: number;
  text: string;
  noNewline?: boolean;
}

export interface DiffGap {
  position: "leading" | "middle" | "trailing";
  count: number;
  hidden: DiffLine[];
}

export type DiffRow =
  | { kind: "line"; line: DiffLine }
  | { kind: "gap"; id: string; gap: DiffGap };

interface Hunk {
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}

export const DIFF_CONTEXT = 4;

const HUNK_HEADER = /^@@ -(?<old>\d+)(?:,\d+)? \+(?<new>\d+)(?:,\d+)? @@/u;

export const parsePatch = (patch: string): { hunks: Hunk[] } => {
  const rawLines = patch.split("\n");
  if (rawLines.at(-1) === "") {
    rawLines.pop();
  }
  const hunks: Hunk[] = [];
  let hunk: Hunk | undefined;
  let oldNumber = 0;
  let newNumber = 0;
  for (const raw of rawLines) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const header = HUNK_HEADER.exec(line);
    if (header) {
      oldNumber = Number(header.groups?.old);
      newNumber = Number(header.groups?.new);
      hunk = { lines: [], newStart: newNumber, oldStart: oldNumber };
      hunks.push(hunk);
      continue;
    }
    if (!hunk) {
      continue;
    }
    const marker = line.charAt(0);
    const text = line.slice(1);
    if (marker === "\\") {
      const previous = hunk.lines.at(-1);
      if (previous) {
        previous.noNewline = true;
      }
    } else if (marker === "+") {
      hunk.lines.push({ newNumber, text, type: "added" });
      newNumber += 1;
    } else if (marker === "-") {
      hunk.lines.push({ oldNumber, text, type: "removed" });
      oldNumber += 1;
    } else {
      hunk.lines.push({ newNumber, oldNumber, text, type: "context" });
      oldNumber += 1;
      newNumber += 1;
    }
  }
  return { hunks };
};

export const unmodifiedLabel = (count: number): string =>
  count === 1 ? "1 unmodified line" : `${count} unmodified lines`;

const lineLabel = (line: DiffLine): number =>
  line.newNumber ?? line.oldNumber ?? 0;

const newLineCount = (hunk: Hunk): number =>
  hunk.lines.filter((line) => line.type !== "removed").length;

const gapRow = (
  hunkIndex: number,
  hidden: DiffLine[],
  count: number
): DiffRow => ({
  gap: { count, hidden, position: "middle" },
  id: `${hunkIndex}:${hidden.length > 0 ? lineLabel(hidden[0]) : `fill${count}`}`,
  kind: "gap",
});

const collapseHunk = (
  hunk: Hunk,
  hunkIndex: number,
  context: number
): { rows: DiffRow[]; startsCollapsed: boolean } => {
  const { lines } = hunk;
  const rows: DiffRow[] = [];
  let startsCollapsed = false;
  let index = 0;
  while (index < lines.length) {
    if (lines[index].type !== "context") {
      rows.push({ kind: "line", line: lines[index] });
      index += 1;
      continue;
    }
    let end = index;
    while (end < lines.length && lines[end].type === "context") {
      end += 1;
    }
    const run = lines.slice(index, end);
    const hasPrevious = index > 0;
    const hasNext = end < lines.length;
    let head = 0;
    let tail = 0;
    if (hasPrevious) {
      head = context;
    }
    if (hasNext) {
      tail = context;
    }
    if (!(hasPrevious || hasNext) || run.length <= head + tail) {
      for (const line of run) {
        rows.push({ kind: "line", line });
      }
    } else {
      for (const line of run.slice(0, head)) {
        rows.push({ kind: "line", line });
      }
      const hidden = run.slice(head, run.length - tail);
      rows.push(gapRow(hunkIndex, hidden, hidden.length));
      if (!hasPrevious) {
        startsCollapsed = true;
      }
      for (const line of run.slice(run.length - tail)) {
        rows.push({ kind: "line", line });
      }
    }
    index = end;
  }
  return { rows, startsCollapsed };
};

const assignPositions = (rows: DiffRow[]) => {
  const firstLine = rows.findIndex((row) => row.kind === "line");
  let lastLine = -1;
  for (const [index, row] of rows.entries()) {
    if (row.kind === "line") {
      lastLine = index;
    }
  }
  for (const [index, row] of rows.entries()) {
    if (row.kind !== "gap") {
      continue;
    }
    if (index < firstLine || firstLine === -1) {
      row.gap.position = "leading";
    } else if (index > lastLine) {
      row.gap.position = "trailing";
    }
  }
};

export const diffRows = (
  patch: string,
  expanded: ReadonlySet<string>,
  context: number = DIFF_CONTEXT
): DiffRow[] => {
  const { hunks } = parsePatch(patch);
  const rows: DiffRow[] = [];
  let previousEnd: number | undefined;
  for (const [hunkIndex, hunk] of hunks.entries()) {
    const collapsed = collapseHunk(hunk, hunkIndex, context);
    const lead = previousEnd === undefined ? 1 : previousEnd;
    const missing = hunk.newStart - lead;
    if (missing > 0 && !(hunkIndex === 0 && collapsed.startsCollapsed)) {
      rows.push(gapRow(hunkIndex, [], missing));
    }
    rows.push(...collapsed.rows);
    previousEnd = hunk.newStart + newLineCount(hunk);
  }
  assignPositions(rows);
  const result: DiffRow[] = [];
  for (const row of rows) {
    if (
      row.kind === "gap" &&
      row.gap.hidden.length > 0 &&
      expanded.has(row.id)
    ) {
      for (const line of row.gap.hidden) {
        result.push({ kind: "line", line });
      }
    } else {
      result.push(row);
    }
  }
  return result;
};
