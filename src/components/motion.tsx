import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, Platform, StyleSheet } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  cubicBezier,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";

const easePress = cubicBezier(0.23, 1, 0.32, 1);
const easeContent = Easing.bezier(0.23, 1, 0.32, 1);

const styles = StyleSheet.create({
  indicator: { alignItems: "center", flexShrink: 0, justifyContent: "center" },
  pressContent: { alignItems: "center", justifyContent: "center" },
  screen: { flex: 1, minHeight: 0, minWidth: 0 },
});

const disclosureDuration = (reduced: boolean, open: boolean): number => {
  if (reduced) {
    return 80;
  }
  return open ? 140 : 110;
};

const contentDuration = (
  variant: "context" | "connection",
  reduced: boolean
): number => {
  if (variant === "context") {
    return reduced ? 80 : 120;
  }
  return reduced ? 100 : 180;
};

export const useMotionPreference = () => {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (live) {
          setReduced(value);
        }
        return value;
      })
      .catch(() => false);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced
    );
    return () => {
      live = false;
      subscription?.remove();
    };
  }, []);
  return reduced;
};

export const PressFeedback = ({
  pressed,
  disabled,
  children,
  style,
}: {
  pressed: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const reduced = useMotionPreference();
  const down = pressed && !disabled;
  const opacity = StyleSheet.flatten(style)?.opacity ?? 1;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pressContent,
        style,
        {
          opacity: opacity * (reduced && down ? 0.88 : 1),
          transform: [
            { translateY: !reduced && down ? 1 : 0 },
            { scale: !reduced && down ? 0.97 : 1 },
          ],
          transitionDuration: 120,
          transitionProperty: reduced ? "none" : "transform",
          transitionTimingFunction: easePress,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export const MotionDisclosureChevron = ({
  open,
  children,
  style,
}: {
  open: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const reduced = useMotionPreference();
  return (
    <Animated.View
      aria-hidden
      style={[
        styles.indicator,
        style,
        {
          transform: [{ rotate: open ? "90deg" : "0deg" }],
          transitionDuration: 140,
          transitionProperty: reduced ? "none" : "transform",
          transitionTimingFunction: easePress,
        },
      ]}
    >
      {children}
    </Animated.View>
  );
};

export const MotionDisclosureBody = ({
  open,
  children,
  style,
}: {
  open: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const reduced = useMotionPreference();
  const [presented, setPresented] = useState(open);
  const progress = useSharedValue(open ? 1 : 0);
  const initial = useRef(true);
  const alive = useRef(true);
  const requested = useRef(open);
  useLayoutEffect(() => {
    requested.current = open;
  });
  if (open && !presented) {
    setPresented(true);
  }
  const revision = useRef(0);
  const finishClose = useCallback((request: number) => {
    if (alive.current && request === revision.current && !requested.current) {
      setPresented(false);
    }
  }, []);
  useLayoutEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    revision.current += 1;
    const request = revision.current;
    cancelAnimation(progress);
    progress.set(
      withTiming(
        open ? 1 : 0,
        {
          duration: disclosureDuration(reduced, open),
          easing: easeContent,
          reduceMotion: ReduceMotion.Never,
        },
        (finished) => {
          if (finished && !open) {
            scheduleOnRN(finishClose, request);
          }
        }
      )
    );
  }, [open, reduced, progress, finishClose]);
  useEffect(() => {
    const counter = revision;
    alive.current = true;
    return () => {
      alive.current = false;
      counter.current += 1;
      cancelAnimation(progress);
    };
  }, [progress]);
  const reveal = useAnimatedStyle(
    () => ({
      opacity: progress.get(),
      transform: [{ translateY: reduced ? 0 : -3 * (1 - progress.get()) }],
    }),
    Platform.OS === "web" ? [reduced] : undefined
  );
  if (!presented) {
    return null;
  }
  return (
    <Animated.View
      pointerEvents={open ? "auto" : "none"}
      accessibilityElementsHidden={!open}
      importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      style={[style, reveal]}
    >
      {children}
    </Animated.View>
  );
};

export const MotionScreen = ({
  visible,
  children,
  style,
}: {
  visible: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const reduced = useMotionPreference();
  const progress = useSharedValue(0);
  const previousVisible = useRef(false);

  useLayoutEffect(() => {
    const wasVisible = previousVisible.current;
    previousVisible.current = visible;
    cancelAnimation(progress);
    if (!visible) {
      progress.set(0);
    } else if (wasVisible) {
      progress.set(1);
    } else {
      progress.set(0);
      progress.set(
        withTiming(1, {
          duration: reduced ? 100 : 170,
          easing: easeContent,
          reduceMotion: ReduceMotion.Never,
        })
      );
    }
  }, [visible, reduced, progress]);
  useEffect(() => () => cancelAnimation(progress), [progress]);

  const entry = useAnimatedStyle(
    () => ({
      opacity: visible ? progress.get() : 0,
      transform: [
        { translateX: visible && !reduced ? 8 * (1 - progress.get()) : 0 },
      ],
    }),
    Platform.OS === "web" ? [reduced, visible] : undefined
  );

  return (
    <Animated.View
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.screen, style, entry]}
    >
      {children}
    </Animated.View>
  );
};

export const MotionContent = ({
  transitionKey,
  variant,
  direction = 1,
  enabled = true,
  children,
  style,
}: {
  transitionKey: string | number | boolean;
  variant: "context" | "connection";
  direction?: -1 | 0 | 1;
  enabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) => {
  const reduced = useMotionPreference();
  const progress = useSharedValue(1);
  const previous = useRef(transitionKey);
  useLayoutEffect(() => {
    const changed = previous.current !== transitionKey;
    previous.current = transitionKey;
    cancelAnimation(progress);
    if (!changed || !enabled || (variant === "connection" && direction === 0)) {
      progress.set(1);
      return;
    }
    progress.set(0);
    progress.set(
      withTiming(1, {
        duration: contentDuration(variant, reduced),
        easing: easeContent,
        reduceMotion: ReduceMotion.Never,
      })
    );
  }, [transitionKey, variant, direction, enabled, reduced, progress]);
  useEffect(() => () => cancelAnimation(progress), [progress]);
  const entry = useAnimatedStyle(
    () => {
      let opacity: number;
      if (reduced) {
        opacity = 0.9 + progress.get() * 0.1;
      } else if (variant === "context") {
        opacity = 0.75 + progress.get() * 0.25;
      } else {
        opacity = 0.8 + progress.get() * 0.2;
      }
      return {
        opacity,
        transform: [
          {
            translateX:
              variant === "connection" && !reduced
                ? direction * 12 * (1 - progress.get())
                : 0,
          },
        ],
      };
    },
    Platform.OS === "web" ? [variant, direction, reduced] : undefined
  );
  return <Animated.View style={[style, entry]}>{children}</Animated.View>;
};

export const WorkingIndicator = ({
  active,
  color,
  size = 16,
}: {
  active: boolean;
  color: string;
  size?: number;
}) => {
  const reduced = useMotionPreference();
  const rotation = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(rotation);
    rotation.set(0);
    if (active && !reduced) {
      rotation.set(
        withRepeat(
          withTiming(360, {
            duration: 1000,
            easing: Easing.linear,
            reduceMotion: ReduceMotion.System,
          }),
          -1,
          false
        )
      );
    }
    return () => cancelAnimation(rotation);
  }, [active, reduced, rotation]);
  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.get()}deg` }],
  }));
  return (
    <Animated.View
      aria-hidden
      style={[styles.indicator, { height: size, width: size }, spin]}
    >
      <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <Circle
          cx="8"
          cy="8"
          r="5.5"
          stroke={color}
          strokeOpacity={0.2}
          strokeWidth="1.5"
        />
        <Circle
          cx="8"
          cy="8"
          r="5.5"
          stroke={color}
          strokeWidth="1.5"
          strokeDasharray="12 23"
          strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  );
};
