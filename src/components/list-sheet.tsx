import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { playHaptic } from "../lib/haptics";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { ShellIcon } from "./shell-icon";
import type { ShellIconName } from "./shell-icon";
import { elevation, radius } from "./surface";
import { BodyText, Sheet, touchTarget, usePressFeedback } from "./ui";

type SheetVariant = "grouped" | "menu";

const flattenChildren = (children: React.ReactNode): React.ReactNode[] => {
  if (Array.isArray(children)) {
    return children.flatMap(flattenChildren);
  }
  if (
    React.isValidElement<{ children?: React.ReactNode }>(children) &&
    children.type === React.Fragment
  ) {
    return flattenChildren(children.props.children);
  }
  if (
    children === null ||
    children === undefined ||
    typeof children === "boolean"
  ) {
    return [];
  }
  return [children];
};

const VariantContext = React.createContext<SheetVariant>("grouped");

const useMenuBackground = () => {
  const { colors, scheme } = useTheme();
  return scheme === "light" ? colors.bg : colors.panel;
};

const iconSlot = 16;
const staticRowHeight = 36;
const groupTitleHeight = 40;
const disabledRowOpacity = 0.5;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    description: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "400",
      lineHeight: 18,
    },
    disabled: { opacity: disabledRowOpacity },
    divider: {
      backgroundColor: colors.border,
      height: StyleSheet.hairlineWidth,
    },
    grouped: {
      backgroundColor: colors.layer02,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      overflow: "hidden",
    },
    groupTitle: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "400",
      justifyContent: "center",
      lineHeight: 20,
      minHeight: groupTitleHeight,
      paddingLeft: 12,
      paddingTop: 4,
      textAlignVertical: "center",
    },
    iconSlot: {
      alignItems: "center",
      height: iconSlot,
      justifyContent: "center",
      width: iconSlot,
    },
    label: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 20,
    },
    labelColumn: { flexShrink: 1, minWidth: 0 },
    menu: { borderRadius: radius.md, gap: 2, padding: 2 },
    row: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: touchTarget,
      overflow: "hidden",
      paddingEnd: 8,
      paddingStart: 12,
      paddingVertical: 8,
    },
    rowMenu: { borderRadius: radius.sm },
    rowStatic: {
      minHeight: staticRowHeight,
      paddingEnd: 12,
    },
    trailingAuto: { marginLeft: "auto" },
    trailingAfterValue: { marginStart: 4 },
    value: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "400",
      lineHeight: 20,
      marginLeft: "auto",
      flexShrink: 1,
      textAlign: "right",
    },
  });

export const SheetGroup = ({
  variant = "grouped",
  title,
  children,
}: {
  variant?: SheetVariant;
  title?: string;
  children: React.ReactNode;
}) => {
  const { scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const items = flattenChildren(children);
  const menuBackground = useMenuBackground();
  const grouped = variant === "grouped";
  const containerStyle: StyleProp<ViewStyle> = grouped
    ? styles.grouped
    : [
        styles.menu,
        {
          backgroundColor: menuBackground,
          boxShadow: elevation(scheme).raised,
        },
      ];
  return (
    <View style={containerStyle}>
      {title !== undefined && (
        <BodyText accessibilityRole="header" style={styles.groupTitle}>
          {title}
        </BodyText>
      )}
      <VariantContext value={variant}>
        {items.map((child, index) => (
          <React.Fragment
            key={React.isValidElement(child) ? (child.key ?? index) : index}
          >
            {grouped && index > 0 && <View style={styles.divider} />}
            {child}
          </React.Fragment>
        ))}
      </VariantContext>
    </View>
  );
};

export const SheetGroupItem = ({
  variant = "grouped",
  first,
  last,
  children,
}: {
  variant?: SheetVariant;
  first: boolean;
  last: boolean;
  children: React.ReactNode;
}) => {
  const { colors } = useTheme();
  const menuBackground = useMenuBackground();
  if (variant === "menu") {
    return (
      <View
        style={[
          { backgroundColor: menuBackground },
          first && {
            borderTopLeftRadius: radius.md,
            borderTopRightRadius: radius.md,
          },
          last && {
            borderBottomLeftRadius: radius.md,
            borderBottomRightRadius: radius.md,
          },
        ]}
      >
        <VariantContext value="menu">{children}</VariantContext>
      </View>
    );
  }
  return (
    <View
      style={[
        {
          backgroundColor: colors.layer02,
          borderBottomWidth: last ? 1 : StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderLeftWidth: 1,
          borderRightWidth: 1,
          borderTopWidth: first ? 1 : 0,
        },
        first && {
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
        },
        last && {
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
        },
      ]}
    >
      <VariantContext value="grouped">{children}</VariantContext>
    </View>
  );
};

export const SheetRow = ({
  label,
  description,
  value,
  icon,
  checked,
  trailing,
  destructive,
  disabled,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityRole = "button",
}: {
  label: string;
  description?: string;
  value?: string;
  icon?: ShellIconName | React.ReactNode;
  checked?: boolean;
  trailing?: "chevron" | React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityRole?: "button" | "radio" | "switch";
}) => {
  const variant = React.useContext(VariantContext);
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const isStatic = onPress === undefined;
  const labelColor = (() => {
    if (destructive) {
      return colors.danger;
    }
    return isStatic ? colors.muted : colors.text;
  })();
  const hasValue = value !== undefined && value !== "";
  let trailingNode: React.ReactNode = trailing;
  if (checked) {
    trailingNode = <ShellIcon name="check" size={16} color={colors.text} />;
  } else if (trailing === "chevron") {
    trailingNode = <ShellIcon name="chevron" size={16} color={colors.faint} />;
  }
  const hasTrailing = trailingNode !== undefined && trailingNode !== null;
  const iconNode =
    typeof icon === "string" ? (
      <ShellIcon
        name={icon as ShellIconName}
        size={iconSlot}
        color={colors.faint}
      />
    ) : (
      icon
    );
  const content = (
    <>
      {iconNode !== undefined && iconNode !== null && (
        <View style={styles.iconSlot}>{iconNode}</View>
      )}
      <View style={styles.labelColumn}>
        <BodyText
          numberOfLines={1}
          style={[styles.label, { color: labelColor }]}
        >
          {label}
        </BodyText>
        {description !== undefined && (
          <BodyText numberOfLines={2} style={styles.description}>
            {description}
          </BodyText>
        )}
      </View>
      {hasValue && (
        <BodyText
          numberOfLines={1}
          style={[
            styles.value,
            isStatic && { color: colors.text, fontVariant: ["tabular-nums"] },
          ]}
        >
          {value}
        </BodyText>
      )}
      {hasTrailing && (
        <View
          style={hasValue ? styles.trailingAfterValue : styles.trailingAuto}
        >
          {trailingNode}
        </View>
      )}
    </>
  );
  if (isStatic) {
    return (
      <View
        accessible
        accessibilityLabel={hasValue ? `${label}, ${value}` : label}
        style={[styles.row, styles.rowStatic]}
      >
        {content}
      </View>
    );
  }
  const keepsOverlay = checked;
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={
        accessibilityLabel ?? (hasValue ? `${label}, ${value}` : label)
      }
      accessibilityState={{ checked, disabled: !!disabled, selected: checked }}
      android_ripple={android_ripple}
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        variant === "menu" && styles.rowMenu,
        keepsOverlay && { backgroundColor: colors.pressedOverlay },
        pressed && pressedStyle,
        disabled && styles.disabled,
      ]}
    >
      {content}
    </Pressable>
  );
};

export interface ListSheetOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ShellIconName;
  disabled?: boolean;
}

export const ListSheet = <T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  onDismiss,
  variant = "grouped",
  header,
  footer,
}: {
  visible: boolean;
  title: string;
  options: readonly ListSheetOption<T>[];
  value?: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  onDismiss?: () => void;
  variant?: SheetVariant;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) => {
  const choose = (next: T) => {
    if (next !== value) {
      playHaptic("select");
    }
    onClose();
    onSelect(next);
  };
  return (
    <Sheet
      visible={visible}
      title={title}
      fitContent
      onClose={onClose}
      onDismiss={onDismiss}
    >
      {header}
      <SheetGroup variant={variant}>
        {options.map((option) => (
          <SheetRow
            key={option.value}
            label={option.label}
            description={option.description}
            icon={option.icon}
            checked={option.value === value}
            disabled={option.disabled}
            accessibilityRole="radio"
            onPress={() => choose(option.value)}
          />
        ))}
      </SheetGroup>
      {footer}
    </Sheet>
  );
};
