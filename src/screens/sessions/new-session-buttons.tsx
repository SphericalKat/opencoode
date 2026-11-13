import { ActivityIndicator, Pressable } from "react-native";

import { ShellIcon } from "../../components/shell-icon";
import { BodyText } from "../../components/ui";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { createStyles } from "./styles";

interface NewSessionButtonProps {
  busy: boolean;
  creating: boolean;
  onPress: () => void;
}

export const NewSessionPill = ({
  busy,
  creating,
  onPress,
}: NewSessionButtonProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New session"
      accessibilityState={{ busy: creating, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.betaNewSession,
        (pressed || busy) && styles.pressed,
      ]}
    >
      {creating ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <ShellIcon name="compose" color={colors.muted} size={14} />
      )}
      <BodyText style={styles.betaNewLabel}>New session</BodyText>
    </Pressable>
  );
};
