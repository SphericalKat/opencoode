import React from "react";
import { StyleSheet, View } from "react-native";

import { pageInset } from "../lib/layout";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { BackButton } from "./back-button";
import { IconButton } from "./icon-button";
import { BodyText } from "./ui";

export { BackButton } from "./back-button";

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 16,
      minHeight: 56,
      paddingHorizontal: pageInset,
    },
    action: { marginEnd: -16 },
    title: { flex: 1, fontSize: 18, fontWeight: "600", lineHeight: 24 },
  });

export const HeaderMenuButton = ({ onPress }: { onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <IconButton
      icon="menu"
      size={32}
      borderless
      color={colors.text}
      accessibilityLabel="Open navigation"
      onPress={onPress}
    />
  );
};

export const HeaderRefreshButton = ({
  onPress,
  busy,
}: {
  onPress: () => void;
  busy?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <IconButton
      icon="refresh"
      size={32}
      borderless
      color={colors.text}
      accessibilityLabel="Refresh"
      busy={busy}
      onPress={onPress}
    />
  );
};

export const ScreenHeader = ({
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
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.header}>
      {onBack && (
        <BackButton
          accessibilityLabel={`Back to ${backLabel || "Sessions"}`}
          onPress={onBack}
        />
      )}
      <BodyText
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.title}
      >
        {title}
      </BodyText>
      {onRefresh && (
        <View style={styles.action}>
          <HeaderRefreshButton onPress={onRefresh} busy={refreshing} />
        </View>
      )}
      {onOpenNavigation && (
        <View style={styles.action}>
          <HeaderMenuButton onPress={onOpenNavigation} />
        </View>
      )}
    </View>
  );
};
