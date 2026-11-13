import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";

// The shell shows a chat's message-selection bar over its tab strip, the way
// an Android contextual action bar replaces the toolbar, so the transcript
// below never moves. Several chats stay mounted in hidden tabs, so the slot
// remembers which chat owns the bar and ignores clears from the others.
interface SelectionBarSlot {
  get: () => ReactNode;
  set: (owner: string, node: ReactNode) => void;
  subscribe: (listener: () => void) => () => void;
}

const createSelectionBarSlot = (): SelectionBarSlot => {
  let owner: string | undefined;
  let current: ReactNode = null;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (nextOwner, node) => {
      if (node === null && owner !== nextOwner) {
        return;
      }
      owner = node === null ? undefined : nextOwner;
      if (node === current) {
        return;
      }
      current = node;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const SelectionBarContext = createContext<SelectionBarSlot | null>(null);

export const SelectionBarProvider = ({ children }: { children: ReactNode }) => {
  const slot = useMemo(() => createSelectionBarSlot(), []);
  return (
    <SelectionBarContext.Provider value={slot}>
      {children}
    </SelectionBarContext.Provider>
  );
};

// Returns false when no shell slot exists, so the caller renders the bar
// inline instead.
export const usePublishSelectionBar = (node: ReactNode) => {
  const slot = useContext(SelectionBarContext);
  const owner = useId();
  useLayoutEffect(() => {
    slot?.set(owner, node);
  });
  useLayoutEffect(() => () => slot?.set(owner, null), [slot, owner]);
  return slot !== null;
};

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER_DURATION = 180;
const EXIT_DURATION = 120;
const ENTER_OFFSET = -8;

const exiting = () => {
  "worklet";
  return {
    animations: {
      opacity: withTiming(0, { duration: EXIT_DURATION, easing: EASE_OUT }),
    },
    initialValues: { opacity: 1 },
  };
};

export const SelectionBarOverlay = () => {
  const slot = useContext(SelectionBarContext);
  const reduced = useReducedMotion();
  const node = useSyncExternalStore(
    slot?.subscribe ?? (() => () => null),
    slot?.get ?? (() => null)
  );
  const offset = reduced ? 0 : ENTER_OFFSET;
  const entering = () => {
    "worklet";
    return {
      animations: {
        opacity: withTiming(1, { duration: ENTER_DURATION, easing: EASE_OUT }),
        transform: [
          {
            translateY: withTiming(0, {
              duration: ENTER_DURATION,
              easing: EASE_OUT,
            }),
          },
        ],
      },
      initialValues: { opacity: 0, transform: [{ translateY: offset }] },
    };
  };
  if (!node) {
    return null;
  }
  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      style={StyleSheet.absoluteFill}
    >
      {node}
    </Animated.View>
  );
};
