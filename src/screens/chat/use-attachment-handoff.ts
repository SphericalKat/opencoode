import { useEffect, useEffectEvent, useRef } from "react";

import { serverFileUri } from "../../lib/chat";
import type { ComposerDraft } from "./use-composer-draft";

interface UseAttachmentHandoffOptions {
  attachmentContext: string | undefined;
  attachmentPath: string | undefined;
  onAttachmentConsumed: (() => void) | undefined;
  showError: (reason: unknown) => void;
  composer: ComposerDraft;
}

export const useAttachmentHandoff = ({
  attachmentContext,
  attachmentPath,
  onAttachmentConsumed,
  showError,
  composer,
}: UseAttachmentHandoffOptions) => {
  const { setDraft, setAttachments, draftLoaded } = composer;
  const consumedAttachment = useRef<{ path: string; context?: string } | null>(
    null
  );
  const consumeAttachment = useEffectEvent((path: string, extra?: string) => {
    try {
      if (extra === undefined) {
        const uri = serverFileUri(path);
        setAttachments((current) =>
          current.some((file) => file.uri === uri)
            ? current
            : [...current, { name: path.split("/").pop(), uri }]
        );
      } else if (extra) {
        setDraft((current) => (current ? `${current}\n\n${extra}` : extra));
      }
      consumedAttachment.current = { context: extra, path };
      onAttachmentConsumed?.();
    } catch (error_) {
      showError(error_);
    }
  });
  useEffect(() => {
    if (!attachmentPath) {
      consumedAttachment.current = null;
      return;
    }
    if (
      !draftLoaded ||
      (consumedAttachment.current?.path === attachmentPath &&
        consumedAttachment.current.context === attachmentContext)
    ) {
      return;
    }
    consumeAttachment(attachmentPath, attachmentContext);
  }, [attachmentPath, attachmentContext, draftLoaded]);
};
