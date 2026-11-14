import React from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import type { GestureResponderEvent, StyleProp, ViewStyle } from "react-native";

import { useTheme } from "../lib/theme";
import { ShellIcon } from "./shell-icon";
import type { ShellIconName } from "./shell-icon";
import { touchTarget, usePressFeedback } from "./ui";

export type IconButtonSize = 24 | 28 | 32 | 44;

const defaultSize = 32;
const defaultIconSize = 16;
const borderlessRippleExtra = 4;
const disabledOpacity = 0.5;

const faceRadius = (size: IconButtonSize) => {
  if (size === 24) {
    return 4;
  }
  return size === 44 ? 8 : 6;
};

const styles = StyleSheet.create({
  face: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});

export const IconButton = ({
  icon,
  onPress,
  accessibilityLabel,
  size = defaultSize,
  iconSize = defaultIconSize,
  color,
  pressedColor,
  variant = "ghost",
  borderless,
  busy,
  disabled,
  selected,
  onLongPress,
  style,
  ref,
}: {
  icon: ShellIconName | ((color: string) => React.ReactNode);
  onPress: () => void;
  accessibilityLabel: string;
  size?: IconButtonSize;
  iconSize?: number;
  color?: string;
  pressedColor?: string;
  variant?: "ghost" | "secondary";
  borderless?: boolean;
  busy?: boolean;
  disabled?: boolean;
  selected?: boolean;
  onLongPress?: (e: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  ref?: React.Ref<React.ComponentRef<typeof Pressable>>;
}) => {
  const { colors } = useTheme();
  const inactive = !!disabled || !!busy;
  const { android_ripple, pressedStyle } = usePressFeedback({
    borderless,
    radius: borderless ? size / 2 + borderlessRippleExtra : undefined,
  });
  const iconColor = color ?? colors.muted;
  const slop = Math.max(0, (touchTarget - size) / 2);
  const face: ViewStyle = {
    borderRadius: faceRadius(size),
    height: size,
    width: size,
    ...(variant === "secondary" && {
      backgroundColor: colors.buttonNeutral,
      borderColor: colors.border,
      borderWidth: 1,
    }),
    ...(selected && { backgroundColor: colors.selected }),
    ...(inactive && { opacity: disabledOpacity }),
  };
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: !!busy, disabled: inactive, selected }}
      android_ripple={inactive ? undefined : android_ripple}
      disabled={inactive}
      hitSlop={slop}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.face,
        face,
        pressed && !inactive && pressedStyle,
        style,
      ]}
    >
      {({ pressed }) => {
        const current = pressed ? (pressedColor ?? iconColor) : iconColor;
        if (busy) {
          return <ActivityIndicator size="small" color={iconColor} />;
        }
        return typeof icon === "function" ? (
          icon(current)
        ) : (
          <ShellIcon name={icon} color={current} size={iconSize} />
        );
      }}
    </Pressable>
  );
};
