import type { ToolFileContent } from "@opencode/client";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { useNativePresentation } from "../lib/sheets";
import { useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { Button, ErrorNotice, BodyText, Row, Sheet } from "./ui";

interface Props {
  content: ToolFileContent;
  client?: Client;
  directory?: string;
  thumbnail?: boolean;
}
const imageTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
]);

export function isImageArtifact(content: ToolFileContent) {
  return imageTypes.has(content.mime.split(";")[0].trim().toLowerCase());
}

function source(
  uri: string
):
  | { kind: "data" }
  | { kind: "file"; path: string }
  | { kind: "remote"; url: string }
  | undefined {
  if (uri.startsWith("data:")) {
    return { kind: "data" };
  }
  if (/[\u0000-\u0020\u007F]/.test(uri)) {
    return;
  }
  try {
    const url = new URL(uri);
    if (url.username || url.password) {
      return;
    }
    if (
      url.protocol === "file:" &&
      (!url.hostname || url.hostname === "localhost") &&
      url.pathname.startsWith("/") &&
      !url.search &&
      !url.hash
    ) {
      const path = decodeURIComponent(url.pathname);
      if (!/[\u0000-\u001F\u007F]/.test(path)) {
        return { kind: "file", path };
      }
    }
    if (
      (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname
    ) {
      return { kind: "remote", url: url.href };
    }
  } catch {}
}

function inlineBytes(uri: string): Uint8Array {
  const comma = uri.indexOf(",");
  if (comma === -1) {
    throw new Error("The attachment data is invalid");
  }
  const header = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  if (/;base64$/i.test(header)) {
    return Uint8Array.from(atob(payload.replace(/\s/g, "")), (char) =>
      char.charCodeAt(0)
    );
  }
  const bytes: number[] = [];
  for (let index = 0; index < payload.length;) {
    if (payload[index] === "%") {
      const hex = payload.slice(index + 1, index + 3);
      if (!/^[a-f\d]{2}$/i.test(hex)) {
        throw new Error("The attachment data is invalid");
      }
      bytes.push(Number.parseInt(hex, 16));
      index += 3;
    } else {
      const character = String.fromCodePoint(payload.codePointAt(index)!);
      bytes.push(...new TextEncoder().encode(character));
      index += character.length;
    }
  }
  return new Uint8Array(bytes);
}

function dataUri(bytes: Uint8Array, mime: string) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 16_384));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

export function ArtifactContent(props: Props) {
  return (
    <Artifact
      key={`${props.directory ?? ""}:${props.content.uri}:${props.content.mime}`}
      {...props}
    />
  );
}

function Artifact({ content, client, directory, thumbnail }: Props) {
  const styles = useThemedStyles(createStyles);
  const presentNative = useNativePresentation();
  const target = source(content.uri);
  const mime = content.mime.split(";")[0].trim().toLowerCase();
  const image = isImageArtifact(content);
  const [preview, setPreview] = useState<string>();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const controller = useRef(new AbortController());
  const running = useRef<AbortSignal | undefined>(undefined);
  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    running.current = undefined;
    setPreview(undefined);
    setExpanded(false);
    setError(undefined);
    setBusy(false);
    return () => request.abort();
  }, [client]);
  useEffect(() => {
    if (image) {
      void perform("preview");
    }
  }, [client]);
  const filename =
    (
      content.name ||
      `attachment.${mime.split("/")[1]?.replaceAll(/[^a-z\d]/gi, "") || "bin"}`
    )
      .split(/[\\/]/)
      .pop()!
      .replaceAll(/[\u0000-\u001F\u007F<>:"|?*]/g, "_") || "attachment";

  async function read(signal: AbortSignal) {
    if (!target) {
      throw new Error("This attachment URI is not supported");
    }
    if (target.kind === "data") {
      return inlineBytes(content.uri);
    }
    if (target.kind === "file") {
      if (!client) {
        throw new Error(
          "This server does not provide remote file downloads. Open this file in the terminal."
        );
      }
      return client.file.read(
        { location: directory ? { directory } : undefined, path: target.path },
        { signal }
      );
    }
    const response = await fetch(target.url, { credentials: "omit", signal });
    if (!response.ok) {
      throw new Error(
        `The attachment request failed (HTTP ${response.status})`
      );
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async function perform(action: "preview" | "save") {
    if (running.current) {
      return;
    }
    const { signal } = controller.current;
    running.current = signal;
    setBusy(true);
    setError(undefined);
    let temporary: File | undefined;
    try {
      if (
        action === "save" &&
        Platform.OS !== "web" &&
        !(await Sharing.isAvailableAsync())
      ) {
        throw new Error("File sharing is unavailable on this device");
      }
      const bytes = await read(signal);
      if (signal.aborted) {
        return;
      }
      if (action === "preview") {
        setPreview(dataUri(bytes, mime));
      } else if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([new Uint8Array(bytes).buffer], { type: mime })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        temporary = new File(
          Paths.cache,
          `artifact-${Date.now()}-${Math.random().toString(36).slice(2)}-${filename}`
        );
        await temporary.write(bytes);
        const { uri } = temporary;
        if (!signal.aborted) {
          await presentNative(() =>
            Sharing.shareAsync(uri, { dialogTitle: filename, mimeType: mime })
          );
        }
      }
    } catch (error_) {
      if (!signal.aborted) {
        setError(errorMessage(error_));
      }
    } finally {
      if (temporary?.exists) {
        try {
          await temporary.delete();
        } catch {}
      }
      if (running.current === signal) {
        running.current = undefined;
        if (!signal.aborted) {
          setBusy(false);
        }
      }
    }
  }

  if (thumbnail) {
    return (
      <View style={styles.thumbnail}>
        {preview ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Expand image preview: ${filename}`}
            onPress={() => setExpanded(true)}
          >
            <Image
              source={{ uri: preview }}
              accessibilityLabel={filename}
              resizeMode="contain"
              style={styles.thumbnailImage}
              onError={() => {
                setPreview(undefined);
                setError(
                  `This image cannot be displayed. Retry the preview or use ${Platform.OS === "web" ? "Download" : "Save or share"} to open the file.`
                );
              }}
            />
          </Pressable>
        ) : (
          <View style={styles.placeholder}>
            <BodyText muted accessibilityRole="status">
              {busy ? "Loading image…" : "Image unavailable"}
            </BodyText>
          </View>
        )}
        <BodyText numberOfLines={2} style={styles.mime}>
          {filename}
        </BodyText>
        <ErrorNotice error={error} />
        {!preview && (
          <Row>
            {!busy && (
              <Button
                title="Retry image"
                compact
                onPress={() => {
                  void perform("preview");
                }}
              />
            )}
            <Button
              title={Platform.OS === "web" ? "Download" : "Save or share"}
              compact
              disabled={busy}
              onPress={() => {
                void perform("save");
              }}
            />
          </Row>
        )}
        <Sheet
          visible={expanded}
          title={filename}
          onClose={() => setExpanded(false)}
          scroll={false}
        >
          {preview && (
            <Image
              source={{ uri: preview }}
              accessibilityLabel={`Expanded ${filename}`}
              resizeMode="contain"
              style={styles.viewerImage}
            />
          )}
          <Button
            title={Platform.OS === "web" ? "Download" : "Save or share"}
            busy={busy}
            onPress={() => {
              void perform("save");
            }}
          />
          <ErrorNotice error={error} />
        </Sheet>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BodyText numberOfLines={2} style={styles.name}>
        {filename}
      </BodyText>
      <BodyText muted style={styles.mime}>
        {content.mime}
      </BodyText>
      {target ? (
        <>
          {preview && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                expanded ? "Collapse image preview" : "Expand image preview"
              }
              onPress={() => setExpanded((value) => !value)}
            >
              <Image
                source={{ uri: preview }}
                accessibilityLabel={filename}
                resizeMode="contain"
                style={[styles.preview, expanded && styles.expanded]}
                onError={() => {
                  setPreview(undefined);
                  setError(
                    `This image cannot be displayed. Use ${Platform.OS === "web" ? "Download" : "Save or share"} to open the file.`
                  );
                }}
              />
            </Pressable>
          )}
          <Row>
            {image && !preview && (
              <Button
                title="Show image"
                compact
                disabled={busy}
                onPress={() => {
                  void perform("preview");
                }}
              />
            )}
            <Button
              title={Platform.OS === "web" ? "Download" : "Save or share"}
              compact
              busy={busy}
              onPress={() => {
                void perform("save");
              }}
            />
          </Row>
        </>
      ) : (
        <BodyText muted>This attachment URI is not supported.</BodyText>
      )}
      <ErrorNotice error={error} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.panel,
      borderColor: colors.border,
      borderRadius: 8,
      borderWidth: 1,
      gap: 8,
      minWidth: 0,
      padding: 12,
    },
    expanded: { height: 420 },
    mime: { fontSize: 13 },
    name: { fontWeight: "500" },
    placeholder: {
      backgroundColor: colors.panel,
      borderRadius: 6,
      height: 112,
      justifyContent: "center",
      padding: 10,
    },
    preview: {
      backgroundColor: colors.bg,
      borderRadius: 6,
      height: 180,
      width: "100%",
    },
    thumbnail: {
      flexBasis: 148,
      flexShrink: 1,
      gap: 6,
      maxWidth: "100%",
      minWidth: 0,
    },
    thumbnailImage: {
      backgroundColor: colors.panel,
      borderRadius: 6,
      height: 112,
      width: "100%",
    },
    viewerImage: { flex: 1, minHeight: 0, width: "100%" },
  });
