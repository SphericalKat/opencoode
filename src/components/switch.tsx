import React, { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { playHaptic } from "../lib/haptics";
import { useTheme } from "../lib/theme";
import { useMotionPreference } from "./motion";
import { touchTarget, usePressFeedback } from "./ui";

const TRACK_WIDTH = 24;
const TRACK_HEIGHT = 16;
const TRACK_PADDING = 2;
const THUMB_SIZE = 12;
const THUMB_TRAVEL = 8;
const MOTION_MS = 90;
const DISABLED_OPACITY = 0.5;
const RIPPLE_RADIUS = 20;
const thumbShadow = [
  { blurRadius: 0.5, color: "#00000066", offsetX: 0, offsetY: 0.5 },
];

const styles = StyleSheet.create({
  thumb: {
    borderColor: "#ffffff",
    borderRadius: 2,
    borderWidth: 0.5,
    boxShadow: thumbShadow,
    height: THUMB_SIZE,
    width: THUMB_SIZE,
  },
  touch: { alignItems: "center", justifyContent: "center" },
  track: {
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    height: TRACK_HEIGHT,
    padding: TRACK_PADDING - StyleSheet.hairlineWidth,
    width: TRACK_WIDTH,
  },
});

export const Switch = ({
  value,
  onValueChange,
  accessibilityLabel,
  disabled,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}) => {
  const { colors } = useTheme();
  const reduced = useMotionPreference();
  const { android_ripple } = usePressFeedback({
    borderless: true,
    radius: RIPPLE_RADIUS,
  });
  const progress = useSharedValue(value ? 1 : 0);
  const { switchTrackOff, switchTrackOn } = colors;
  useEffect(() => {
    cancelAnimation(progress);
    if (reduced) {
      progress.set(value ? 1 : 0);
      return;
    }
    progress.set(
      withTiming(value ? 1 : 0, {
        duration: MOTION_MS,
        easing: Easing.out(Easing.ease),
        reduceMotion: ReduceMotion.Never,
      })
    );
  }, [value, reduced, progress]);
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      [switchTrackOff, switchTrackOn]
    ),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.get(),
      [0, 1],
      ["#f2f2f2", "#eeeeee"]
    ),
    transform: [{ translateX: progress.get() * THUMB_TRAVEL }],
  }));
  const slopX = Math.max(0, (touchTarget - TRACK_WIDTH) / 2);
  const slopY = Math.max(0, (touchTarget - TRACK_HEIGHT) / 2);
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      android_ripple={disabled ? undefined : android_ripple}
      disabled={disabled}
      hitSlop={{ bottom: slopY, left: slopX, right: slopX, top: slopY }}
      onPress={() => {
        playHaptic("select");
        onValueChange(!value);
      }}
      style={[styles.touch, disabled && { opacity: DISABLED_OPACITY }]}
    >
      <Animated.View
        style={[styles.track, { borderColor: colors.borderStrong }, trackStyle]}
      >
        <Animated.View style={[styles.thumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
};
