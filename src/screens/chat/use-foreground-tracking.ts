import React, { useEffect } from "react";
import { AppState } from "react-native";

import { saveDraft } from "../../lib/drafts";
import type { ComposerDraft } from "./use-composer-draft";

interface UseForegroundTrackingOptions {
  draftKey: string;
  setForeground: React.Dispatch<React.SetStateAction<boolean>>;
  showError: (reason: unknown) => void;
  composer: ComposerDraft;
}

export const useForegroundTracking = ({
  draftKey,
  setForeground,
  showError,
  composer,
}: UseForegroundTrackingOptions) => {
  const { draftRef, didLoadDraft } = composer;
  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
      if (state !== "active" && didLoadDraft.current) {
        void saveDraft(draftKey, draftRef.current).catch(showError);
      }
    });
    return () => listener.remove();
  }, [draftKey, showError, setForeground, draftRef, didLoadDraft]);
};
