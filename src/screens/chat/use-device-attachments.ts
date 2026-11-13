import * as DocumentPicker from "expo-document-picker";
import { useRef } from "react";
import { Keyboard } from "react-native";

import { settle } from "../../lib/async";
import type { ChatBackend } from "../../lib/chat-backend";
import type { useNativePresentation } from "../../lib/sheets";
import { readAttachments } from "./attachments";
import type { Capabilities } from "./session-sync";
import type { Alive, SetPanel } from "./types";
import type { ComposerDraft } from "./use-composer-draft";

interface UseDeviceAttachmentsOptions {
  alive: Alive;
  backend: ChatBackend;
  capabilities: Capabilities;
  foreground: boolean;
  setPanel: SetPanel;
  showError: (reason: unknown) => void;
  visible: boolean;
  withNativePresentation: ReturnType<typeof useNativePresentation>;
  composer: ComposerDraft;
}

export const useDeviceAttachments = ({
  alive,
  backend,
  capabilities,
  foreground,
  setPanel,
  showError,
  visible,
  withNativePresentation,
  composer,
}: UseDeviceAttachmentsOptions) => {
  const { setAttachments, draftLoaded } = composer;
  const queuedDevicePicker = useRef(false);
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

  const queueDevicePicker = () => {
    if (
      !draftLoaded ||
      queuedDevicePicker.current ||
      devicePickerActive.current
    ) {
      return;
    }
    queuedDevicePicker.current = true;
    Keyboard.dismiss();
    setPanel(null);
  };
  const toolsDismissed = () => {
    if (!queuedDevicePicker.current) {
      return;
    }
    queuedDevicePicker.current = false;
    if (alive.current && visible && foreground) {
      void attachDevice();
    }
  };

  return { attachDevice, queueDevicePicker, toolsDismissed };
};
