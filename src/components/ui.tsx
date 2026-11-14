import {
  BottomSheetHandle,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
  useBottomSheet,
  useBottomSheetInternal,
  useBottomSheetTimingConfigs,
} from "@gorhom/bottom-sheet";
import type {
  BottomSheetBackdropProps,
  BottomSheetHandleProps,
} from "@gorhom/bottom-sheet";
import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ActivityIndicator,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import type {
  StyleProp,
  TextInputProps,
  ViewStyle,
  TextProps,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
} from "react-native-reanimated";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { pageInset } from "../lib/layout";
import {
  MessageActionsContext,
  MessageDisclosureContext,
} from "../lib/message-actions";
import { useSheetCoordinator } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { BackButton } from "./back-button";
import {
  MotionDisclosureBody,
  MotionDisclosureChevron,
  PressFeedback,
  useMotionPreference,
} from "./motion";
import { touchTarget, usePressFeedback } from "./press-feedback";
import { ShellIcon } from "./shell-icon";
import type { ShellIconName } from "./shell-icon";
import { elevation } from "./surface";

export { darkColors as colors } from "../lib/theme";
export { touchTarget, usePressFeedback };
export const sans = "Inter";
export const mono = "IBMPlexMono";
export const monoMedium = "IBMPlexMono-Medium";
export const disabledOpacity = 0.55;
const fitSheetMaxHeight = 0.75;
const fitSheetTopGap = 16;
const fitSheetMinInset = 12;
const fitSheetHandleHeight = 28;
const fitSheetDuration = 240;
const fitSheetEasing = Easing.bezier(0.2, 0.8, 0.2, 1);
const createStyles = (colors: ThemeColors) => {
  const inset = Platform.OS !== "android" || Number(Platform.Version) >= 29;
  return StyleSheet.create({
    button: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 6,
      justifyContent: "center",
      overflow: "hidden",
    },
    buttonFill: { alignSelf: "stretch" },
    buttonGhost: { backgroundColor: "transparent" },
    buttonOutlined: {
      backgroundColor: colors.buttonNeutral,
      borderColor: colors.border,
      borderWidth: 1,
    },
    buttonPrimary: { backgroundColor: colors.primary },
    buttonSubmit: { backgroundColor: colors.emphasis },
    pressOverlay: StyleSheet.absoluteFill,
    buttonText: {
      color: colors.text,
      fontFamily: sans,
      fontSize: 13,
      fontVariant: ["tabular-nums"],
      fontWeight: "500",
      letterSpacing: -0.04,
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 10,
      padding: 14,
      paddingHorizontal: 15,
    },
    disclosure: { gap: 0, paddingHorizontal: 0, paddingVertical: 0 },
    disclosureBody: { gap: 10, padding: 14, paddingTop: 0 },
    disclosureEmbedded: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    disclosureEmbeddedBody: { paddingBottom: 0, paddingHorizontal: 0 },
    disclosureEmbeddedHeader: { paddingHorizontal: 0, paddingVertical: 0 },
    disclosureHeader: {
      alignItems: "center",
      borderRadius: 8,
      flexDirection: "row",
      flex: 1,
      gap: 8,
      minHeight: touchTarget,
      overflow: "hidden",
      padding: 14,
    },
    disclosureHeaderWithAction: { paddingRight: 0 },
    disclosureHeaderRow: {
      alignItems: "center",
      flexDirection: "row",
    },
    empty: {
      alignItems: "center",
      flex: 1,
      gap: 8,
      justifyContent: "center",
      padding: 28,
    },
    error: {
      alignItems: "center",
      backgroundColor: colors.dangerBackground,
      borderRadius: 8,
      flexDirection: "row",
      gap: 8,
      padding: 12,
    },
    fieldLabel: { fontSize: 14, fontWeight: "500", letterSpacing: 0 },
    fieldInputContainer: { position: "relative" },
    fieldSecureInput: {
      minHeight: touchTarget + 2,
      paddingRight: touchTarget + 4,
    },
    fieldVisibilityButton: {
      alignItems: "center",
      borderRadius: 7,
      bottom: 1,
      justifyContent: "center",
      minHeight: touchTarget,
      position: "absolute",
      right: 1,
      top: 1,
      width: touchTarget,
    },
    fieldVisibilityDisabled: { opacity: disabledOpacity },
    fitSheet: {
      borderRadius: 0,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
    },
    fitSheetHandleRow: {
      height: fitSheetHandleHeight,
      justifyContent: "center",
      paddingVertical: 0,
    },
    fitSheetHandle: {
      backgroundColor: colors.borderStrong,
      borderRadius: 2,
      height: 4,
      width: 32,
    },
    ghostPressed: { backgroundColor: colors.raised },
    heading: {
      color: colors.text,
      flexShrink: 1,
      fontFamily: sans,
      fontSize: 21,
      fontWeight: "500",
      letterSpacing: -0.32,
    },
    hiddenHeading: {
      height: 1,
      overflow: "hidden",
      position: "absolute",
      width: 1,
    },
    input: {
      backgroundColor: colors.input,
      borderBottomColor: colors.controlTopEdge,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      boxShadow: inset
        ? [
            {
              blurRadius: 2,
              color: "#00000020",
              inset: true,
              offsetX: 0,
              offsetY: 1,
            },
          ]
        : [],
      color: colors.text,
      fontFamily: sans,
      fontSize: 17,
      minHeight: touchTarget,
      padding: 12,
      paddingHorizontal: 15,
    },
    recoveryNotice: {
      backgroundColor: colors.raised,
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      lineHeight: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    row: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    selectedButton: {
      backgroundColor: colors.selected,
      borderColor: colors.faint,
    },
    sheet: { backgroundColor: colors.panel, flex: 1 },
    sheetBody: { flex: 1, minHeight: 0 },
    sheetContent: { gap: 16, padding: 18, paddingBottom: 24 },
    fitSheetContent: { gap: 8 },
    sheetHeader: {
      alignItems: "center",
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      flexShrink: 0,
      gap: 8,
      height: 56,
      paddingHorizontal: pageInset,
    },
    sheetTitle: {
      color: colors.text,
      flex: 1,
      fontFamily: sans,
      fontSize: 16,
      fontWeight: "500",
      lineHeight: 24,
    },
    sheetInner: {
      alignSelf: "center",
      flex: 1,
      maxWidth: 680,
      minHeight: 0,
      width: "100%",
    },
    sheetLayout: { flex: 1, minHeight: 0 },
    sheetScroll: { flex: 1, minHeight: 0 },
    text: {
      color: colors.text,
      fontFamily: sans,
      fontSize: 15,
      lineHeight: 22,
    },
  });
};

const busyIndicatorColor = (
  themeColors: ThemeColors,
  variant: ButtonVariant,
  selected: boolean | undefined
) => {
  if (selected) {
    return themeColors.text;
  }
  if (variant === "primary") {
    return themeColors.primaryText;
  }
  return variant === "submit" ? themeColors.onEmphasis : themeColors.muted;
};

export const BodyText = ({
  children,
  muted,
  style,
  ...props
}: TextProps & { muted?: boolean }) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Text
      {...props}
      style={[styles.text, muted && { color: colors.muted }, style]}
    >
      {children}
    </Text>
  );
};
export const Heading = ({ children }: { children: React.ReactNode }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Text accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
};
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "submit";
export type ButtonSize = "small" | "compact" | "default" | "large";

const buttonSizes = {
  compact: { height: 28, paddingHorizontal: 11, radius: 6 },
  default: { height: 32, paddingHorizontal: 15, radius: 6 },
  large: { height: 44, paddingHorizontal: 16, radius: 6 },
  small: { height: 24, paddingHorizontal: 9, radius: 4 },
} as const;
const roundedButtonRadius = 12;
const buttonIconSize = 16;
const dimmedVariants = new Set<ButtonVariant>(["primary", "submit"]);

const buttonLabelColor = (colors: ThemeColors, variant: ButtonVariant) => {
  if (variant === "primary") {
    return colors.primaryText;
  }
  if (variant === "submit") {
    return colors.onEmphasis;
  }
  return variant === "danger" ? colors.danger : colors.text;
};

const ButtonContent = ({
  title,
  variant,
  icon,
  iconPosition,
  busy,
  selected,
}: {
  title: string;
  variant: ButtonVariant;
  icon?: ShellIconName;
  iconPosition: "start" | "end";
  busy?: boolean;
  selected?: boolean;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const labelColor = selected ? colors.text : buttonLabelColor(colors, variant);
  const glyph = icon && !busy && (
    <ShellIcon name={icon} color={labelColor} size={buttonIconSize} />
  );
  return (
    <>
      {iconPosition === "start" && glyph}
      {busy && (
        <ActivityIndicator
          size="small"
          color={busyIndicatorColor(colors, variant, selected)}
        />
      )}
      <Text style={[styles.buttonText, { color: labelColor }]}>
        {selected ? `✓ ${title}` : title}
      </Text>
      {iconPosition === "end" && glyph}
    </>
  );
};

const useButtonStyle = ({
  variant,
  size,
  shape,
  fullWidth,
  inactive,
  selected,
}: {
  variant: ButtonVariant;
  size: ButtonSize;
  shape: "default" | "rounded";
  fullWidth?: boolean;
  inactive: boolean;
  selected?: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  const { height, paddingHorizontal, radius } = buttonSizes[size];
  return [
    styles.button,
    { borderRadius: shape === "rounded" ? roundedButtonRadius : radius },
    { height, paddingHorizontal },
    (variant === "secondary" || variant === "danger") && styles.buttonOutlined,
    variant === "primary" && styles.buttonPrimary,
    variant === "submit" && styles.buttonSubmit,
    variant === "ghost" && styles.buttonGhost,
    selected && styles.selectedButton,
    fullWidth && styles.buttonFill,
    inactive && { opacity: dimmedVariants.has(variant) ? 0.4 : 0.5 },
  ];
};

export const Button = ({
  title,
  onPress,
  variant = "secondary",
  size = "default",
  shape = "default",
  icon,
  iconPosition = "start",
  fullWidth,
  disabled,
  busy,
  selected,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: "default" | "rounded";
  icon?: ShellIconName;
  iconPosition?: "start" | "end";
  fullWidth?: boolean;
  disabled?: boolean;
  busy?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
}) => {
  const styles = useThemedStyles(createStyles);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const isAndroid = Platform.OS === "android";
  const inactive = !!disabled || !!busy;
  const visual = useButtonStyle({
    fullWidth,
    inactive,
    selected,
    shape,
    size,
    variant,
  });
  const slop = Math.max(0, (touchTarget - buttonSizes[size].height) / 2);
  const content = (
    <ButtonContent
      title={title}
      variant={variant}
      icon={icon}
      iconPosition={iconPosition}
      busy={busy}
      selected={selected}
    />
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{
        busy: !!busy,
        disabled: inactive,
        selected,
      }}
      aria-pressed={selected}
      android_ripple={android_ripple}
      disabled={inactive}
      hitSlop={{ bottom: slop, top: slop }}
      onPress={onPress}
      style={isAndroid ? visual : [fullWidth && styles.buttonFill]}
    >
      {({ pressed }) =>
        isAndroid ? (
          content
        ) : (
          <PressFeedback pressed={pressed} disabled={inactive} style={visual}>
            {pressed && !inactive && (
              <View
                pointerEvents="none"
                style={[styles.pressOverlay, pressedStyle]}
              />
            )}
            {content}
          </PressFeedback>
        )
      }
    </Pressable>
  );
};
const FieldVisibilityToggle = ({
  disabled,
  label,
  onToggle,
  visible,
}: {
  disabled: boolean;
  label?: string;
  onToggle: () => void;
  visible: boolean;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityLabel={`${visible ? "Hide" : "Show"} ${label ?? "password"}`}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: visible }}
      disabled={disabled}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.fieldVisibilityButton,
        pressed && styles.ghostPressed,
        disabled && styles.fieldVisibilityDisabled,
      ]}
    >
      <ShellIcon name={visible ? "eye-off" : "eye"} color={colors.muted} />
    </Pressable>
  );
};
export const Field = ({
  label,
  style,
  containerStyle,
  ref,
  ...props
}: TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: React.Ref<TextInput>;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const canToggleVisibility = props.secureTextEntry && !props.multiline;
  // gorhom only moves a sheet for the keyboard when its own input has focus.
  const Input: React.ComponentType<
    TextInputProps & { ref?: React.Ref<TextInput> }
  > = useBottomSheetInternal(true)
    ? (BottomSheetTextInput as unknown as React.ComponentType<
        TextInputProps & { ref?: React.Ref<TextInput> }
      >)
    : (TextInput as unknown as React.ComponentType<
        TextInputProps & { ref?: React.Ref<TextInput> }
      >);
  const input = (
    <Input
      accessibilityLabel={label ?? props.placeholder}
      placeholderTextColor={colors.faint}
      selectionColor={colors.focus}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      ref={ref}
      secureTextEntry={
        canToggleVisibility ? !passwordVisible : props.secureTextEntry
      }
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[
        styles.input,
        props.multiline && { minHeight: 100, textAlignVertical: "top" },
        focused && { borderColor: colors.focus },
        style,
        canToggleVisibility && styles.fieldSecureInput,
      ]}
    />
  );
  return (
    <View style={[{ gap: 8 }, containerStyle]}>
      {label && (
        <BodyText muted style={styles.fieldLabel}>
          {label}
        </BodyText>
      )}
      {canToggleVisibility ? (
        <View style={styles.fieldInputContainer}>
          {input}
          <FieldVisibilityToggle
            disabled={props.editable === false}
            label={label}
            onToggle={() => setPasswordVisible((visible) => !visible)}
            visible={passwordVisible}
          />
        </View>
      ) : (
        input
      )}
    </View>
  );
};
export const Card = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) => {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.card, style]}>{children}</View>;
};
export const Row = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) => {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.row, style]}>{children}</View>;
};
export const Empty = ({
  title,
  detail,
}: {
  title: string;
  detail?: string;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.empty}>
      <BodyText
        style={{ fontSize: 17, fontWeight: "500", textAlign: "center" }}
      >
        {title}
      </BodyText>
      {detail && (
        <BodyText muted style={{ lineHeight: 23, textAlign: "center" }}>
          {detail}
        </BodyText>
      )}
    </View>
  );
};
export const ErrorNotice = ({
  error,
  onRetry,
}: {
  error: string | null | undefined;
  onRetry?: () => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  if (!error) {
    return null;
  }
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <BodyText style={{ color: colors.danger, flex: 1 }}>{error}</BodyText>
      {onRetry && <Button title="Retry" size="compact" onPress={onRetry} />}
    </View>
  );
};
export const Busy = () => {
  const { colors } = useTheme();
  return <ActivityIndicator style={{ padding: 30 }} color={colors.muted} />;
};
type UiStyles = ReturnType<typeof createStyles>;

const renderSheetHeader = ({
  fit,
  onClose,
  styles,
  title,
}: {
  fit: boolean;
  onClose: () => void;
  styles: UiStyles;
  title: string;
}) =>
  fit ? (
    <BodyText accessibilityRole="header" style={styles.hiddenHeading}>
      {title}
    </BodyText>
  ) : (
    <View style={styles.sheetHeader}>
      <BackButton accessibilityLabel={`Close ${title}`} onPress={onClose} />
      <BodyText
        accessibilityRole="header"
        numberOfLines={1}
        style={styles.sheetTitle}
      >
        {title}
      </BodyText>
    </View>
  );

const renderSheetBody = ({
  children,
  contentStyle,
  scroll,
  styles,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll: boolean;
  styles: UiStyles;
}) =>
  scroll ? (
    <ScrollView
      style={styles.sheetScroll}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.sheetContent, contentStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.sheetBody, contentStyle]}>{children}</View>
  );

const fitSheetMaxWidth = 680;

interface FitSheetChrome {
  header: React.ReactNode;
  title: string;
}

interface FitSheetChromeStore {
  get: () => FitSheetChrome | null;
  set: (next: FitSheetChrome) => void;
  subscribe: (listener: () => void) => () => void;
}

const createChromeStore = (): FitSheetChromeStore => {
  let value: FitSheetChrome | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value = next;
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

// gorhom remounts a handle or backdrop whenever its component identity
// changes, and a remount during a close animation resets the sheet's layout
// so the close never finishes. These components keep one identity for the
// life of the sheet and read their changing content from the store.
const createFitSheetChrome = (store: FitSheetChromeStore) => {
  // gorhom's BottomSheetBackdrop passes a dependency array to
  // useAnimatedStyle, which Reanimated warns about on every sheet open.
  const Backdrop = ({ animatedIndex, style }: BottomSheetBackdropProps) => {
    const { colors } = useTheme();
    const { close } = useBottomSheet();
    const chrome = useSyncExternalStore(store.subscribe, store.get);
    const fade = useAnimatedStyle(() => ({
      opacity: interpolate(
        animatedIndex.get(),
        [-1, 0],
        [0, 1],
        Extrapolation.CLAMP
      ),
    }));
    return (
      <Animated.View style={[style, { backgroundColor: colors.scrim }, fade]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${chrome?.title ?? ""}`}
          onPress={() => close()}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    );
  };
  const Handle = (props: BottomSheetHandleProps) => {
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const chrome = useSyncExternalStore(store.subscribe, store.get);
    return (
      <BottomSheetHandle
        {...props}
        accessible={false}
        indicatorStyle={styles.fitSheetHandle}
        style={[
          styles.fitSheetHandleRow,
          { paddingLeft: insets.left, paddingRight: insets.right },
        ]}
      >
        {chrome?.header}
      </BottomSheetHandle>
    );
  };
  return { Backdrop, Handle };
};

const createFitSheetParts = () => {
  const chrome = createChromeStore();
  return { chrome, ...createFitSheetChrome(chrome) };
};

const FitSheet = ({
  visible,
  title,
  header,
  children,
  contentStyle,
  scroll,
  onPresentedChange,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  header: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll: boolean;
  onPresentedChange: (presented: boolean) => void;
  onDismiss: () => void;
}) => {
  const { colors, scheme } = useTheme();
  const sheetShadow = elevation(scheme).overlay;
  const styles = useThemedStyles(createStyles);
  const reduced = useMotionPreference();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const modal = useRef<BottomSheetModal>(null);
  const { chrome, Backdrop, Handle } = useMemo(() => createFitSheetParts(), []);
  const animationConfigs = useBottomSheetTimingConfigs({
    duration: fitSheetDuration,
    easing: fitSheetEasing,
  });
  // gorhom leaves a never-presented or already-dismissed modal stuck in its
  // dismissing state if dismiss() is called on it, so track presentation here.
  const presented = useRef(false);
  useLayoutEffect(() => {
    if (visible) {
      presented.current = true;
      onPresentedChange(true);
      modal.current?.present();
    } else if (presented.current) {
      modal.current?.dismiss();
    }
  }, [visible, onPresentedChange]);
  useEffect(() => {
    if (!visible) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!presented.current) {
          return false;
        }
        modal.current?.dismiss();
        return true;
      }
    );
    return () => subscription.remove();
  }, [visible]);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  // gorhom can still report a dismissal after the sheet unmounts.
  const handleDismiss = useCallback(() => {
    presented.current = false;
    if (!mounted.current) {
      return;
    }
    onPresentedChange(false);
    onDismiss();
  }, [onPresentedChange, onDismiss]);
  useLayoutEffect(() => {
    chrome.set({ header, title });
  }, [chrome, header, title]);
  const contentInsets = {
    paddingBottom: Math.max(fitSheetMinInset, insets.bottom),
    paddingLeft: Math.max(fitSheetMinInset, insets.left),
    paddingRight: Math.max(fitSheetMinInset, insets.right),
  };
  return (
    <BottomSheetModal
      ref={modal}
      stackBehavior="push"
      enableDynamicSizing
      animationConfigs={animationConfigs}
      maxDynamicContentSize={Math.min(
        height * fitSheetMaxHeight,
        height - insets.top - fitSheetTopGap
      )}
      topInset={insets.top}
      overrideReduceMotion={reduced ? ReduceMotion.Always : ReduceMotion.Never}
      keyboardBlurBehavior="restore"
      backdropComponent={Backdrop}
      handleComponent={Handle}
      backgroundStyle={[
        styles.fitSheet,
        { backgroundColor: colors.frame, boxShadow: sheetShadow },
      ]}
      style={{
        marginHorizontal: Math.max(0, (width - fitSheetMaxWidth) / 2),
      }}
      onDismiss={handleDismiss}
    >
      {scroll ? (
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={contentInsets}
        >
          <View style={[styles.fitSheetContent, contentStyle]}>{children}</View>
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={contentInsets}>
          <View style={[styles.fitSheetContent, contentStyle]}>{children}</View>
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
};

export const Sheet = ({
  visible,
  title,
  children,
  onClose,
  onDismiss,
  scroll = true,
  allowDuringRecovery = false,
  fitContent = false,
  contentStyle,
}: {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onDismiss?: () => void;
  scroll?: boolean;
  allowDuringRecovery?: boolean;
  fitContent?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reduced = useMotionPreference();
  const { suspended, recoveryPending, presentSheet, dismissSheet } =
    useSheetCoordinator();
  const id = useId();
  const effectiveVisible = visible && (allowDuringRecovery || !suspended);
  const [fitPresented, setFitPresented] = useState(false);
  // A fit sheet stays logically visible until gorhom finishes its close
  // animation, whether the parent or a gesture started the close.
  const modalVisible = fitContent
    ? effectiveVisible || fitPresented
    : effectiveVisible;
  const SafeAreaRoot =
    Platform.OS === "web" ? React.Fragment : SafeAreaProvider;
  const requested = useRef(effectiveVisible);
  const logicalVisible = useRef(visible);
  const previousVisible = useRef(modalVisible);
  const pendingDismiss = useRef(false);
  const pendingAppDismiss = useRef(false);
  const dismissRef = useRef(onDismiss);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    requested.current = effectiveVisible;
    logicalVisible.current = visible;
    dismissRef.current = onDismiss;
    closeRef.current = onClose;
  });
  const notifyDismissed = useCallback(() => {
    if (requested.current || !pendingDismiss.current) {
      return;
    }
    pendingDismiss.current = false;
    const deferActions = dismissSheet(id);
    if (!logicalVisible.current) {
      if (deferActions && !allowDuringRecovery) {
        pendingAppDismiss.current = true;
      } else {
        dismissRef.current?.();
      }
    }
  }, [dismissSheet, id, allowDuringRecovery]);
  const handleFitDismissed = useCallback(() => {
    if (requested.current) {
      closeRef.current();
    }
  }, []);
  useLayoutEffect(() => {
    if (effectiveVisible && !allowDuringRecovery) {
      presentSheet(id);
    }
  }, [effectiveVisible, allowDuringRecovery, presentSheet, id]);
  useEffect(
    () => () => {
      dismissSheet(id);
    },
    [dismissSheet, id]
  );
  useEffect(() => {
    if (visible) {
      pendingAppDismiss.current = false;
      return;
    }
    if (!suspended && !recoveryPending && pendingAppDismiss.current) {
      pendingAppDismiss.current = false;
      dismissRef.current?.();
    }
  }, [suspended, recoveryPending, visible]);
  useEffect(() => {
    const wasVisible = previousVisible.current;
    previousVisible.current = modalVisible;
    if (modalVisible) {
      pendingDismiss.current = false;
      return;
    }
    if (!wasVisible) {
      return;
    }
    pendingDismiss.current = true;
    if (fitContent) {
      notifyDismissed();
      return;
    }
    if (Platform.OS !== "android") {
      return;
    }
    const frame = requestAnimationFrame(notifyDismissed);
    return () => cancelAnimationFrame(frame);
  }, [modalVisible, fitContent, notifyDismissed]);
  const header = (
    <>
      {renderSheetHeader({ fit: fitContent, onClose, styles, title })}
      {recoveryPending && !allowDuringRecovery && (
        <BodyText accessibilityRole="alert" style={styles.recoveryNotice}>
          Close this panel to open the connection wizard.
        </BodyText>
      )}
    </>
  );
  if (fitContent) {
    return (
      <FitSheet
        visible={effectiveVisible}
        title={title}
        header={header}
        contentStyle={contentStyle}
        scroll={scroll}
        onPresentedChange={setFitPresented}
        onDismiss={handleFitDismissed}
      >
        {children}
      </FitSheet>
    );
  }
  return (
    <Modal
      visible={modalVisible}
      animationType={reduced ? "fade" : "slide"}
      presentationStyle="pageSheet"
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
      onRequestClose={onClose}
      onDismiss={notifyDismissed}
    >
      <SafeAreaRoot>
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.bg }]}>
          <KeyboardAvoidingView
            style={styles.sheetLayout}
            behavior="padding"
            automaticOffset
          >
            <View style={styles.sheetInner}>
              {header}
              {renderSheetBody({ children, contentStyle, scroll, styles })}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaRoot>
    </Modal>
  );
};
export const JsonView = ({ value }: { value: unknown }) => {
  const { colors } = useTheme();
  return (
    <Text
      selectable
      style={{
        color: colors.text,
        fontFamily: mono,
        fontSize: 13,
        lineHeight: 20,
      }}
    >
      {JSON.stringify(value, null, 2)}
    </Text>
  );
};
export const Disclosure = ({
  title,
  children,
  disclosureKey,
  headerAction,
  variant = "card",
}: {
  title: string;
  children: React.ReactNode;
  disclosureKey?: string;
  headerAction?: React.ReactNode;
  variant?: "card" | "embedded";
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const openMessageActions = useContext(MessageActionsContext);
  const disclosures = useContext(MessageDisclosureContext);
  const initialOpen = disclosureKey
    ? (disclosures?.isOpen(disclosureKey) ?? false)
    : false;
  const [open, setOpen] = useState(initialOpen);
  const [seenSource, setSeenSource] = useState({ disclosureKey, disclosures });
  if (
    seenSource.disclosureKey !== disclosureKey ||
    seenSource.disclosures !== disclosures
  ) {
    setSeenSource({ disclosureKey, disclosures });
    setOpen(initialOpen);
  }
  return (
    <View
      style={[
        variant === "card" && styles.card,
        styles.disclosure,
        variant === "embedded" && styles.disclosureEmbedded,
      ]}
    >
      <View style={styles.disclosureHeaderRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={() =>
            setOpen(
              disclosureKey && disclosures
                ? disclosures.toggle(disclosureKey)
                : !open
            )
          }
          onLongPress={Platform.OS === "web" ? undefined : openMessageActions}
          android_ripple={android_ripple}
          style={({ pressed }) => [
            styles.disclosureHeader,
            variant === "embedded" && styles.disclosureEmbeddedHeader,
            !!headerAction && styles.disclosureHeaderWithAction,
            pressed && pressedStyle,
          ]}
        >
          <BodyText style={{ flex: 1, fontWeight: "500" }}>{title}</BodyText>
          <MotionDisclosureChevron open={open}>
            <ShellIcon name="chevron" color={colors.muted} size={16} />
          </MotionDisclosureChevron>
        </Pressable>
        {headerAction}
      </View>
      <MotionDisclosureBody
        open={open}
        style={[
          styles.disclosureBody,
          variant === "embedded" && styles.disclosureEmbeddedBody,
        ]}
      >
        {children}
      </MotionDisclosureBody>
    </View>
  );
};
