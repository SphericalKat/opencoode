import * as DocumentPicker from "expo-document-picker";
import { useRef } from "react";

import { settle } from "../../lib/async";
import type { ChatBackend } from "../../lib/chat-backend";
import type { useNativePresentation } from "../../lib/sheets";
import { readAttachments } from "./attachments";
import type { Alive, Capabilities } from "./types";
import type { ComposerDraft } from "./use-composer-draft";

interface UseDeviceAttachmentsOptions {
  alive: Alive;
  backend: ChatBackend;
  capabilities: Capabilities;
  showError: (reason: unknown) => void;
  withNativePresentation: ReturnType<typeof useNativePresentation>;
  composer: ComposerDraft;
}

export const useDeviceAttachments = ({
  alive,
  backend,
  capabilities,
  showError,
  withNativePresentation,
  composer,
}: UseDeviceAttachmentsOptions) => {
  const { setAttachments, draftLoaded } = composer;
  const devicePickerActive = useRef(false);
  const attachDevice = async () => {
    if (
      !capabilities.attachments ||
      !draftLoaded ||
      !alive.current ||
      devicePickerActive.current
    ) {
      return;
    }
    devicePickerActive.current = true;
    await settle(
      async () => {
        const result = await withNativePresentation(() =>
          DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
            multiple: true,
            ...(backend.kind === "pi" ? { type: "image/*" } : {}),
          })
        );
        if (result.canceled) {
          return;
        }
        const files = await readAttachments(result.assets);
        if (alive.current) {
          setAttachments((current) => [...current, ...files]);
        }
      },
      showError,
      () => {
        devicePickerActive.current = false;
      }
    );
  };

  return { attachDevice };
};
