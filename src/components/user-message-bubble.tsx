import React from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../lib/theme";

const styles = StyleSheet.create({
  attachments: { width: "92%" },
  bubble: {
    alignSelf: "flex-end",
    borderRadius: 12,
    gap: 10,
    maxWidth: "92%",
    minWidth: 0,
    padding: 12,
  },
});

export const UserMessageBubble = ({
  children,
  withAttachments = false,
}: {
  children: React.ReactNode;
  withAttachments?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.bubble,
        withAttachments && styles.attachments,
        { backgroundColor: colors.raised },
      ]}
    >
      {children}
    </View>
  );
};
