import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { LayoutChangeEvent } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { playHaptic } from "../lib/haptics";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { useMotionPreference } from "./motion";
import { sans, usePressFeedback } from "./ui";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

const HEIGHT = 28;
const RADIUS = 6;
const ITEM_PADDING = 12;
const SLIDE_MS = 150;
const DISABLED_OPACITY = 0.45;
const HIT_SLOP = 10;
const slide = Easing.bezier(0.23, 1, 0.32, 1);

interface Slot {
  x: number;
  width: number;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    fill: { width: "100%" },
    itemFill: { flex: 1, minWidth: 0 },
    fit: { alignSelf: "flex-start" },
    indicator: {
      backgroundColor: colors.bg,
      borderColor: colors.borderStrong,
      borderRadius: RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      bottom: 0,
      position: "absolute",
      top: 0,
    },
    item: {
      alignItems: "center",
      borderRadius: RADIUS,
      height: HEIGHT,
      justifyContent: "center",
      overflow: "hidden",
      paddingHorizontal: ITEM_PADDING,
    },
    itemSelected: {
      backgroundColor: colors.bg,
      borderColor: colors.borderStrong,
      borderWidth: StyleSheet.hairlineWidth,
    },
    label: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      fontWeight: "400",
      letterSpacing: -0.04,
      lineHeight: 16,
    },
    labelSelected: { color: colors.text },
    root: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: RADIUS,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      height: HEIGHT,
    },
  });

const Segment = <T extends string>({
  option,
  checked,
  disabled,
  measured,
  fill,
  onLayout,
  onSelect,
}: {
  option: SegmentOption<T>;
  checked: boolean;
  disabled: boolean;
  measured: boolean;
  fill: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onSelect: () => void;
}) => {
  const styles = useThemedStyles(createStyles);
  const { android_ripple, pressedStyle } = usePressFeedback({});
  return (
    <Pressable
      accessibilityLabel={option.label}
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      android_ripple={disabled ? undefined : android_ripple}
      disabled={disabled}
      hitSlop={{ bottom: HIT_SLOP, top: HIT_SLOP }}
      onLayout={onLayout}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.item,
        fill && styles.itemFill,
        checked && !measured && styles.itemSelected,
        pressed && !disabled && pressedStyle,
        disabled && { opacity: DISABLED_OPACITY },
      ]}
    >
      <Animated.Text
        numberOfLines={1}
        style={[styles.label, checked && styles.labelSelected]}
      >
        {option.label}
      </Animated.Text>
    </Pressable>
  );
};

export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled,
  fullWidth = true,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  fullWidth?: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const reduced = useMotionPreference();
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const slot = slots[value];
  const measured = slot !== undefined;
  const slotX = slot?.x;
  const slotWidth = slot?.width;
  const placed = useRef(false);
  useEffect(() => {
    if (slotX === undefined || slotWidth === undefined) {
      return;
    }
    cancelAnimation(x);
    cancelAnimation(width);
    if (reduced || !placed.current) {
      placed.current = true;
      x.set(slotX);
      width.set(slotWidth);
      return;
    }
    const config = {
      duration: SLIDE_MS,
      easing: slide,
      reduceMotion: ReduceMotion.Never,
    };
    x.set(withTiming(slotX, config));
    width.set(withTiming(slotWidth, config));
  }, [slotX, slotWidth, reduced, x, width]);
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    width: width.get(),
  }));
  const choose = (next: T) => {
    if (next === value) {
      return;
    }
    playHaptic("select");
    onChange(next);
  };
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={[styles.root, fullWidth ? styles.fill : styles.fit]}
    >
      {measured && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { backgroundColor: colors.bg },
            indicatorStyle,
          ]}
        />
      )}
      {options.map((option) => (
        <Segment
          key={option.value}
          option={option}
          checked={option.value === value}
          disabled={!!disabled || !!option.disabled}
          measured={measured}
          fill={fullWidth}
          onLayout={(event) => {
            const { x: left, width: size } = event.nativeEvent.layout;
            setSlots((current) => {
              const known = current[option.value];
              if (known?.x === left && known.width === size) {
                return current;
              }
              return { ...current, [option.value]: { width: size, x: left } };
            });
          }}
          onSelect={() => choose(option.value)}
        />
      ))}
    </View>
  );
};
