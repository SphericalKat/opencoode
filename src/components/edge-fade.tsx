import { useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const DEFAULT_WIDTH = 16;

const styles = StyleSheet.create({
  fade: { bottom: 0, position: "absolute", top: 0 },
});

// Marks hidden content at the edge of a horizontal scroller. It draws the
// surface color over the content, so `color` must match the background below.
export const EdgeFade = ({
  side,
  color,
  width = DEFAULT_WIDTH,
}: {
  side: "left" | "right";
  color: string;
  width?: number;
}) => {
  const id = `edge-fade-${useId()}`;
  const solid = side === "left" ? 1 : 0;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.fade,
        { width },
        side === "left" ? { left: 0 } : { right: 0 },
      ]}
    >
      <Svg width={width} height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={solid} />
            <Stop offset="1" stopColor={color} stopOpacity={1 - solid} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
};
