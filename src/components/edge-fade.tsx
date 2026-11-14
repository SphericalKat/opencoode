import { useCallback, useId, useState } from "react";
import { StyleSheet, View } from "react-native";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

export type Edge = "left" | "right" | "top" | "bottom";
export type ScrollAxis = "x" | "y";

const DEFAULT_SIZE = 16;
const SCROLL_SLACK = 1;

const styles = StyleSheet.create({
  fade: { position: "absolute" },
});

const edgeBox = (side: Edge, size: number) =>
  side === "left" || side === "right"
    ? { bottom: 0, top: 0, width: size, [side]: 0 }
    : { height: size, left: 0, right: 0, [side]: 0 };

// Gradient endpoints that run from the edge, where the fade is solid, inward.
const vectors: Record<Edge, [string, string, string, string]> = {
  bottom: ["0", "1", "0", "0"],
  left: ["0", "0", "1", "0"],
  right: ["1", "0", "0", "0"],
  top: ["0", "0", "0", "1"],
};

// Marks hidden content at the edge of a scroller. It draws the surface color
// over the content, so `color` must match the background below.
export const EdgeFade = ({
  side,
  color,
  size = DEFAULT_SIZE,
}: {
  side: Edge;
  color: string;
  size?: number;
}) => {
  const id = `edge-fade-${useId()}`;
  const [x1, y1, x2, y2] = vectors[side];
  return (
    <View pointerEvents="none" style={[styles.fade, edgeBox(side, size)]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
};

// Tracks which ends of a scroller hide content. Spread `handlers` onto the
// scroller and render an EdgeFade for each true end.
export const useScrollEdges = (axis: ScrollAxis) => {
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setViewport(axis === "x" ? width : height);
    },
    [axis]
  );
  const onContentSizeChange = useCallback(
    (width: number, height: number) =>
      setContent(axis === "x" ? width : height),
    [axis]
  );
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { x, y } = event.nativeEvent.contentOffset;
      setOffset(axis === "x" ? x : y);
    },
    [axis]
  );
  const overflows = content > viewport + SCROLL_SLACK;
  return {
    end: overflows && offset + viewport < content - SCROLL_SLACK,
    handlers: {
      onContentSizeChange,
      onLayout,
      onScroll,
      scrollEventThrottle: 16,
    },
    start: overflows && offset > SCROLL_SLACK,
  };
};
