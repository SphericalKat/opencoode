import { StyleSheet, View } from "react-native";

import { useTheme } from "../lib/theme";
import { BodyText } from "./ui";

const SIZE = 16;
const DOT_SIZE = 8;
const DOT_OFFSET = -4;

const styles = StyleSheet.create({
  dot: {
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1,
    height: DOT_SIZE,
    position: "absolute",
    right: DOT_OFFSET,
    top: DOT_OFFSET,
    width: DOT_SIZE,
  },
  letter: {
    fontSize: 11,
    fontWeight: "500",
    includeFontPadding: false,
    lineHeight: 15,
  },
  outer: { flexShrink: 0, height: SIZE, position: "relative", width: SIZE },
  surface: {
    alignItems: "center",
    borderRadius: 4,
    height: SIZE,
    justifyContent: "center",
    width: SIZE,
  },
});

export const ProjectAvatar = ({
  name,
  unread = false,
  ringColor,
}: {
  name: string;
  unread?: boolean;
  ringColor: string;
}) => {
  const { colors } = useTheme();
  const letter = ([...name][0] ?? "?").toUpperCase();
  return (
    <View style={styles.outer}>
      <View style={[styles.surface, { backgroundColor: colors.avatar }]}>
        <BodyText style={[styles.letter, { color: colors.onAvatar }]}>
          {letter}
        </BodyText>
      </View>
      {unread ? (
        <View
          aria-hidden
          pointerEvents="none"
          style={[
            styles.dot,
            { backgroundColor: colors.switchTrackOn, borderColor: ringColor },
          ]}
        />
      ) : null}
    </View>
  );
};
