import { useEffect, useEffectEvent, useRef } from "react";

import { serverFileUri } from "../../lib/chat";
import {
  useComposerActions,
  useComposerStore,
} from "../../stores/composer-store";
import type { ComposerDraft } from "./use-composer-draft";

interface UseAttachmentHandoffOptions {
  sessionID: string | null;
  showError: (reason: unknown) => void;
  composer: ComposerDraft;
}

export const useAttachmentHandoff = ({
  sessionID,
  showError,
  composer,
}: UseAttachmentHandoffOptions) => {
  const { setDraft, setAttachments, draftLoaded } = composer;
  const { clearHandoff } = useComposerActions();
  const handoff = useComposerStore((state) =>
    sessionID ? state.handoffs[sessionID] : undefined
  );
  const attachmentPath = handoff?.path;
  const attachmentContext = handoff?.context;
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
      if (sessionID) {
        clearHandoff(sessionID);
      }
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
