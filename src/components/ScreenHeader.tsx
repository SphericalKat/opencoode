import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { pageInset } from "../lib/layout";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { ShellIcon } from "./ShellIcon";
import { BodyText } from "./ui";

export function ScreenHeader({
  title,
  backLabel,
  onBack,
  onOpenNavigation,
  onRefresh,
  refreshing,
}: {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  onOpenNavigation?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.header}>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Back to ${backLabel || "Sessions"}`}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ShellIcon name="back" color={colors.text} size={22} />
        </Pressable>
      )}
      <BodyText
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.title}
      >
        {title}
      </BodyText>
      {onRefresh && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          accessibilityState={{ busy: refreshing, disabled: refreshing }}
          disabled={refreshing}
          onPress={() => onRefresh()}
          style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <ShellIcon name="refresh" color={colors.text} />
          )}
        </Pressable>
      )}
      {onOpenNavigation && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation"
          onPress={onOpenNavigation}
          style={({ pressed }) => [styles.menu, pressed && styles.pressed]}
        >
          <ShellIcon name="menu" color={colors.text} />
        </Pressable>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    back: {
      alignItems: "center",
      borderRadius: 6,
      height: Platform.OS === "android" ? 48 : 44,
      justifyContent: "center",
      marginEnd: 8,
      marginStart: -16,
      width: Platform.OS === "android" ? 48 : 44,
    },
    header: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 16,
      minHeight: 56,
      paddingHorizontal: pageInset,
    },
    menu: {
      alignItems: "center",
      borderRadius: 6,
      height: Platform.OS === "android" ? 48 : 44,
      justifyContent: "center",
      marginEnd: -16,
      width: Platform.OS === "android" ? 48 : 44,
    },
    pressed: { backgroundColor: colors.selected },
    title: { flex: 1, fontSize: 18, fontWeight: "600", lineHeight: 24 },
  });
