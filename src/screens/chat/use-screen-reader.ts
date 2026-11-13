import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

import { noop } from "../../lib/async";

export const useScreenReader = () => {
  const [screenReader, setScreenReader] = useState(false);
  const screenReaderEnabled = useRef(screenReader);
  useLayoutEffect(() => {
    screenReaderEnabled.current = screenReader;
  });
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    let current = true;
    void AccessibilityInfo.isScreenReaderEnabled()
      .then((enabled) => {
        if (current) {
          setScreenReader(enabled);
        }
        return enabled;
      })
      .catch(noop);
    const subscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReader
    );
    return () => {
      current = false;
      subscription.remove();
    };
  }, []);
  return { screenReader, screenReaderEnabled };
};
