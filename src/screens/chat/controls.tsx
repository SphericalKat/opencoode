import React from "react";
import { ActivityIndicator, Platform, Pressable } from "react-native";
import {
  KeyboardAvoidingView,
  useReanimatedKeyboardAnimation,
} from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { CodeCard, Markdown } from "../../components/markdown";
import { PressFeedback } from "../../components/motion";
import { ShellIcon } from "../../components/shell-icon";
import { BodyText } from "../../components/ui";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { createStyles } from "./styles";

export type ChatIconName =
  | "more"
  | "plus"
  | "up"
  | "down"
  | "star"
  | "stop"
  | "close"
  | "copy"
  | "check";

export const ChatGlyph = ({
  name,
  color,
  size = 20,
  selected,
}: {
  name: ChatIconName;
  color: string;
  size?: number;
  selected?: boolean;
}) => {
  const path = {
    check: "m5 12 4 4L19 6",
    close: "M6 6l12 12M18 6 6 18",
    copy: "M8 8h12v13H8Z M16 8V3H3v13h5",
    down: "M6 9l6 6 6-6",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    plus: "M12 5v14M5 12h14",
    star: "m12 3 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.3l-5.6 3 1.1-6.3L3 9.6l6.2-.9Z",
    stop: "M7 7h10v10H7Z",
    up: "M12 19V5M6 11l6-6 6 6",
  }[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <Path
        d={path}
        stroke={color}
        strokeWidth={name === "more" ? 3 : 1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={name === "stop" || (name === "star" && selected) ? color : "none"}
      />
    </Svg>
  );
};

export const ChatIconButton = ({
  name,
  label,
  onPress,
  raised,
  disabled,
  busy,
  selected,
  compactFace,
}: {
  name: ChatIconName;
  label: string;
  onPress: () => void;
  raised?: boolean;
  disabled?: boolean;
  busy?: boolean;
  selected?: boolean;
  compactFace?: boolean;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  let glyphColor = colors.muted;
  if (raised) {
    glyphColor = compactFace ? colors.onEmphasis : colors.primaryText;
  } else if (selected) {
    glyphColor = colors.text;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        busy: !!busy,
        disabled: !!disabled || !!busy,
        selected,
      }}
      aria-pressed={selected}
      disabled={disabled || busy}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={styles.iconTarget}
    >
      {({ pressed }) => (
        <PressFeedback
          pressed={pressed}
          disabled={disabled || busy}
          style={[
            styles.iconFace,
            compactFace && {
              borderRadius: raised ? 6 : 14,
              height: 28,
              width: 28,
            },
            raised && styles.raisedFace,
            raised && compactFace && styles.betaRaisedFace,
            (disabled || busy) && { opacity: 0.4 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.primaryText} />
          ) : (
            <ChatGlyph name={name} selected={selected} color={glyphColor} />
          )}
        </PressFeedback>
      )}
    </Pressable>
  );
};

export const PanelLink = ({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        flexDirection: "row",
        gap: 12,
        minHeight: Platform.OS === "android" ? 48 : 44,
        opacity: pressed ? 0.6 : 1,
        paddingVertical: 10,
      })}
    >
      <BodyText style={{ flex: 1 }}>{title}</BodyText>
      <ShellIcon name="chevron" size={16} color={colors.muted} />
    </Pressable>
  );
};

// Command output usually ends with a newline, which renders as an empty last
// line.
const trailingNewline = /\n$/u;

export const CodeBlock = ({
  code,
  selectable = true,
}: {
  code: string;
  selectable?: boolean;
}) => (
  <CodeCard code={code.replace(trailingNewline, "")} selectable={selectable} />
);

export const MessageText = ({
  text,
  muted,
  selectable = true,
}: {
  text: string;
  muted?: boolean;
  selectable?: boolean;
}) => <Markdown text={text} muted={muted} selectable={selectable} />;

export const ChatKeyboardView = ({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) => {
  const styles = useThemedStyles(createStyles);
  const { height } = useReanimatedKeyboardAnimation();
  const { bottom } = useSafeAreaInsets();
  const keyboardPadding = useAnimatedStyle(
    () => ({
      paddingBottom: enabled ? Math.max(0, -height.value - bottom) : 0,
    }),
    [enabled, bottom]
  );
  if (Platform.OS === "android") {
    return (
      <Animated.View style={[styles.container, keyboardPadding]}>
        {children}
      </Animated.View>
    );
  }
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      automaticOffset
      enabled={enabled}
    >
      {children}
    </KeyboardAvoidingView>
  );
};
