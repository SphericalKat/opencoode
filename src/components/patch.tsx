import React from "react";
import { ScrollView, Text } from "react-native";

import { useTheme } from "../lib/theme";
import { mono } from "./ui";

type PatchLineKind = "added" | "removed" | undefined;

const patchLines = (patch: string): { line: string; kind: PatchLineKind }[] => {
  let inHunk = false;
  return patch.split(/(?<=\n)/u).map((line) => {
    if (line.startsWith("@@")) {
      inHunk = true;
    }
    let kind: PatchLineKind;
    if (inHunk && line.startsWith("+")) {
      kind = "added";
    } else if (inHunk && line.startsWith("-")) {
      kind = "removed";
    }
    return { kind, line };
  });
};

export const Patch = ({ patch }: { patch: string }) => {
  const { colors } = useTheme();
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
        {patchLines(patch).map(({ line, kind }, index) => {
          let color: string | undefined;
          if (kind === "added") {
            color = colors.success;
          } else if (kind === "removed") {
            color = colors.danger;
          }
          return (
            <Text key={index} style={color ? { color } : undefined}>
              {line}
            </Text>
          );
        })}
      </Text>
    </ScrollView>
  );
};
