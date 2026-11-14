import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { errorMessage } from "../lib/client";
import { useTheme } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import {
  SNACKBAR_DURATION_MS,
  SNACKBAR_SCREEN_READER_DURATION_MS,
  createSnackbarQueue,
} from "../lib/undo";
import type { DismissReason } from "../lib/undo";
import { elevation } from "./surface";
import { Button, sans } from "./ui";

interface ShowOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: (reason: DismissReason) => void;
}

interface RemoveOptions {
  message: string;
  commit: () => Promise<void>;
  onUndo?: () => void;
  failureMessage?: string;
}

interface SnackbarApi {
  show: (options: ShowOptions) => void;
  dismiss: () => void;
  setInset: (token: string, bottom: number) => void;
  remove: (scope: string, key: string, options: RemoveOptions) => void;
}

type HiddenByScope = Readonly<Record<string, ReadonlySet<string>>>;

const SNACKBAR_MAX_WIDTH = 320;
const SNACKBAR_MARGIN = 16;
const SWIPE_DISTANCE = 80;
const SWIPE_VELOCITY = 800;
const ENTER_MS = 280;
const EXIT_MS = 160;
const ENTER_OFFSET = 16;
const UNDO_LABEL = "Undo";
const enterEasing = Easing.bezier(0.2, 0, 0, 1);
const exitEasing = Easing.out(Easing.ease);
const emptySet: ReadonlySet<string> = new Set();

const scheduleTimeout = (fn: () => void, ms: number) => {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
};

const ApiContext = createContext<SnackbarApi | undefined>(undefined);
const useApi = (): SnackbarApi => {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error("Snackbar hooks must be used inside SnackbarProvider");
  }
  return api;
};
const { Pan: createPanGesture } = Gesture;
const HiddenContext = createContext<HiddenByScope>({});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    action: { flexShrink: 0 },
    card: {
      alignItems: "center",
      backgroundColor: colors.panel,
      borderRadius: 8,
      flexDirection: "row",
      gap: 12,
      padding: 12,
    },
    host: {
      alignItems: "center",
      bottom: 0,
      left: 0,
      position: "absolute",
      right: 0,
    },
    message: {
      color: colors.text,
      flex: 1,
      fontFamily: sans,
      fontSize: 13,
      fontWeight: "500",
      letterSpacing: -0.04,
      lineHeight: 20,
    },
  });

const commitRemoval = async (
  options: RemoveOptions,
  onFailure: (message: string) => void
) => {
  try {
    await options.commit();
  } catch (error) {
    onFailure(options.failureMessage ?? errorMessage(error));
  }
};

const SnackbarCard = ({
  actionLabel,
  message,
  onAction,
}: {
  actionLabel?: string;
  message: string;
  onAction: () => void;
}) => {
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth - SNACKBAR_MARGIN * 2, SNACKBAR_MAX_WIDTH);
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.card,
        { boxShadow: [...elevation(scheme).floating], width },
      ]}
    >
      <Text numberOfLines={2} style={styles.message}>
        {message}
      </Text>
      {actionLabel ? (
        <View style={styles.action}>
          <Button
            onPress={onAction}
            size="compact"
            title={actionLabel}
            variant="ghost"
          />
        </View>
      ) : null}
    </View>
  );
};

const SnackbarHost = ({
  inset,
  queue,
}: {
  inset: number;
  queue: ReturnType<typeof createSnackbarQueue>;
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const entry = useSyncExternalStore(queue.subscribe, queue.current);
  const [held, setHeld] = useState(entry);
  if (entry && held?.id !== entry.id) {
    setHeld(entry);
  }
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(ENTER_OFFSET);
  const translateX = useSharedValue(0);
  const entryId = entry?.id;

  const clearHeld = useCallback(() => {
    if (!queue.current()) {
      setHeld(undefined);
    }
  }, [queue]);

  useEffect(() => {
    if (entryId === undefined) {
      opacity.set(
        withTiming(
          0,
          {
            duration: EXIT_MS,
            easing: exitEasing,
            reduceMotion: ReduceMotion.System,
          },
          (finished) => {
            if (finished) {
              scheduleOnRN(clearHeld);
            }
          }
        )
      );
      return;
    }
    translateX.set(0);
    opacity.set(0);
    translateY.set(ENTER_OFFSET);
    const config = {
      duration: ENTER_MS,
      easing: enterEasing,
      reduceMotion: ReduceMotion.System,
    };
    opacity.set(withTiming(1, config));
    translateY.set(withTiming(0, config));
  }, [clearHeld, entryId, opacity, translateX, translateY]);

  const dismissBySwipe = useCallback(() => {
    const current = queue.current();
    if (current) {
      queue.dismiss(current.id, "swipe");
    }
  }, [queue]);

  const pan = useMemo(
    () =>
      createPanGesture()
        .activeOffsetX([-10, 10])
        .onUpdate((event) => {
          "worklet";
          translateX.set(event.translationX);
        })
        .onEnd((event) => {
          "worklet";
          const far = Math.abs(event.translationX) > SWIPE_DISTANCE;
          const fast = Math.abs(event.velocityX) > SWIPE_VELOCITY;
          if (far || fast) {
            scheduleOnRN(dismissBySwipe);
            return;
          }
          translateX.set(withSpring(0));
        }),
    [dismissBySwipe, translateX]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
    ],
  }));

  const shown = entry ?? held;
  if (!shown) {
    return null;
  }
  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + SNACKBAR_MARGIN + inset }]}
    >
      <GestureDetector gesture={pan}>
        <Animated.View
          pointerEvents={entry ? "auto" : "none"}
          style={animatedStyle}
        >
          <SnackbarCard
            actionLabel={shown.actionLabel}
            message={shown.message}
            onAction={() => queue.act(shown.id)}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
};

const useScreenReaderRef = () => {
  const ref = useRef(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const enabled = await AccessibilityInfo.isScreenReaderEnabled();
        if (active) {
          ref.current = enabled;
        }
      } catch {
        ref.current = false;
      }
    };
    load();
    const subscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      (enabled) => {
        ref.current = enabled;
      }
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return ref;
};

export const SnackbarProvider = ({ children }: { children: ReactNode }) => {
  const queue = useMemo(() => createSnackbarQueue(scheduleTimeout), []);
  const screenReader = useScreenReaderRef();
  const [hidden, setHidden] = useState<HiddenByScope>({});
  const [insets, setInsets] = useState<ReadonlyMap<string, number>>(new Map());

  useEffect(() => () => queue.dispose(), [queue]);

  const show = useCallback(
    (options: ShowOptions) => {
      queue.show({
        ...options,
        durationMs: screenReader.current
          ? SNACKBAR_SCREEN_READER_DURATION_MS
          : SNACKBAR_DURATION_MS,
      });
      AccessibilityInfo.announceForAccessibility(options.message);
    },
    [queue, screenReader]
  );

  const dismiss = useCallback(() => {
    const current = queue.current();
    if (current) {
      queue.dismiss(current.id, "swipe");
    }
  }, [queue]);

  const setInset = useCallback((token: string, bottom: number) => {
    setInsets((previous) => {
      if ((previous.get(token) ?? 0) === bottom) {
        return previous;
      }
      const next = new Map(previous);
      if (bottom > 0) {
        next.set(token, bottom);
      } else {
        next.delete(token);
      }
      return next;
    });
  }, []);

  const setKeyHidden = useCallback(
    (scope: string, key: string, isHidden: boolean) => {
      setHidden((previous) => {
        const scoped = previous[scope] ?? emptySet;
        if (scoped.has(key) === isHidden) {
          return previous;
        }
        const next = new Set(scoped);
        if (isHidden) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return { ...previous, [scope]: next };
      });
    },
    []
  );

  const remove = useCallback(
    (scope: string, key: string, options: RemoveOptions) => {
      setKeyHidden(scope, key, true);
      show({
        actionLabel: UNDO_LABEL,
        message: options.message,
        onAction: () => {
          setKeyHidden(scope, key, false);
          options.onUndo?.();
        },
        onDismiss: (reason) => {
          if (reason === "action") {
            return;
          }
          commitRemoval(options, (message) => {
            setKeyHidden(scope, key, false);
            show({ message });
          });
        },
      });
    },
    [setKeyHidden, show]
  );

  const api = useMemo<SnackbarApi>(
    () => ({ dismiss, remove, setInset, show }),
    [dismiss, remove, setInset, show]
  );
  const inset = Math.max(0, ...insets.values());

  return (
    <ApiContext.Provider value={api}>
      <HiddenContext.Provider value={hidden}>
        {children}
        <SnackbarHost inset={inset} queue={queue} />
      </HiddenContext.Provider>
    </ApiContext.Provider>
  );
};

export const useSnackbar = () => {
  const { dismiss, show } = useApi();
  return useMemo(() => ({ dismiss, show }), [dismiss, show]);
};

export const useSnackbarInset = (bottom: number) => {
  const { setInset } = useApi();
  const token = useId();
  useEffect(() => {
    setInset(token, bottom);
    return () => setInset(token, 0);
  }, [bottom, setInset, token]);
};

export const useUndoableRemoval = <K extends string>(scope: string) => {
  const { remove: removeScoped } = useApi();
  const hidden = useContext(HiddenContext)[scope] ?? emptySet;
  const remove = useCallback(
    (key: K, options: RemoveOptions) => removeScoped(scope, key, options),
    [removeScoped, scope]
  );
  return { hidden: hidden as ReadonlySet<K>, remove };
};
