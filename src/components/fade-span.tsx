import { useEffect } from "react";
import Animated, {
  Easing,
  ReduceMotion,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { REVEAL_DURATION, withAlpha } from "../lib/stream-reveal";

// A nested Text has no reliable opacity on native, so the span fades its
// inherited color's alpha instead. The animation runs on the UI thread and
// starts when the span mounts, not when its text arrived, so a slow render
// cannot skip the start of the fade.
export const FadeSpan = ({
  text,
  color,
  selectable,
}: {
  text: string;
  color: string;
  selectable: boolean;
}) => {
  const progress = useSharedValue(0);
  const hidden = withAlpha(color, 0) ?? color;
  useEffect(() => {
    progress.set(
      withTiming(1, {
        duration: REVEAL_DURATION,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      })
    );
  }, [progress]);
  const fade = useAnimatedStyle(() => ({
    color: interpolateColor(progress.get(), [0, 1], [hidden, color]),
  }));
  return (
    <Animated.Text selectable={selectable} style={fade}>
      {text}
    </Animated.Text>
  );
};
