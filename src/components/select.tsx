import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { AnchoredMenu, useMenuAnchor } from "./anchored-menu";
import type { AnchoredMenuItem, MenuPlacement, Rect } from "./anchored-menu";
import { ShellIcon } from "./shell-icon";
import type { ShellIconName } from "./shell-icon";
import { BodyText, sans, touchTarget, usePressFeedback } from "./ui";

export type SelectAppearance = "inline" | "chip" | "outline";
type SelectIndicator = "menu" | "sheet";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export type SelectEntry<T extends string> =
  | SelectOption<T>
  | { type: "separator"; key: string };

export interface SelectAction {
  key: string;
  label: string;
  onSelect: () => void;
  icon?: ShellIconName;
  disabled?: boolean;
}

const CHEVRON_SIZE = 16;
const CHEVRON_GAP = 4;
const DISABLED_OPACITY = 0.5;

const metrics = {
  chip: { endPad: 7, height: 28, radius: 6, startPad: 11 },
  inline: { endPad: 4, height: 24, radius: 4, startPad: 8 },
  outline: { endPad: 8, height: 28, radius: 6, startPad: 11 },
} as const;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    base: {
      alignItems: "center",
      flexDirection: "row",
      overflow: "hidden",
    },
    chevron: { marginStart: CHEVRON_GAP },
    flexible: { flexShrink: 1, minWidth: 0 },
    outline: {
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
    },
    value: { flexShrink: 1, fontFamily: sans, minWidth: 0 },
    valueChip: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "400",
      lineHeight: 20,
    },
    valueInline: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 16,
    },
    valueOutline: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "500",
      lineHeight: 20,
    },
  });

const openBackground = (
  appearance: SelectAppearance,
  colors: ThemeColors
): string => (appearance === "chip" ? colors.pressedOverlay : colors.selected);

export const SelectTrigger = ({
  value,
  children,
  onPress,
  accessibilityLabel,
  appearance = "inline",
  indicator = "menu",
  expanded,
  busy,
  disabled,
  flexible,
  maxWidth,
  ref,
}: {
  value: string;
  children?: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  appearance?: SelectAppearance;
  indicator?: SelectIndicator;
  expanded?: boolean;
  busy?: boolean;
  disabled?: boolean;
  flexible?: boolean;
  maxWidth?: number;
  ref?: React.Ref<React.ComponentRef<typeof Pressable>>;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const size = metrics[appearance];
  const slop = Math.max(0, (touchTarget - size.height) / 2);
  const open = !!expanded;
  const chipOpen = open && appearance === "chip";
  const valueStyle = {
    chip: styles.valueChip,
    inline: styles.valueInline,
    outline: styles.valueOutline,
  }[appearance];
  const inactive = !!disabled || !!busy;
  const textColor = chipOpen ? { color: colors.text } : null;
  const chevronColor = chipOpen ? colors.text : colors.faint;
  const content = children ?? (
    <BodyText numberOfLines={1} style={[styles.value, valueStyle, textColor]}>
      {value}
    </BodyText>
  );
  return (
    <Pressable
      ref={ref}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{
        busy: !!busy,
        disabled: !!disabled,
        expanded: open,
      }}
      android_ripple={inactive ? undefined : android_ripple}
      disabled={inactive}
      hitSlop={{ bottom: slop, top: slop }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        appearance === "outline" && styles.outline,
        flexible && styles.flexible,
        {
          borderRadius: size.radius,
          height: size.height,
          maxWidth,
          paddingEnd: size.endPad,
          paddingStart: size.startPad,
        },
        open && { backgroundColor: openBackground(appearance, colors) },
        pressed && !inactive && pressedStyle,
        disabled && { opacity: DISABLED_OPACITY },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={colors.muted} /> : content}
      <View style={styles.chevron}>
        <ShellIcon
          name={indicator === "sheet" ? "chevron-up-down" : "chevron-down"}
          size={CHEVRON_SIZE}
          color={chevronColor}
        />
      </View>
    </Pressable>
  );
};

const buildItems = <T extends string>({
  options,
  value,
  onSelect,
  actions,
  queueAction,
}: {
  options: readonly SelectEntry<T>[];
  value: T;
  onSelect: (value: T) => void;
  actions?: readonly SelectAction[];
  queueAction: (run: () => void) => void;
}): AnchoredMenuItem[] => {
  const items: AnchoredMenuItem[] = options.map((entry) => {
    if (!("value" in entry)) {
      return { key: entry.key, type: "separator" };
    }
    return {
      checked: entry.value === value,
      disabled: entry.disabled,
      key: entry.value,
      label: entry.label,
      onSelect: () => onSelect(entry.value),
      role: "menuitemradio",
    };
  });
  if (actions && actions.length > 0) {
    items.push({ key: "actions-separator", type: "separator" });
    for (const action of actions) {
      items.push({
        disabled: action.disabled,
        icon: action.icon,
        key: action.key,
        label: action.label,
        onSelect: () => {
          queueAction(action.onSelect);
        },
        role: "menuitem",
      });
    }
  }
  return items;
};

export const SelectMenu = <T extends string>({
  value,
  options,
  onSelect,
  actions,
  accessibilityLabel,
  label,
  appearance = "inline",
  indicator,
  placement = "bottom-start",
  gutter = 4,
  maxWidth,
  maxHeight,
  busy,
  disabled,
}: {
  value: T;
  options: readonly SelectEntry<T>[];
  onSelect: (value: T) => void;
  actions?: readonly SelectAction[];
  accessibilityLabel: string;
  label?: string;
  appearance?: SelectAppearance;
  indicator?: SelectIndicator;
  placement?: MenuPlacement;
  gutter?: number;
  maxWidth?: number;
  maxHeight?: number;
  busy?: boolean;
  disabled?: boolean;
}) => {
  const { ref, measure } = useMenuAnchor();
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const selected = options.find(
    (entry): entry is SelectOption<T> =>
      "value" in entry && entry.value === value
  );
  const shown = label ?? selected?.label ?? "";
  const queueAction = (run: () => void) => setPending(() => run);
  const openMenu = () => {
    measure()
      .then((rect) => {
        setAnchor(rect);
        setVisible(true);
        return rect;
      })
      .catch(() => null);
  };
  const items = buildItems({
    actions,
    onSelect,
    options,
    queueAction,
    value,
  });
  const resolvedIndicator =
    indicator ?? (placement.startsWith("top") ? "sheet" : "menu");
  const style: StyleProp<ViewStyle> = { alignSelf: "flex-start" };
  return (
    <View ref={ref} collapsable={false} style={style}>
      <SelectTrigger
        value={shown}
        accessibilityLabel={`${accessibilityLabel}: ${shown}`}
        appearance={appearance}
        indicator={resolvedIndicator}
        expanded={visible}
        busy={busy}
        disabled={disabled}
        maxWidth={maxWidth}
        onPress={openMenu}
      />
      <AnchoredMenu
        visible={visible}
        anchor={anchor}
        accessibilityLabel={accessibilityLabel}
        items={items}
        placement={placement}
        gutter={gutter}
        maxHeight={maxHeight}
        onClose={() => setVisible(false)}
        onClosed={() => {
          setPending(null);
          pending?.();
        }}
      />
    </View>
  );
};
