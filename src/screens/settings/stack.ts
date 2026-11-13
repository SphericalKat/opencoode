import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";
import type { ViewStyle } from "react-native";

import type { Section } from "./sections";

export type SettingsStackParams = Record<"Index", undefined> &
  Record<"Section", { section: Section }>;
export const SettingsStack = createNativeStackNavigator<SettingsStackParams>();
export const zeroInsets = { bottom: 0, left: 0, right: 0, top: 0 };
// The native toolbar supplies its inset before the shared back control applies its own margins.
export const nativeBackInsets = Platform.select<ViewStyle>({
  android: { marginEnd: 33, marginStart: -7 },
  ios: { height: 44, justifyContent: "center", minWidth: 44 },
});
