import type { FlashListRef } from "@shopify/flash-list";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Keyboard, Platform } from "react-native";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { KeyboardEvents } from "react-native-keyboard-controller";

import type { TranscriptItem } from "../../components/assistant-turn";
import { noop } from "../../lib/async";
import type { Panel, Alive, SetPanel } from "./types";

interface UseTranscriptScrollOptions {
  alive: Alive;
  foreground: boolean;
  panel: Panel;
  screenReaderEnabled: React.RefObject<boolean>;
  setPanel: SetPanel;
  setSelectedMessageID: React.Dispatch<React.SetStateAction<string | null>>;
  visible: boolean;
}

export const useTranscriptScroll = ({
  alive,
  foreground,
  panel,
  screenReaderEnabled,
  setPanel,
  setSelectedMessageID,
  visible,
}: UseTranscriptScrollOptions) => {
  const [followingLatest, setFollowingLatest] = useState(true);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const list = useRef<FlashListRef<TranscriptItem>>(null);
  const nearEnd = useRef(true);
  const scrollMetrics = useRef({ content: 0, offset: 0, viewport: 0 });
  const followingLatestRef = useRef(true);
  const userScrolling = useRef(false);
  const wheelDirection = useRef(0);
  const webScrollCleanup = useRef<() => void>(noop);
  const followKeyboard = useRef(false);
  const followFrame = useRef<number | undefined>(undefined);
  const transcriptVisible = useRef(visible);
  const expandedParts = useRef(new Set<string>());
  useLayoutEffect(() => {
    transcriptVisible.current = visible;
  });
  const setFollowing = useCallback((follow: boolean) => {
    followingLatestRef.current = follow;
    if (!follow && followFrame.current !== undefined) {
      cancelAnimationFrame(followFrame.current);
      followFrame.current = undefined;
    }
    setAwayFromLatest(follow ? false : !nearEnd.current);
    setFollowingLatest((current) => (current === follow ? current : follow));
  }, []);
  const disclosures = useMemo(
    () => ({
      isOpen: (key: string) => expandedParts.current.has(key),
      setOpen: (key: string, open: boolean) => {
        if (open) {
          expandedParts.current.add(key);
        } else {
          expandedParts.current.delete(key);
        }
      },
      toggle: (key: string) => {
        followKeyboard.current = false;
        setFollowing(false);
        const open = !expandedParts.current.has(key);
        if (open) {
          expandedParts.current.add(key);
        } else {
          expandedParts.current.delete(key);
        }
        return open;
      },
    }),
    [setFollowing]
  );
  const selectMessage = useCallback(
    (id: string) => {
      followKeyboard.current = false;
      setFollowing(false);
      Keyboard.dismiss();
      setSelectedMessageID(id);
      if (screenReaderEnabled.current) {
        setPanel("message");
      }
    },
    [setFollowing, setSelectedMessageID, screenReaderEnabled, setPanel]
  );
  const followContent = useCallback(() => {
    if (
      !followingLatestRef.current ||
      userScrolling.current ||
      !transcriptVisible.current ||
      followFrame.current !== undefined
    ) {
      return;
    }
    followFrame.current = requestAnimationFrame(() => {
      followFrame.current = undefined;
      if (
        !alive.current ||
        !followingLatestRef.current ||
        userScrolling.current ||
        !transcriptVisible.current
      ) {
        return;
      }
      list.current?.scrollToEnd({ animated: false });
    });
  }, [alive]);
  useEffect(
    () => () => {
      if (followFrame.current !== undefined) {
        cancelAnimationFrame(followFrame.current);
      }
    },
    []
  );
  useEffect(() => {
    if (!visible && followFrame.current !== undefined) {
      cancelAnimationFrame(followFrame.current);
      followFrame.current = undefined;
    }
    if (visible) {
      followContent();
    }
  }, [visible, followContent]);
  const jumpToLatest = useCallback(() => {
    userScrolling.current = false;
    wheelDirection.current = 0;
    setFollowing(true);
    nearEnd.current = true;
    setAwayFromLatest(false);
    setSelectedMessageID(null);
    list.current?.scrollToEnd({ animated: false });
  }, [setFollowing, setSelectedMessageID]);
  const measureEndDistance = useCallback(() => {
    const { content, viewport, offset } = scrollMetrics.current;
    const nextNearEnd = content - offset - viewport <= 48;
    if (nextNearEnd !== nearEnd.current) {
      nearEnd.current = nextNearEnd;
      if (!followingLatestRef.current) {
        setAwayFromLatest(!nextNearEnd);
      }
    }
  }, []);
  const contentSizeChanged = useCallback(
    (_width: number, height: number) => {
      scrollMetrics.current.content = height;
      measureEndDistance();
      followContent();
    },
    [measureEndDistance, followContent]
  );
  const transcriptLayoutChanged = useCallback(
    (event: LayoutChangeEvent) => {
      scrollMetrics.current.viewport = event.nativeEvent.layout.height;
      measureEndDistance();
      followContent();
    },
    [measureEndDistance, followContent]
  );
  const updateScrollPosition = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } =
        event.nativeEvent;
      scrollMetrics.current = {
        content: contentSize.height,
        offset: contentOffset.y,
        viewport: layoutMeasurement.height,
      };
      measureEndDistance();
      if (
        Platform.OS === "web" &&
        userScrolling.current &&
        nearEnd.current &&
        wheelDirection.current >= 0
      ) {
        setFollowing(true);
      }
    },
    [setFollowing, measureEndDistance]
  );
  const beginUserScroll = useCallback(() => {
    userScrolling.current = true;
    followKeyboard.current = false;
    setFollowing(false);
  }, [setFollowing]);
  const finishUserScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      updateScrollPosition(event);
      userScrolling.current = false;
      setFollowing(nearEnd.current);
    },
    [updateScrollPosition, setFollowing]
  );
  const attachWebScroll = useCallback(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const node = list.current?.getScrollableNode();
    if (!(node instanceof HTMLElement)) {
      return;
    }
    webScrollCleanup.current();
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }
      if (event.deltaY > 0 && nearEnd.current) {
        userScrolling.current = false;
        setFollowing(true);
        return;
      }
      userScrolling.current = true;
      wheelDirection.current = event.deltaY;
      followKeyboard.current = false;
      if (event.deltaY < 0) {
        setFollowing(false);
      }
    };
    const touch = () => {
      wheelDirection.current = 0;
      beginUserScroll();
    };
    const end = () => {
      if (userScrolling.current) {
        userScrolling.current = false;
        setFollowing(nearEnd.current);
      }
    };
    const selectedRow = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>('[id^="chat-message-"]')
        : null;
    const openContextMenu = (event: MouseEvent) => {
      const row = selectedRow(event.target);
      if (!row) {
        return;
      }
      event.preventDefault();
      selectMessage(
        decodeURIComponent(row.id.slice("chat-message-".length).split(":")[0])
      );
    };
    const keyboard = (event: KeyboardEvent) => {
      const row = selectedRow(event.target);
      if (
        !row ||
        (event.key !== "ContextMenu" &&
          !(event.shiftKey && event.key === "F10") &&
          !(
            event.target === row &&
            (event.key === "Enter" || event.key === " ")
          ))
      ) {
        return;
      }
      event.preventDefault();
      selectMessage(
        decodeURIComponent(row.id.slice("chat-message-".length).split(":")[0])
      );
    };
    node.addEventListener("wheel", wheel, { passive: true });
    node.addEventListener("touchmove", touch, { passive: true });
    node.addEventListener("touchend", end, { passive: true });
    node.addEventListener("touchcancel", end, { passive: true });
    node.addEventListener("scrollend", end);
    node.addEventListener("contextmenu", openContextMenu);
    node.addEventListener("keydown", keyboard);
    webScrollCleanup.current = () => {
      node.removeEventListener("wheel", wheel);
      node.removeEventListener("touchmove", touch);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", end);
      node.removeEventListener("scrollend", end);
      node.removeEventListener("contextmenu", openContextMenu);
      node.removeEventListener("keydown", keyboard);
    };
  }, [beginUserScroll, setFollowing, selectMessage]);
  const listLoaded = useCallback(() => {
    if (followingLatestRef.current && !userScrolling.current) {
      list.current?.scrollToEnd({ animated: false });
    }
    attachWebScroll();
  }, [attachWebScroll]);
  useEffect(() => {
    attachWebScroll();
    return () => webScrollCleanup.current();
  }, [attachWebScroll]);
  const maintainPosition = useMemo(
    () => ({ disabled: followingLatest }),
    [followingLatest]
  );
  useEffect(() => {
    if (!foreground || !visible || panel) {
      return;
    }
    let frame: ReturnType<typeof requestAnimationFrame> | undefined;
    const willShow = KeyboardEvents.addListener("keyboardWillShow", () => {
      followKeyboard.current = followingLatestRef.current;
    });
    const didShow = KeyboardEvents.addListener("keyboardDidShow", () => {
      const follow = followKeyboard.current;
      followKeyboard.current = false;
      if (!follow) {
        return;
      }
      frame = requestAnimationFrame(() => {
        if (
          alive.current &&
          followingLatestRef.current &&
          !userScrolling.current &&
          transcriptVisible.current
        ) {
          jumpToLatest();
        }
      });
    });
    const willHide = KeyboardEvents.addListener("keyboardWillHide", () => {
      followKeyboard.current = false;
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    });
    const didHide = KeyboardEvents.addListener(
      "keyboardDidHide",
      followContent
    );
    return () => {
      willShow.remove();
      didShow.remove();
      willHide.remove();
      didHide.remove();
      followKeyboard.current = false;
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }, [foreground, visible, panel, jumpToLatest, followContent, alive]);

  return {
    awayFromLatest,
    beginUserScroll,
    contentSizeChanged,
    disclosures,
    finishUserScroll,
    followingLatest,
    jumpToLatest,
    list,
    listLoaded,
    maintainPosition,
    selectMessage,
    setFollowing,
    transcriptLayoutChanged,
    updateScrollPosition,
  };
};
