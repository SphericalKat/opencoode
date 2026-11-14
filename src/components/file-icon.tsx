import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";

import { chooseFileIcon, fileIcons } from "../generated/file-icons";
import type { FileIconName } from "../generated/file-icons";

const xmlByIcon = new Map<FileIconName, string>();

const iconXml = (name: FileIconName): string => {
  const cached = xmlByIcon.get(name);

  if (cached) {
    return cached;
  }

  const { viewBox, body } = fileIcons[name];
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>`;
  xmlByIcon.set(name, xml);
  return xml;
};

export const FileIcon = ({
  path,
  size = 16,
}: {
  path: string;
  size?: number;
}) => (
  <View aria-hidden style={styles.frame}>
    <SvgXml xml={iconXml(chooseFileIcon(path))} width={size} height={size} />
  </View>
);

const styles = StyleSheet.create({
  frame: {
    flexShrink: 0,
  },
});
