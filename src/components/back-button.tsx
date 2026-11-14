import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { touchTarget, usePressFeedback } from "./press-feedback";
import { ShellIcon } from "./shell-icon";

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    back: {
      alignItems: "center",
      borderRadius: 6,
      height: touchTarget,
      justifyContent: "center",
      marginStart: -12,
      width: touchTarget,
    },
    backLabel: {
      alignItems: "center",
      borderRadius: 4,
      flexDirection: "row",
      gap: 6,
      height: 32,
      paddingHorizontal: 6,
    },
    backLabelText: {
      color: colors.muted,
      fontFamily: "Inter",
      fontSize: 13,
      fontWeight: "400",
      lineHeight: 16,
    },
    disabled: { opacity: 0.5 },
  });

const backLabelSlop = (touchTarget - 32) / 2;

export const BackButton = ({
  onPress,
  accessibilityLabel,
  label,
  disabled,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  label?: string;
  disabled?: boolean;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const iconOnly = label === undefined;
  const { android_ripple, pressedStyle } = usePressFeedback(
    iconOnly ? { borderless: true, radius: 20 } : undefined
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={
        iconOnly ? undefined : { bottom: backLabelSlop, top: backLabelSlop }
      }
      onPress={onPress}
      android_ripple={android_ripple}
      style={({ pressed }) => [
        iconOnly ? styles.back : styles.backLabel,
        pressed && pressedStyle,
        disabled && styles.disabled,
      ]}
    >
      {iconOnly ? (
        <ShellIcon name="back" color={colors.text} size={20} />
      ) : (
        <>
          <ShellIcon name="back" color={colors.muted} size={16} />
          <Text numberOfLines={1} style={styles.backLabelText}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
};
