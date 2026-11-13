import React, {
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  StyleProp,
  TextInputProps,
  ViewStyle,
  TextProps,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated from "react-native-reanimated";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  MessageActionsContext,
  MessageDisclosureContext,
} from "../lib/message-actions";
import { useSheetCoordinator } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import {
  MotionDisclosureBody,
  MotionDisclosureChevron,
  PressFeedback,
  useMotionPreference,
  useSheetTransition,
} from "./motion";
import { ShellIcon } from "./shell-icon";

export { darkColors as colors } from "../lib/theme";
export const sans = "Inter";
export const mono = "IBMPlexMono";
export const touchTarget = Platform.OS === "android" ? 48 : 44;
export const compactButtonSize = 32;
export const disabledOpacity = 0.55;
const createStyles = (colors: ThemeColors) => {
  const inset = Platform.OS !== "android" || Number(Platform.Version) >= 29;
  return StyleSheet.create({
    betaSheetContent: { gap: 12, paddingHorizontal: 14 },
    betaSheetHeader: { paddingHorizontal: 14, paddingVertical: 8 },
    betaSheetTitle: {
      flexShrink: 1,
      fontSize: 18,
      fontWeight: "600",
      lineHeight: 24,
    },
    button: {
      alignItems: "center",
      backgroundColor: colors.raised,
      borderColor: colors.border,
      borderRadius: 6,
      borderTopColor: colors.controlTopEdge,
      borderWidth: 1,
      boxShadow: [
        { blurRadius: 1, color: "#00000035", offsetX: 0, offsetY: 1 },
      ],
      justifyContent: "center",
      minHeight: 36,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    buttonTarget: {
      alignItems: "stretch",
      justifyContent: "center",
      minHeight: touchTarget,
      minWidth: touchTarget,
    },
    buttonText: {
      color: colors.text,
      fontFamily: sans,
      fontSize: 14,
      fontVariant: ["tabular-nums"],
      fontWeight: "500",
      letterSpacing: -0.04,
      lineHeight: 21,
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
    compact: {
      minHeight: compactButtonSize,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    danger: { backgroundColor: colors.raised },
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
    fitInner: { flex: 0, flexShrink: 1 },
    fitScroll: { flex: 0, flexShrink: 1 },
    fitSheet: {
      alignSelf: "center",
      backgroundColor: colors.panel,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      flexShrink: 1,
      maxHeight: "85%",
      maxWidth: 680,
      overflow: "hidden",
      width: "100%",
    },
    fitSheetSafeArea: { flexShrink: 1 },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "transparent",
      borderTopColor: "transparent",
      boxShadow: [],
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
    pressed: {
      borderTopColor: colors.border,
      boxShadow: inset
        ? [
            {
              blurRadius: 1,
              color: "#00000030",
              inset: true,
              offsetX: 0,
              offsetY: 1,
            },
          ]
        : [],
    },
    primary: { backgroundColor: colors.primary },
    recoveryNotice: {
      backgroundColor: colors.raised,
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      paddingHorizontal: 18,
      paddingVertical: 10,
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
      borderTopColor: colors.faint,
    },
    sheet: { backgroundColor: colors.panel, flex: 1 },
    sheetBody: { flex: 1, minHeight: 0 },
    sheetContent: { gap: 16, padding: 18, paddingBottom: 24 },
    sheetHeader: {
      alignItems: "center",
      borderBottomWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      flexShrink: 0,
      gap: 12,
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    sheetInner: {
      alignSelf: "center",
      flex: 1,
      maxWidth: 680,
      minHeight: 0,
      width: "100%",
    },
    sheetLayout: { flex: 1, minHeight: 0 },
    sheetOverlay: { flex: 1, justifyContent: "flex-end" },
    sheetScrim: { ...StyleSheet.absoluteFill, backgroundColor: "#00000070" },
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
  variant: "primary" | "secondary" | "danger" | "ghost",
  selected: boolean | undefined
) => {
  if (selected) {
    return themeColors.text;
  }
  return variant === "primary" ? themeColors.primaryText : themeColors.muted;
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
export const Button = ({
  title,
  onPress,
  variant = "secondary",
  disabled,
  busy,
  compact,
  selected,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{
        busy: !!busy,
        disabled: !!disabled || !!busy,
        selected,
      }}
      aria-pressed={selected}
      disabled={disabled || busy}
      hitSlop={compact ? (touchTarget - compactButtonSize) / 2 : undefined}
      onPress={onPress}
      style={[
        styles.buttonTarget,
        compact && {
          minHeight: compactButtonSize,
          minWidth: compactButtonSize,
        },
        (disabled || busy) && { opacity: disabledOpacity },
      ]}
    >
      {({ pressed }) => (
        <PressFeedback
          pressed={pressed}
          disabled={disabled || busy}
          style={[
            styles.button,
            compact && styles.compact,
            variant === "primary" && styles.primary,
            variant === "ghost" && styles.ghost,
            variant === "danger" && styles.danger,
            selected && styles.selectedButton,
            pressed &&
              (variant === "ghost" ? styles.ghostPressed : styles.pressed),
          ]}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color={busyIndicatorColor(colors, variant, selected)}
            />
          ) : (
            <Text
              style={[
                styles.buttonText,
                variant === "primary" && { color: colors.primaryText },
                variant === "danger" && { color: colors.danger },
                selected && { color: colors.text },
              ]}
            >
              {selected ? `✓ ${title}` : title}
            </Text>
          )}
        </PressFeedback>
      )}
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
  ...props
}: TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const canToggleVisibility = props.secureTextEntry && !props.multiline;
  const input = (
    <TextInput
      accessibilityLabel={label ?? props.placeholder}
      placeholderTextColor={colors.faint}
      selectionColor={colors.focus}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
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
      {onRetry && <Button title="Retry" compact onPress={onRetry} />}
    </View>
  );
};
export const Busy = () => {
  const { colors } = useTheme();
  return <ActivityIndicator style={{ padding: 30 }} color={colors.muted} />;
};
type UiStyles = ReturnType<typeof createStyles>;

const renderSheetHeader = ({
  onClose,
  showHeader,
  styles,
  title,
}: {
  onClose: () => void;
  showHeader: boolean;
  styles: UiStyles;
  title: string;
}) =>
  showHeader ? (
    <View style={[styles.sheetHeader, styles.betaSheetHeader]}>
      <BodyText accessibilityRole="header" style={styles.betaSheetTitle}>
        {title}
      </BodyText>
      <Button title="Done" compact onPress={onClose} />
    </View>
  ) : (
    <BodyText accessibilityRole="header" style={styles.hiddenHeading}>
      {title}
    </BodyText>
  );

const renderSheetBody = ({
  children,
  contentStyle,
  fitContent,
  scroll,
  styles,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  fitContent: boolean;
  scroll: boolean;
  styles: UiStyles;
}) =>
  scroll ? (
    <ScrollView
      style={[styles.sheetScroll, fitContent && styles.fitScroll]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      contentContainerStyle={[
        styles.sheetContent,
        styles.betaSheetContent,
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[styles.sheetBody, fitContent && styles.fitScroll, contentStyle]}
    >
      {children}
    </View>
  );

const sheetAnimationType = (fitContent: boolean, reduced: boolean) => {
  if (fitContent) {
    return "none";
  }
  return reduced ? "fade" : "slide";
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
  showHeader = true,
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
  showHeader?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reduced = useMotionPreference();
  const { suspended, recoveryPending, presentSheet, dismissSheet } =
    useSheetCoordinator();
  const id = useId();
  const effectiveVisible = visible && (allowDuringRecovery || !suspended);
  const transition = useSheetTransition(fitContent && effectiveVisible);
  const modalVisible = fitContent ? transition.presented : effectiveVisible;
  const SafeAreaRoot =
    Platform.OS === "web" ? React.Fragment : SafeAreaProvider;
  const requested = useRef(effectiveVisible);
  const logicalVisible = useRef(visible);
  const previousVisible = useRef(modalVisible);
  const pendingDismiss = useRef(false);
  const pendingAppDismiss = useRef(false);
  const dismissRef = useRef(onDismiss);
  useLayoutEffect(() => {
    requested.current = effectiveVisible;
    logicalVisible.current = visible;
    dismissRef.current = onDismiss;
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
    if (Platform.OS !== "android") {
      return;
    }
    const frame = requestAnimationFrame(notifyDismissed);
    return () => cancelAnimationFrame(frame);
  }, [modalVisible, notifyDismissed]);
  const content = (
    <View style={[styles.sheetInner, fitContent && styles.fitInner]}>
      {renderSheetHeader({ onClose, showHeader, styles, title })}
      {recoveryPending && !allowDuringRecovery && (
        <BodyText accessibilityRole="alert" style={styles.recoveryNotice}>
          Close this panel to open the connection wizard.
        </BodyText>
      )}
      {renderSheetBody({
        children,
        contentStyle,
        fitContent,
        scroll,
        styles,
      })}
    </View>
  );
  return (
    <Modal
      visible={modalVisible}
      transparent={fitContent}
      animationType={sheetAnimationType(fitContent, reduced)}
      presentationStyle={fitContent ? "overFullScreen" : "pageSheet"}
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
      onRequestClose={onClose}
      onDismiss={notifyDismissed}
    >
      <SafeAreaRoot>
        {fitContent ? (
          <KeyboardAvoidingView
            style={styles.sheetOverlay}
            behavior="padding"
            automaticOffset
          >
            <Animated.View style={[styles.sheetScrim, transition.scrimStyle]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close ${title}`}
                onPress={onClose}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Animated.View
              onLayout={transition.handlePanelLayout}
              style={[
                styles.fitSheet,
                { backgroundColor: colors.bg },
                transition.panelStyle,
              ]}
            >
              <SafeAreaView
                edges={["bottom", "left", "right"]}
                style={styles.fitSheetSafeArea}
              >
                {content}
              </SafeAreaView>
            </Animated.View>
          </KeyboardAvoidingView>
        ) : (
          <SafeAreaView style={[styles.sheet, { backgroundColor: colors.bg }]}>
            <KeyboardAvoidingView
              style={styles.sheetLayout}
              behavior="padding"
              automaticOffset
            >
              {content}
            </KeyboardAvoidingView>
          </SafeAreaView>
        )}
      </SafeAreaRoot>
    </Modal>
  );
};
export const confirmAction = async (
  title: string,
  message: string,
  options: { confirmLabel?: string; destructive?: boolean } = {}
): Promise<boolean> => {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  Alert.alert(
    title,
    message,
    [
      { onPress: () => resolve(false), style: "cancel", text: "Cancel" },
      {
        onPress: () => resolve(true),
        style: options.destructive === false ? "default" : "destructive",
        text: options.confirmLabel || "Continue",
      },
    ],
    { cancelable: true, onDismiss: () => resolve(false) }
  );
  return await promise;
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
          style={({ pressed }) => [
            styles.disclosureHeader,
            variant === "embedded" && styles.disclosureEmbeddedHeader,
            !!headerAction && styles.disclosureHeaderWithAction,
            pressed && styles.ghostPressed,
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
