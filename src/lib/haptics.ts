import {
  AndroidHaptics,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  performAndroidHapticsAsync,
  selectionAsync,
} from "expo-haptics";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";

import { noop } from "./async";
import { loadHapticsEnabled, saveHapticsEnabled } from "./storage";

export type Haptic =
  | "streamTick"
  | "send"
  | "stop"
  | "longPress"
  | "success"
  | "failure"
  | "attention"
  | "copy"
  | "threshold"
  | "select";

interface AndroidEffect {
  minApi: number;
  type: AndroidHaptics;
}

// Android effects go through View.performHapticFeedback, which follows the
// system touch-feedback setting. The Vibrator-based expo-haptics calls feel
// buzzy on Android. Each list runs from the preferred effect to its fallback,
// because performAndroidHapticsAsync throws below an effect's API level.
const ANDROID: Record<Haptic, AndroidEffect[]> = {
  attention: [{ minApi: 0, type: AndroidHaptics.Long_Press }],
  copy: [
    { minApi: 30, type: AndroidHaptics.Confirm },
    { minApi: 0, type: AndroidHaptics.Context_Click },
  ],
  failure: [
    { minApi: 30, type: AndroidHaptics.Reject },
    { minApi: 0, type: AndroidHaptics.Long_Press },
  ],
  longPress: [{ minApi: 0, type: AndroidHaptics.Long_Press }],
  select: [
    { minApi: 34, type: AndroidHaptics.Segment_Tick },
    { minApi: 0, type: AndroidHaptics.Clock_Tick },
  ],
  send: [{ minApi: 0, type: AndroidHaptics.Keyboard_Tap }],
  stop: [
    { minApi: 30, type: AndroidHaptics.Gesture_End },
    { minApi: 0, type: AndroidHaptics.Context_Click },
  ],
  streamTick: [
    { minApi: 34, type: AndroidHaptics.Segment_Frequent_Tick },
    { minApi: 27, type: AndroidHaptics.Text_Handle_Move },
  ],
  success: [
    { minApi: 30, type: AndroidHaptics.Confirm },
    { minApi: 0, type: AndroidHaptics.Context_Click },
  ],
  threshold: [
    { minApi: 34, type: AndroidHaptics.Segment_Tick },
    { minApi: 0, type: AndroidHaptics.Clock_Tick },
  ],
};

const IOS: Record<Haptic, () => Promise<void>> = {
  attention: () => notificationAsync(NotificationFeedbackType.Warning),
  copy: () => impactAsync(ImpactFeedbackStyle.Light),
  failure: () => notificationAsync(NotificationFeedbackType.Error),
  longPress: () => impactAsync(ImpactFeedbackStyle.Medium),
  select: selectionAsync,
  send: () => impactAsync(ImpactFeedbackStyle.Light),
  stop: () => impactAsync(ImpactFeedbackStyle.Medium),
  streamTick: selectionAsync,
  success: () => notificationAsync(NotificationFeedbackType.Success),
  threshold: selectionAsync,
};

const apiLevel = Platform.OS === "android" ? Number(Platform.Version) : 0;

// The soft Android 14 tick tolerates a faster rate than its older fallback.
export const STREAM_TICK_INTERVAL = apiLevel >= 34 ? 70 : 120;

const androidEffect = (haptic: Haptic) =>
  ANDROID[haptic].find((effect) => apiLevel >= effect.minApi)?.type;

let enabled = true;
let preferenceChanged = false;
const listeners = new Set<() => void>();

if (Platform.OS !== "web") {
  void loadHapticsEnabled()
    .then((stored) => {
      if (!preferenceChanged) {
        enabled = stored;
        for (const listener of listeners) {
          listener();
        }
      }
      return null;
    })
    .catch(noop);
}

export const playHaptic = (haptic: Haptic) => {
  if (!enabled) {
    return;
  }
  if (Platform.OS === "ios") {
    void IOS[haptic]().catch(noop);
    return;
  }
  const effect = Platform.OS === "android" ? androidEffect(haptic) : undefined;
  if (effect) {
    void performAndroidHapticsAsync(effect).catch(noop);
  }
};

export const setHapticsEnabled = async (next: boolean) => {
  preferenceChanged = true;
  await saveHapticsEnabled(next);
  enabled = next;
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useHapticsEnabled = () =>
  useSyncExternalStore(subscribe, () => enabled);
