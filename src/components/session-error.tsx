import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../lib/theme";
import { splitErrorTitle, unwrapErrorMessage } from "../lib/transcript";
import { ShellIcon } from "./shell-icon";
import { sans } from "./ui";

const styles = StyleSheet.create({
  body: { flex: 1, gap: 8, minWidth: 0 },
  icon: { marginTop: 1 },
  row: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  text: {
    fontFamily: sans,
    fontSize: 13,
    letterSpacing: -0.04,
    lineHeight: 18,
  },
  title: { fontWeight: "500" },
});

export const SessionErrorNotice = ({
  message,
  selectable,
  children,
}: {
  message: string;
  selectable?: boolean;
  children?: React.ReactNode;
}) => {
  const { colors } = useTheme();
  const { title, detail } = splitErrorTitle(unwrapErrorMessage(message));
  return (
    <View accessibilityRole="alert" style={styles.row}>
      <View style={styles.icon}>
        <ShellIcon name="warning" size={16} color={colors.danger} />
      </View>
      <View style={styles.body}>
        <Text
          selectable={selectable}
          style={[styles.text, { color: colors.text }]}
        >
          {title !== undefined && <Text style={styles.title}>{title}</Text>}
          {detail}
        </Text>
        {children}
      </View>
    </View>
  );
};
