import { useCallback, useState } from "react";
import { useWindowDimensions } from "react-native";
import type { TextInputProps } from "react-native";

export const useComposerMetrics = (betaLayout: boolean) => {
  const { fontScale } = useWindowDimensions();
  const minimumComposerHeight = Math.max(
    44,
    Math.ceil(betaLayout ? 23 * fontScale + 20 : 25 * fontScale + 12)
  );
  const maximumComposerHeight = Math.max(120, minimumComposerHeight);
  const [composerHeight, setComposerHeight] = useState(44);
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
