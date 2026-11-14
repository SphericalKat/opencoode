import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { GestureResponderEvent, LayoutChangeEvent } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import { playHaptic } from "../lib/haptics";
import { placeMenu } from "../lib/menu-position";
import type { MenuPlacement, Rect } from "../lib/menu-position";
import { useModalSchemeKey } from "../lib/modal-scheme";
import { useSheetCoordinator } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { useMotionPreference } from "./motion";
import { ShellIcon } from "./shell-icon";
import type { ShellIconName } from "./shell-icon";
import { elevation, radius } from "./surface";
import { sans, usePressFeedback } from "./ui";

export type { MenuPlacement, Rect } from "../lib/menu-position";

export type AnchoredMenuItem =
  | {
      type?: "item";
      key: string;
      label: string;
      onSelect: () => void;
      checked?: boolean;
      destructive?: boolean;
      disabled?: boolean;
      icon?: ShellIconName;
      role?: "menuitem" | "menuitemradio";
    }
  | { type: "separator"; key: string }
  | { type: "label"; key: string; label: string };

type MenuAppearance = "menu" | "dropdown";

const ENTER_MS = 150;
const EXIT_MS = 90;
const REDUCED_MS = 80;
const MAX_MENU_WIDTH = 280;
const WINDOW_GUTTER = 16;
const ICON_SIZE = 16;
const MENU_ENTER_SCALE = 0.95;
const DROPDOWN_ENTER_OFFSET = -8;
const easeOutStrong = Easing.bezier(0.23, 1, 0.32, 1);

interface MenuContextValue {
  appearance: MenuAppearance;
  select: (action: () => void) => void;
}

const MenuContext = createContext<MenuContextValue>({
  appearance: "menu",
  select: (action) => action(),
});

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    check: {
      alignItems: "center",
      height: ICON_SIZE,
      justifyContent: "center",
      width: ICON_SIZE,
    },
    dismiss: StyleSheet.absoluteFill,
    dropdown: {
      backgroundColor: colors.bg,
      borderRadius: radius.xl,
      padding: 6,
    },
    groupLabel: {
      color: colors.faint,
      fontFamily: sans,
      fontSize: 11,
      fontWeight: "500",
      height: 28,
      letterSpacing: 0.05,
      lineHeight: 28,
      paddingHorizontal: 12,
    },
    label: {
      color: colors.text,
      flexGrow: 1,
      flexShrink: 1,
      fontFamily: sans,
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 20,
    },
    labelDanger: { color: colors.danger },
    menu: {
      backgroundColor: colors.panel,
      borderRadius: radius.md,
      padding: 2,
    },
    row: {
      alignItems: "center",
      borderRadius: radius.sm,
      flexDirection: "row",
      gap: 8,
      minHeight: 48,
      overflow: "hidden",
      paddingEnd: 6,
      paddingStart: 12,
    },
    rowDisabled: { opacity: 0.5 },
    rowDropdown: { borderRadius: radius.md, paddingHorizontal: 6 },
    rowSelected: { backgroundColor: colors.selected },
    scroll: { flexGrow: 0 },
    separator: {
      backgroundColor: colors.borderMuted,
      height: 1,
      marginHorizontal: -2,
      marginVertical: 2,
    },
    separatorDropdown: { marginHorizontal: -6, marginVertical: 4 },
  });

export const MenuSeparator = () => {
  const styles = useThemedStyles(createStyles);
  const { appearance } = useContext(MenuContext);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.separator,
        appearance === "dropdown" && styles.separatorDropdown,
      ]}
    />
  );
};

const MenuGroupLabel = ({ label }: { label: string }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Text accessibilityRole="header" style={styles.groupLabel}>
      {label}
    </Text>
  );
};

export const MenuRow = ({
  label,
  onPress,
  leading,
  icon,
  trailing,
  checked,
  selected,
  destructive,
  disabled,
  accessibilityLabel,
  accessibilityRole = "menuitem",
}: {
  label: string;
  onPress: () => void;
  leading?: React.ReactNode;
  icon?: ShellIconName;
  trailing?: React.ReactNode;
  checked?: boolean;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: "menuitem" | "menuitemradio" | "switch";
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { appearance, select } = useContext(MenuContext);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const handlePress = () => select(onPress);
  const reserveCheck = checked || accessibilityRole === "menuitemradio";
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={
        accessibilityRole === "menuitemradio" ? "radio" : accessibilityRole
      }
      accessibilityState={{ checked, disabled: !!disabled, selected }}
      android_ripple={android_ripple}
      disabled={disabled}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        appearance === "dropdown" && styles.rowDropdown,
        selected && styles.rowSelected,
        pressed && pressedStyle,
        disabled && styles.rowDisabled,
      ]}
    >
      {leading ??
        (icon && (
          <ShellIcon name={icon} color={colors.text} size={ICON_SIZE} />
        ))}
      <Text
        numberOfLines={1}
        style={[styles.label, destructive && styles.labelDanger]}
      >
        {label}
      </Text>
      {trailing}
      {reserveCheck && (
        <View style={styles.check}>
          {checked && (
            <ShellIcon name="check" color={colors.text} size={ICON_SIZE} />
          )}
        </View>
      )}
    </Pressable>
  );
};

const renderItem = (item: AnchoredMenuItem) => {
  if (item.type === "separator") {
    return <MenuSeparator key={item.key} />;
  }
  if (item.type === "label") {
    return <MenuGroupLabel key={item.key} label={item.label} />;
  }
  const handleSelect = item.onSelect;
  return (
    <MenuRow
      key={item.key}
      label={item.label}
      icon={item.icon}
      checked={item.checked}
      destructive={item.destructive}
      disabled={item.disabled}
      accessibilityRole={item.role}
      onPress={handleSelect}
    />
  );
};

interface Size {
  width: number;
  height: number;
}

interface PopupProps {
  anchor: Rect;
  open: boolean;
  onClose: () => void;
  onFinished: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
  placement: MenuPlacement;
  gutter?: number;
  sameWidth?: boolean;
  minWidth: number;
  maxHeight?: number;
  appearance: MenuAppearance;
}

const useMenuMotion = ({
  appearance,
  hasSize,
  onFinished,
  open,
  reduced,
}: {
  appearance: MenuAppearance;
  hasSize: boolean;
  onFinished: () => void;
  open: boolean;
  reduced: boolean;
}) => {
  const progress = useSharedValue(0);
  const dropdown = appearance === "dropdown";
  useEffect(() => {
    if (open && !hasSize) {
      return;
    }
    if (!open && !hasSize) {
      onFinished();
      return;
    }
    cancelAnimation(progress);
    const config = {
      reduceMotion: ReduceMotion.Never,
    };
    if (open) {
      progress.set(
        withTiming(1, {
          ...config,
          duration: reduced ? REDUCED_MS : ENTER_MS,
          easing: dropdown ? Easing.out(Easing.ease) : easeOutStrong,
        })
      );
    } else {
      progress.set(
        withTiming(
          0,
          { ...config, duration: reduced ? REDUCED_MS : EXIT_MS },
          (finished) => {
            if (finished) {
              scheduleOnRN(onFinished);
            }
          }
        )
      );
    }
    return () => cancelAnimation(progress);
  }, [open, hasSize, reduced, dropdown, progress, onFinished]);
  return useAnimatedStyle(
    () => {
      const value = progress.get();
      if (reduced) {
        return { opacity: value };
      }
      return dropdown
        ? {
            opacity: value,
            transform: [{ translateY: DROPDOWN_ENTER_OFFSET * (1 - value) }],
          }
        : {
            opacity: value,
            transform: [
              { scale: MENU_ENTER_SCALE + (1 - MENU_ENTER_SCALE) * value },
            ],
          };
    },
    Platform.OS === "web" ? [reduced, dropdown] : undefined
  );
};

const MenuPopup = ({
  anchor,
  open,
  onClose,
  onFinished,
  accessibilityLabel,
  children,
  placement,
  gutter,
  sameWidth,
  minWidth,
  maxHeight,
  appearance,
}: PopupProps) => {
  const { scheme } = useTheme();
  const modalKey = useModalSchemeKey();
  const styles = useThemedStyles(createStyles);
  const reduced = useMotionPreference();
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { presentSheet, dismissSheet } = useSheetCoordinator();
  const id = useId();
  const [size, setSize] = useState<Size | null>(null);
  useLayoutEffect(() => {
    presentSheet(id);
    return () => {
      dismissSheet(id);
    };
  }, [id, presentSheet, dismissSheet]);
  const animated = useMenuMotion({
    appearance,
    hasSize: size !== null,
    onFinished,
    open,
    reduced,
  });
  const select = useCallback(
    (action: () => void) => {
      playHaptic("select");
      onClose();
      action();
    },
    [onClose]
  );
  const menuContext = useMemo(
    () => ({ appearance, select }),
    [appearance, select]
  );
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) => current ?? { height, width });
  }, []);
  const position = size
    ? placeMenu({
        anchor,
        gutter,
        insets,
        maxHeight,
        menu: size,
        placement,
        window,
      })
    : null;
  const origin = position?.origin;
  return (
    <Modal
      key={modalKey}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        accessibilityLabel="Close menu"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.dismiss}
      />
      <Animated.View
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="menu"
        onLayout={handleLayout}
        pointerEvents={position && open ? "auto" : "none"}
        style={[
          appearance === "dropdown" ? styles.dropdown : styles.menu,
          {
            boxShadow: elevation(scheme).floating,
            left: position?.left ?? 0,
            maxHeight: position?.maxHeight ?? maxHeight,
            position: "absolute",
            top: position?.top ?? 0,
          },
          sameWidth
            ? { width: anchor.width }
            : {
                maxWidth: Math.min(
                  MAX_MENU_WIDTH,
                  window.width - WINDOW_GUTTER
                ),
                minWidth,
              },
          origin && { transformOrigin: `${origin.x} ${origin.y}` },
          animated,
        ]}
      >
        <MenuContext.Provider value={menuContext}>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            style={styles.scroll}
          >
            {children}
          </ScrollView>
        </MenuContext.Provider>
      </Animated.View>
    </Modal>
  );
};

interface Session {
  id: number;
  anchor: Rect;
}

export const AnchoredMenu = ({
  visible,
  anchor,
  onClose,
  onClosed,
  accessibilityLabel,
  items,
  children,
  placement = "bottom-start",
  gutter,
  sameWidth,
  minWidth = 160,
  maxHeight,
  appearance = "menu",
}: {
  visible: boolean;
  anchor: Rect | null;
  onClose: () => void;
  onClosed?: () => void;
  accessibilityLabel: string;
  items?: readonly AnchoredMenuItem[];
  children?: React.ReactNode;
  placement?: MenuPlacement;
  gutter?: number;
  sameWidth?: boolean;
  minWidth?: number;
  maxHeight?: number;
  appearance?: MenuAppearance;
}) => {
  const { suspended, recoveryPending } = useSheetCoordinator();
  const open = visible && !suspended && !recoveryPending;
  const [session, setSession] = useState<Session | null>(null);
  const anchorRef = useRef(anchor);
  const sessionId = useRef(0);
  const currentId = useRef<number | null>(null);
  const closedRef = useRef(onClosed);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    anchorRef.current = anchor;
    closedRef.current = onClosed;
    closeRef.current = onClose;
  });
  useLayoutEffect(() => {
    if (visible && (suspended || recoveryPending)) {
      closeRef.current();
    }
  }, [visible, suspended, recoveryPending]);
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      return;
    }
    sessionId.current += 1;
    currentId.current = sessionId.current;
    setSession({ anchor: anchorRef.current, id: sessionId.current });
  }, [open]);
  const sessionKey = session?.id;
  const finish = useCallback(() => {
    if (currentId.current !== sessionKey) {
      return;
    }
    currentId.current = null;
    setSession(null);
    closedRef.current?.();
  }, [sessionKey]);
  if (!session) {
    return null;
  }
  return (
    <MenuPopup
      key={session.id}
      anchor={session.anchor}
      open={open}
      onClose={onClose}
      onFinished={finish}
      accessibilityLabel={accessibilityLabel}
      placement={placement}
      gutter={gutter}
      sameWidth={sameWidth}
      minWidth={minWidth}
      maxHeight={maxHeight}
      appearance={appearance}
    >
      {items ? items.map(renderItem) : children}
    </MenuPopup>
  );
};

export const useMenuAnchor = () => {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const measure = useCallback(() => {
    const { promise, resolve, reject } = Promise.withResolvers<Rect>();
    const node = ref.current;
    if (!node) {
      reject(new Error("The menu anchor is not mounted"));
      return promise;
    }
    node.measureInWindow((x, y, width, height) => {
      resolve({ height, width, x, y });
    });
    return promise;
  }, []);
  return { measure, ref };
};

export const useContextMenu = (options?: {
  canOpen?: () => boolean;
  onOpen?: (anchor: Rect) => void;
}) => {
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const optionsRef = useRef(options);
  useLayoutEffect(() => {
    optionsRef.current = options;
  });
  const open = useCallback((next: Rect) => {
    const onOpen = optionsRef.current?.onOpen;
    if (onOpen) {
      onOpen(next);
      return;
    }
    setAnchor(next);
    setVisible(true);
  }, []);
  const openAt = useCallback(
    (next: Rect) => {
      if (optionsRef.current?.canOpen?.() === false) {
        return;
      }
      open(next);
    },
    [open]
  );
  const onLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (optionsRef.current?.canOpen?.() === false) {
        return;
      }
      playHaptic("longPress");
      const { pageX, pageY } = event.nativeEvent;
      open({ height: 0, width: 0, x: pageX, y: pageY });
    },
    [open]
  );
  const close = useCallback(() => setVisible(false), []);
  return { anchor, close, onLongPress, openAt, visible };
};
