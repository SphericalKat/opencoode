import React from "react";
import { ScrollView, Text } from "react-native";

import { useTheme } from "../lib/theme";
import { mono } from "./ui";

export function Patch({ patch }: { patch: string }) {
  const { colors } = useTheme();
  let inHunk = false;
  return (
    <ScrollView horizontal>
      <Text
        selectable
        style={{
          color: colors.text,
          fontFamily: mono,
          fontSize: 13,
          lineHeight: 20,
        }}
      >
        {patch.split(/(?<=\n)/).map((line, index) => {
          if (line.startsWith("@@")) {
            inHunk = true;
          }
          const color =
            inHunk && line.startsWith("+")
              ? colors.success
              : inHunk && line.startsWith("-")
                ? colors.danger
                : undefined;
          return (
            <Text key={index} style={color ? { color } : undefined}>
              {line}
            </Text>
          );
        })}
      </Text>
    </ScrollView>
  );
}
