import { useCallback, useId, useState } from "react";
import { StyleSheet, View } from "react-native";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const DEFAULT_WIDTH = 16;
const SCROLL_SLACK = 1;

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

// Tracks which ends of a horizontal scroller hide content. Spread `handlers`
// onto the ScrollView and render an EdgeFade for each true edge.
export const useHorizontalEdges = () => {
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => setViewport(event.nativeEvent.layout.width),
    []
  );
  const onContentSizeChange = useCallback(
    (width: number) => setContent(width),
    []
  );
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      setOffset(event.nativeEvent.contentOffset.x),
    []
  );
  const overflows = content > viewport + SCROLL_SLACK;
  return {
    left: overflows && offset > SCROLL_SLACK,
    right: overflows && offset + viewport < content - SCROLL_SLACK,
    handlers: {
      onContentSizeChange,
      onLayout,
      onScroll,
      scrollEventThrottle: 16,
    },
  };
};
