import type { FileDiffInfo } from "@opencode/client";
import { FlashList } from "@shopify/flash-list";
import React, { useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";

import { AnchoredMenu, useContextMenu } from "../../components/anchored-menu";
import type { AnchoredMenuItem } from "../../components/anchored-menu";
import { confirmAction, promptText } from "../../components/dialog";
import {
  BodyText,
  Button,
  ErrorNotice,
  Field,
  Sheet,
  mono,
  sans,
} from "../../components/ui";
import { errorMessage } from "../../lib/client";
import type { Client } from "../../lib/client";
import { copyText } from "../../lib/clipboard";
import { highlightLines, languageForPath } from "../../lib/syntax";
import { useTheme, useThemedStyles } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { useUnsavedChanges } from "../../lib/unsaved";
import { quotedText, runWithFlag, serverFilePath } from "../../lib/workspace";
import { ChangedFileRow, FileSummary } from "./changed-file-row";
import { ChangesHeader } from "./changes-header";
import { DiffGapRow, DiffGate, DiffLineRow, TruncatedNote } from "./diff-line";
import {
  buildChangeItems,
  changedLines,
  diffsOf,
  emptyLabels,
  fileHighlights,
  isRenderable,
  useChanges,
} from "./use-changes";
import type { ChangeItem, ChangesMode, FileHighlights } from "./use-changes";

type AttachFile = (
  path: string,
  contextText?: string
) => Promise<boolean | undefined> | undefined;

interface ReviewTarget {
  file: FileDiffInfo;
  line?: { number: number; prefix: string; text: string };
}

type MenuTarget =
  | { kind: "file"; file: FileDiffInfo }
  | {
      kind: "line";
      file: FileDiffInfo;
      line: NonNullable<ReviewTarget["line"]>;
    };

const EMPTY_BOTTOM_PADDING = 256;
const EMPTY_MAX_WIDTH = 224;
const LIST_BOTTOM_PADDING = 12;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    empty: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      paddingBottom: EMPTY_BOTTOM_PADDING,
    },
    emptyText: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 14,
      maxWidth: EMPTY_MAX_WIDTH,
      textAlign: "center",
    },
    errorBox: {
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 24,
    },
    errorDetail: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 12,
      textAlign: "center",
    },
    errorTitle: { color: colors.text, fontFamily: sans, fontSize: 13 },
    listContent: { paddingBottom: LIST_BOTTOM_PADDING },
    loading: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 14,
      padding: 16,
    },
    root: { backgroundColor: colors.bg, flex: 1, minHeight: 0 },
  });

const highlightCache = new WeakMap<
  FileDiffInfo,
  { colors: ThemeColors; value: FileHighlights }
>();

const highlightsFor = (
  file: FileDiffInfo,
  colors: ThemeColors
): FileHighlights => {
  const cached = highlightCache.get(file);
  if (cached?.colors === colors) {
    return cached.value;
  }
  const language = languageForPath(file.file);
  const value = fileHighlights(file, (code) =>
    highlightLines(code, language, colors)
  );
  highlightCache.set(file, { colors, value });
  return value;
};

const reviewContext = (
  directory: string,
  { file, line }: ReviewTarget,
  comment: string
) => {
  const quoted = line
    ? quotedText(`${line.prefix}${line.text}`, "diff")
    : quotedText(file.patch, "diff");
  const where = line ? `, line ${line.number}` : "";
  const truncated = file.more ? "\n\nThe server truncated this diff." : "";
  return `Review feedback for ${serverFilePath(directory, file.file)}${where}:\n\n${comment.trim()}\n\n${quoted}${truncated}`;
};

const sameTarget = (a: ReviewTarget, b: ReviewTarget) =>
  a.file.file === b.file.file && a.line?.number === b.line?.number;

const discardConfirmed = () =>
  confirmAction(
    "Discard review comment?",
    "Your comment has not been added to a prompt.",
    { confirmLabel: "Discard", destructive: true }
  );

const useReview = (directory: string, onAttachFile?: AttachFile) => {
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [comment, setComment] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useUnsavedChanges(
    `workspace-review:${directory}`,
    "Review comment",
    !!target && !!comment.trim() && !adding
  );
  const reset = () => {
    setTarget(null);
    setComment("");
    setError(null);
  };
  const open = async (next: ReviewTarget) => {
    if (target && !sameTarget(target, next) && comment.trim()) {
      if (!(await discardConfirmed())) {
        return;
      }
      setComment("");
    }
    setTarget(next);
    setError(null);
  };
  const close = async () => {
    if (adding) {
      return;
    }
    if (comment.trim() && !(await discardConfirmed())) {
      return;
    }
    reset();
  };
  const add = async () => {
    if (!target || !onAttachFile || !comment.trim()) {
      return;
    }
    setError(null);
    await runWithFlag(setAdding, async () => {
      try {
        const sent = await onAttachFile(
          serverFilePath(directory, target.file.file),
          reviewContext(directory, target, comment)
        );
        if (sent === false) {
          setError("The review was not added. Check the connection and retry.");
        } else {
          reset();
        }
      } catch (error_) {
        setError(errorMessage(error_));
      }
    });
  };
  return { add, adding, close, comment, error, open, setComment, target };
};

const ReviewSheet = ({ review }: { review: ReturnType<typeof useReview> }) => {
  const { add, adding, close, comment, error, setComment, target } = review;
  return (
    <Sheet
      visible={target !== null}
      title="Review comment"
      onClose={() => {
        void close();
      }}
    >
      {target && (
        <>
          <BodyText selectable style={{ fontFamily: mono }}>
            {target.file.file}
          </BodyText>
          <Field
            label="Comment for OpenCode"
            multiline
            value={comment}
            onChangeText={setComment}
            editable={!adding}
          />
          <ErrorNotice error={error} />
          <Button
            title="Add review to prompt"
            variant="primary"
            busy={adding}
            disabled={!comment.trim()}
            onPress={() => {
              void add();
            }}
          />
        </>
      )}
    </Sheet>
  );
};

const menuItems = ({
  target,
  canComment,
  queue,
  review,
}: {
  target: MenuTarget | null;
  canComment: boolean;
  queue: (run: () => void) => void;
  review: ReturnType<typeof useReview>;
}): AnchoredMenuItem[] => {
  if (!target) {
    return [];
  }
  const items: AnchoredMenuItem[] = [];
  if (target.kind === "line") {
    const { line } = target;
    items.push({
      key: "copy",
      label: "Copy line",
      onSelect: () => {
        void copyText(line.text);
      },
    });
    if (canComment) {
      items.push({
        key: "comment",
        label: `Comment on line ${line.number}`,
        onSelect: () =>
          queue(() => {
            void review.open(target);
          }),
      });
    }
  } else if (target.kind === "file") {
    items.push({
      key: "comment",
      label: "Comment on file",
      onSelect: () =>
        queue(() => {
          void review.open({ file: target.file });
        }),
    });
  }
  return items;
};

const Empty = ({ label }: { label: string }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{label}</Text>
    </View>
  );
};

const LoadFailure = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View accessibilityRole="alert" style={styles.errorBox}>
      <Text style={styles.errorTitle}>Couldn&apos;t load changes</Text>
      <Text style={styles.errorDetail}>{message}</Text>
      <Button
        title="Retry"
        size="small"
        variant="secondary"
        onPress={onRetry}
      />
    </View>
  );
};

const itemType = (item: ChangeItem) => item.type;
const itemKey = (item: ChangeItem) => item.key;

const prunedSet = (set: ReadonlySet<string>, files: ReadonlySet<string>) =>
  new Set([...set].filter((path) => files.has(path)));

export const ChangesPane = ({
  client,
  directory,
  sessionID,
  onAttachFile,
  onOpenFile,
}: {
  client: Client;
  directory: string;
  sessionID?: string;
  onAttachFile?: AttachFile;
  onOpenFile?: (path: string) => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const changes = useChanges({ client, directory, sessionID });
  const review = useReview(directory, onAttachFile);
  const menu = useContextMenu();
  const [menuTarget, setMenuTarget] = useState<MenuTarget | null>(null);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [gaps, setGaps] = useState<ReadonlyMap<string, ReadonlySet<string>>>(
    new Map()
  );
  const [forced, setForced] = useState<ReadonlySet<string>>(new Set());
  const { state, mode } = changes;
  const handleRefresh = changes.refresh;
  const handleMenuClose = menu.close;
  const diffs = diffsOf(state);
  const [seen, setSeen] = useState(diffs);
  if (seen !== diffs) {
    setSeen(diffs);
    const files = new Set(diffs.map((file) => file.file));
    setOpen(prunedSet(open, files));
    setForced(prunedSet(forced, files));
    setGaps(new Map([...gaps].filter(([path]) => files.has(path))));
  }
  const items = useMemo(
    () =>
      buildChangeItems(diffs, { forced, gaps, open }, (file) =>
        highlightsFor(file, colors)
      ),
    [diffs, forced, gaps, open, colors]
  );
  const stickyIndices = useMemo(
    () => items.flatMap((item, index) => (item.type === "file" ? [index] : [])),
    [items]
  );
  const toggleFile = (path: string) => {
    const next = new Set(open);
    if (!next.delete(path)) {
      next.add(path);
    }
    setOpen(next);
  };
  const toggleAll = () => {
    setOpen(
      open.size > 0
        ? new Set()
        : new Set(diffs.filter(isRenderable).map((file) => file.file))
    );
  };
  const expandGap = (path: string, gapId: string) => {
    setGaps(
      new Map([...gaps, [path, new Set([...(gaps.get(path) ?? []), gapId])]])
    );
  };
  const promptBase = async () => {
    const value = await promptText("Compare with", {
      confirmLabel: "Compare",
      field: {
        autoCapitalize: "none",
        defaultValue: changes.base,
        isValid: () => true,
        label: "Base branch or commit",
      },
    });
    if (value === null) {
      return;
    }
    changes.setBase(value);
    changes.setMode("committed");
  };
  const showMenu =
    (target: MenuTarget) => (event: Parameters<typeof menu.onLongPress>[0]) => {
      setMenuTarget(target);
      menu.onLongPress(event);
    };
  const renderItem = ({ item }: { item: ChangeItem }) => {
    switch (item.type) {
      case "file": {
        const { file } = item;
        return (
          <View>
            <ChangedFileRow
              file={file}
              open={item.open}
              last={item.last}
              onToggle={() => toggleFile(file.file)}
              onLongPress={
                onAttachFile ? showMenu({ file, kind: "file" }) : undefined
              }
              onMenuRequest={
                onAttachFile
                  ? (anchor) => {
                      setMenuTarget({ file, kind: "file" });
                      menu.openAt(anchor);
                    }
                  : undefined
              }
            />
            {item.open && (
              <FileSummary
                file={file}
                onOpenFile={
                  onOpenFile ? () => onOpenFile(file.file) : undefined
                }
              />
            )}
          </View>
        );
      }
      case "line": {
        const { file, line } = item;
        const number =
          (line.type === "removed" ? line.oldNumber : line.newNumber) ?? 0;
        return (
          <DiffLineRow
            line={line}
            segments={item.segments}
            gutterWidth={item.gutterWidth}
            onLongPress={showMenu({
              file,
              kind: "line",
              line: {
                number,
                prefix: { added: "+", context: " ", removed: "-" }[line.type],
                text: line.text,
              },
            })}
            onMenuRequest={(anchor) => {
              setMenuTarget({
                file,
                kind: "line",
                line: {
                  number,
                  prefix: { added: "+", context: " ", removed: "-" }[line.type],
                  text: line.text,
                },
              });
              menu.openAt(anchor);
            }}
          />
        );
      }
      case "gap": {
        return (
          <DiffGapRow
            gap={item.gap}
            gutterWidth={item.gutterWidth}
            onExpand={() => expandGap(item.file.file, item.gapId)}
          />
        );
      }
      case "gate": {
        return (
          <DiffGate
            changed={changedLines(item.file)}
            onRender={() => setForced(new Set([...forced, item.file.file]))}
          />
        );
      }
      default: {
        return <TruncatedNote />;
      }
    }
  };
  let empty: React.ReactNode = null;
  if (state.status === "loading") {
    empty = <Text style={styles.loading}>Loading changes…</Text>;
  } else if (state.status === "error") {
    empty = <LoadFailure message={state.message} onRetry={handleRefresh} />;
  } else {
    empty = <Empty label={emptyLabels[mode]} />;
  }
  return (
    <View style={styles.root}>
      <ChangesHeader
        modes={changes.modes}
        mode={mode}
        base={changes.base}
        diffs={diffs}
        anyOpen={open.size > 0}
        failed={state.status === "error"}
        onModeChange={(next: ChangesMode) => changes.setMode(next)}
        onCompare={() => {
          void promptBase();
        }}
        onToggleAll={toggleAll}
      />
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={itemKey}
        getItemType={itemType}
        stickyHeaderIndices={stickyIndices}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={empty}
        refreshControl={
          <RefreshControl
            refreshing={changes.refreshing}
            onRefresh={handleRefresh}
            colors={[colors.text]}
            progressBackgroundColor={colors.bg}
          />
        }
      />
      <AnchoredMenu
        visible={menu.visible}
        anchor={menu.anchor}
        accessibilityLabel={
          menuTarget?.kind === "line" ? "Line actions" : "File actions"
        }
        items={menuItems({
          canComment: !!onAttachFile,
          queue: (run) => setPending(() => run),
          review,
          target: menuTarget,
        })}
        onClose={handleMenuClose}
        onClosed={() => {
          setPending(null);
          pending?.();
        }}
      />
      <ReviewSheet review={review} />
    </View>
  );
};
