import type React from "react";
import { StyleSheet, View } from "react-native";

import { BodyText, sans } from "../../components/ui";
import { useThemedStyles } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    control: {
      flexDirection: "row",
      justifyContent: "flex-end",
      width: "100%",
    },
    copy: { gap: 4 },
    description: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 13,
      fontWeight: "400",
      lineHeight: 20,
    },
    row: {
      backgroundColor: colors.panel,
      flexDirection: "column",
      gap: 16,
      paddingHorizontal: 16,
      paddingVertical: 20,
    },
    title: {
      color: colors.text,
      fontFamily: sans,
      fontSize: 13,
      fontWeight: "500",
      letterSpacing: -0.04,
      lineHeight: 16,
    },
  });

export const SettingsRow = ({
  title,
  description,
  children,
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <BodyText style={styles.title}>{title}</BodyText>
        <BodyText style={styles.description}>{description}</BodyText>
      </View>
      <View style={styles.control}>{children}</View>
    </View>
  );
};
