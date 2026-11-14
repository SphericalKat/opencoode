import type { FileDiffInfo } from "@opencode/client";
import React from "react";
import { StyleSheet, View } from "react-native";

import { SelectMenu } from "../../components/select";
import { Button } from "../../components/ui";
import { useThemedStyles } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import { DiffCounts } from "./changed-file-row";
import { modeLabels } from "./use-changes";
import type { ChangesMode } from "./use-changes";

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    center: { flexShrink: 0 },
    container: {
      alignItems: "center",
      backgroundColor: colors.bg,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      height: 40,
      paddingHorizontal: 8,
    },
    left: { flex: 1, flexDirection: "row", minWidth: 0 },
    right: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "flex-end",
      minWidth: 0,
    },
  });

export const ChangesHeader = ({
  modes,
  mode,
  base,
  diffs,
  anyOpen,
  failed,
  onModeChange,
  onCompare,
  onToggleAll,
}: {
  modes: readonly ChangesMode[];
  mode: ChangesMode;
  base: string;
  diffs: readonly FileDiffInfo[];
  anyOpen: boolean;
  failed: boolean;
  onModeChange: (mode: ChangesMode) => void;
  onCompare: () => void;
  onToggleAll: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  const additions = diffs.reduce((sum, file) => sum + file.additions, 0);
  const deletions = diffs.reduce((sum, file) => sum + file.deletions, 0);
  const label =
    mode === "committed" && base
      ? `${modeLabels.committed} · ${base}`
      : modeLabels[mode];
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {!failed && (
          <SelectMenu
            appearance="inline"
            accessibilityLabel="Change source"
            value={mode}
            label={label}
            options={modes.map((value) => ({
              label: modeLabels[value],
              value,
            }))}
            actions={[
              {
                key: "base",
                label: base ? `Compare with ${base}…` : "Compare with…",
                onSelect: onCompare,
              },
            ]}
            onSelect={onModeChange}
          />
        )}
      </View>
      <View style={styles.center}>
        {additions + deletions > 0 && (
          <DiffCounts additions={additions} deletions={deletions} />
        )}
      </View>
      <View style={styles.right}>
        {diffs.length > 0 && (
          <Button
            title={anyOpen ? "Collapse all" : "Expand all"}
            size="small"
            variant="secondary"
            icon="chevron-grabber-vertical"
            onPress={onToggleAll}
          />
        )}
      </View>
    </View>
  );
};
