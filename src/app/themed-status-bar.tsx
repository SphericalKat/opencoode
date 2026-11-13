import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { Platform } from "react-native";

import { useTheme } from "../lib/theme";

export const ThemedStatusBar = () => {
  const { scheme, colors } = useTheme();
  const background = colors.frame;
  useEffect(() => {
    if (Platform.OS !== "web") {
      void SystemUI.setBackgroundColorAsync(background);
    }
  }, [background]);
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
};
