import { Platform } from "react-native";
import type { PressableAndroidRippleConfig, ViewStyle } from "react-native";

import { useTheme } from "../lib/theme";

export const touchTarget = Platform.OS === "android" ? 48 : 44;

export const usePressFeedback = (opts?: {
  borderless?: boolean;
  radius?: number;
}): {
  android_ripple?: PressableAndroidRippleConfig;
  pressedStyle: ViewStyle;
} => {
  const { colors } = useTheme();
  if (Platform.OS === "android") {
    return {
      android_ripple: {
        alpha: 0.12,
        borderless: !!opts?.borderless,
        color: colors.text,
        foreground: true,
        radius: opts?.radius,
      },
      pressedStyle: {},
    };
  }
  return { pressedStyle: { backgroundColor: colors.pressedOverlay } };
};
