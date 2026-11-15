import type { FileDiffInfo, VcsInfo } from "@opencode/client";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { errorMessage } from "../../lib/client";
import type { Client } from "../../lib/client";
import { diffRows, parsePatch } from "../../lib/diff";
import type { DiffGap, DiffLine } from "../../lib/diff";
import { vcsStatusOptions } from "../../lib/queries/panels";
import { queryKeys } from "../../lib/query-keys";
import type { Scope } from "../../lib/query-keys";
import { withDeadline } from "../../lib/request";
import { useServerScope } from "../../lib/server-scope";
import type { SyntaxSegment } from "../../lib/syntax";

export type ChangesMode = "git" | "branch" | "turn" | "committed";

export const modeLabels: Record<ChangesMode, string> = {
  branch: "Branch changes",
  committed: "Committed changes",
  git: "Git changes",
  turn: "Last turn changes",
};

export const emptyLabels: Record<ChangesMode, string> = {
  branch: "No branch changes yet",
  committed: "No committed changes",
  git: "No uncommitted changes yet",
  turn: "No changes",
};

export type ChangesState =
  | { status: "loading" }
  | { status: "ready"; diffs: FileDiffInfo[] }
  | { status: "error"; message: string };

interface DiffRequest {
  base: string;
  directory: string;
  mode: ChangesMode;
  sessionID: string | undefined;
}

const diffOptions = (
  scope: Scope,
  client: Client,
  { base, directory, mode, sessionID }: DiffRequest
) =>
  queryOptions({
    queryFn: ({ signal }) =>
      withDeadline(signal, async (deadline): Promise<FileDiffInfo[]> => {
        if (mode === "turn") {
          return await client.session.diff(
            { sessionID: sessionID ?? "" },
            { signal: deadline }
          );
        }
        const location = { directory };
        if (mode === "committed") {
          const result = await client.vcs.diff(
            { base: base || undefined, location, mode: "committed" },
            { signal: deadline }
          );
          return result.data;
        }
        const result = await client.vcs.diff(
          {
            location,
            mode: mode === "git" ? "working" : "branch",
            untracked: "files",
          },
          { signal: deadline }
        );
        return result.data;
      }),
    queryKey:
      mode === "turn"
        ? queryKeys.session.diff(scope, sessionID ?? "")
        : queryKeys.dir.vcsDiff(scope, directory, { base, mode }),
    refetchOnMount: true,
    staleTime: 0,
  });

const offeredModes = (
  info: VcsInfo | null,
  sessionID: string | undefined
): ChangesMode[] => {
  const modes: ChangesMode[] = ["git"];
  const { current, default: base } = info?.branch ?? {};
  if (current && base && current !== base) {
    modes.push("branch");
  }
  if (sessionID) {
    modes.push("turn");
  }
  modes.push("committed");
  return modes;
};

export const useChanges = ({
  client,
  directory,
  sessionID,
}: {
  client: Client;
  directory: string;
  sessionID?: string;
}) => {
  const scope = useServerScope();
  const [chosen, setChosen] = useState<ChangesMode>("git");
  const [base, setBase] = useState("");
  const vcs = useQuery(vcsStatusOptions(scope, client, directory));
  const modes = offeredModes(vcs.data?.data ?? null, sessionID);
  const mode = modes.includes(chosen) ? chosen : modes[0];
  const diffs = useQuery(
    diffOptions(scope, client, {
      base: mode === "committed" ? base : "",
      directory,
      mode,
      sessionID: mode === "turn" ? sessionID : undefined,
    })
  );
  let state: ChangesState = { status: "loading" };
  if (diffs.isError) {
    state = { message: errorMessage(diffs.error), status: "error" };
  } else if (diffs.data) {
    state = { diffs: diffs.data, status: "ready" };
  }
  const { refetch: refetchDiffs } = diffs;
  const { refetch: refetchVcs } = vcs;
  return {
    base,
    mode,
    modes,
    refresh: () => {
      void refetchDiffs();
      void refetchVcs();
    },
    refreshing: diffs.isFetching && !!diffs.data,
    setBase,
    setMode: setChosen,
    state,
  };
};

export const CHANGED_LINE_LIMIT = 500;
const CHARACTER_WIDTH = 7.8;
const GUTTER_PADDING_DIGITS = 2;
const MIN_GUTTER_DIGITS = 3;

export const isRenderable = (file: FileDiffInfo) =>
  file.additions + file.deletions > 0;

export const changedLines = (file: FileDiffInfo) =>
  file.additions + file.deletions;

export type ChangeItem =
  | {
      type: "file";
      key: string;
      file: FileDiffInfo;
      open: boolean;
      last: boolean;
    }
  | {
      type: "line";
      key: string;
      file: FileDiffInfo;
      line: DiffLine;
      segments?: SyntaxSegment[];
      gutterWidth: number;
    }
  | {
      type: "gap";
      key: string;
      file: FileDiffInfo;
      gapId: string;
      gap: DiffGap;
      gutterWidth: number;
    }
  | { type: "gate"; key: string; file: FileDiffInfo }
  | { type: "truncated"; key: string; file: FileDiffInfo };

export type FileHighlights = Map<string, SyntaxSegment[]>;

export const lineHighlightKey = (line: DiffLine) =>
  line.type === "removed"
    ? `before:${line.oldNumber}`
    : `after:${line.newNumber}`;

export const fileHighlights = (
  file: FileDiffInfo,
  highlight: (code: string) => SyntaxSegment[][] | null
): FileHighlights => {
  const result: FileHighlights = new Map();
  const before: DiffLine[] = [];
  const after: DiffLine[] = [];
  for (const hunk of parsePatch(file.patch).hunks) {
    for (const line of hunk.lines) {
      if (line.type !== "added") {
        before.push(line);
      }
      if (line.type !== "removed") {
        after.push(line);
      }
    }
  }
  for (const [lines, key] of [
    [before, "before"],
    [after, "after"],
  ] as const) {
    const segments = highlight(lines.map((line) => line.text).join("\n"));
    if (!segments) {
      continue;
    }
    for (const [index, line] of lines.entries()) {
      const number = key === "before" ? line.oldNumber : line.newNumber;
      const lineSegments = segments[index];
      if (lineSegments) {
        result.set(`${key}:${number}`, lineSegments);
      }
    }
  }
  return result;
};

const gutterFor = (lines: readonly DiffLine[]) => {
  let digits = MIN_GUTTER_DIGITS;
  for (const line of lines) {
    const number = line.type === "removed" ? line.oldNumber : line.newNumber;
    digits = Math.max(digits, String(number ?? 0).length);
  }
  return Math.ceil(CHARACTER_WIDTH * (GUTTER_PADDING_DIGITS + digits));
};

export interface OpenState {
  open: ReadonlySet<string>;
  gaps: ReadonlyMap<string, ReadonlySet<string>>;
  forced: ReadonlySet<string>;
}

const openFileItems = (
  file: FileDiffInfo,
  state: OpenState,
  highlights: FileHighlights
): ChangeItem[] => {
  if (changedLines(file) > CHANGED_LINE_LIMIT && !state.forced.has(file.file)) {
    return [{ file, key: `${file.file}:gate`, type: "gate" }];
  }
  const rows = diffRows(file.patch, state.gaps.get(file.file) ?? new Set());
  const gutterWidth = gutterFor(
    rows.flatMap((row) => (row.kind === "line" ? [row.line] : []))
  );
  const items: ChangeItem[] = rows.map((row, index) =>
    row.kind === "gap"
      ? {
          file,
          gap: row.gap,
          gapId: row.id,
          gutterWidth,
          key: `${file.file}:gap-${row.id}`,
          type: "gap",
        }
      : {
          file,
          gutterWidth,
          key: `${file.file}:${index}`,
          line: row.line,
          segments: highlights.get(lineHighlightKey(row.line)),
          type: "line",
        }
  );
  if (file.more) {
    items.push({ file, key: `${file.file}:truncated`, type: "truncated" });
  }
  return items;
};

export const buildChangeItems = (
  diffs: readonly FileDiffInfo[],
  state: OpenState,
  highlightsFor: (file: FileDiffInfo) => FileHighlights
): ChangeItem[] => {
  const items: ChangeItem[] = [];
  for (const [index, file] of diffs.entries()) {
    const open = state.open.has(file.file) && isRenderable(file);
    items.push({
      file,
      key: file.file,
      last: index === diffs.length - 1,
      open,
      type: "file",
    });
    if (open) {
      items.push(...openFileItems(file, state, highlightsFor(file)));
    }
  }
  return items;
};
