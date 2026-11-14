import { useCallback, useState } from "react";
import { useWindowDimensions } from "react-native";
import type { TextInputProps } from "react-native";

export const useComposerMetrics = () => {
  const { fontScale } = useWindowDimensions();
  const minimumComposerHeight = Math.max(44, Math.ceil(20 * fontScale + 24));
  const maximumComposerHeight = Math.max(180, minimumComposerHeight);
  const [composerHeight, setComposerHeight] = useState(minimumComposerHeight);
  const updateComposerHeight = useCallback<
    NonNullable<TextInputProps["onContentSizeChange"]>
  >(
    (event) =>
      setComposerHeight(
        Math.max(
          minimumComposerHeight,
          Math.min(maximumComposerHeight, event.nativeEvent.contentSize.height)
        )
      ),
    [minimumComposerHeight, maximumComposerHeight]
  );
  return {
    composerHeight,
    maximumComposerHeight,
    minimumComposerHeight,
    updateComposerHeight,
  };
};
