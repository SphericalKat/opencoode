import { setStringAsync } from "expo-clipboard";

import { playHaptic } from "./haptics";

export const copyText = async (text: string) => {
  await setStringAsync(text);
  playHaptic("copy");
};
