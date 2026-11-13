import type * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { Platform } from "react-native";

import type { Attachment } from "./types";

export const BASE64_CHUNK = 0x80_00;

export const readWebFileBase64 = async (file: Blob, name: string) => {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    throw new Error(`Cannot read ${name}`);
  }
  let binary = "";
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    binary += String.fromCodePoint(
      ...bytes.subarray(index, index + BASE64_CHUNK)
    );
  }
  return btoa(binary);
};

export const readAttachment = async (
  asset: DocumentPicker.DocumentPickerAsset
): Promise<Attachment> => {
  const webFile = Platform.OS === "web" && asset.file ? asset.file : undefined;
  const base64 = webFile
    ? await readWebFileBase64(webFile, asset.name)
    : await new File(asset.uri).base64();
  if (base64.length > 14 * 1024 * 1024) {
    throw new Error(`${asset.name} exceeds the 10 MB attachment limit`);
  }
  return {
    name: asset.name,
    uri: `data:${asset.mimeType || "application/octet-stream"};base64,${base64}`,
  };
};

export const readAttachments = (
  assets: DocumentPicker.DocumentPickerAsset[]
) => {
  for (const asset of assets) {
    if (asset.size && asset.size > 10 * 1024 * 1024) {
      throw new Error(`${asset.name} exceeds the 10 MB attachment limit`);
    }
  }
  return Promise.all(assets.map((asset) => readAttachment(asset)));
};
