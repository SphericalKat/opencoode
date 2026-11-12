import type { SkillInfo } from "@opencode/client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { loadDraft, saveDraft } from "../../lib/drafts";
import { useUnsavedChanges } from "../../lib/unsaved";
import type { Attachment } from "./types";

interface UseComposerDraftOptions {
  draftKey: string;
  showError: (reason: unknown) => void;
  skills: SkillInfo[];
}

export const useComposerDraft = ({
  draftKey,
  showError,
  skills,
}: UseComposerDraftOptions) => {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<SkillInfo[]>([]);
  const [selectedAgentIDs, setSelectedAgentIDs] = useState<string[]>([]);
  const [restoredSkillIDs, setRestoredSkillIDs] = useState<string[]>([]);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [delivery, setDelivery] = useState<"steer" | "queue">("steer");
  const didLoadDraft = useRef(false);
  const draftSnapshot = useMemo(
    () => ({
      agentIDs: selectedAgentIDs,
      delivery,
      files: attachments,
      skillIDs: [
        ...new Set([
          ...restoredSkillIDs,
          ...selectedSkills.map((skill) => skill.id),
        ]),
      ],
      text: draft,
    }),
    [
      selectedAgentIDs,
      delivery,
      attachments,
      restoredSkillIDs,
      selectedSkills,
      draft,
    ]
  );
  const draftRef = useRef(draftSnapshot);
  useLayoutEffect(() => {
    draftRef.current = draftSnapshot;
  });
  useUnsavedChanges(
    `chat:${draftKey}`,
    "Message draft",
    !!draft ||
      attachments.length > 0 ||
      selectedSkills.length > 0 ||
      restoredSkillIDs.length > 0 ||
      selectedAgentIDs.length > 0
  );

  useEffect(() => {
    let cancelled = false;
    void loadDraft(draftKey)
      .then((value) => {
        if (cancelled) {
          return value;
        }
        if (value) {
          setDraft(value.text);
          setAttachments(value.files);
          setRestoredSkillIDs(value.skillIDs);
          setSelectedAgentIDs(value.agentIDs);
          setDelivery(value.delivery);
        }
        didLoadDraft.current = true;
        setDraftLoaded(true);
        return value;
      })
      .catch((error_) => {
        if (!cancelled) {
          showError(error_);
          didLoadDraft.current = true;
          setDraftLoaded(true);
        }
      });
    return () => {
      cancelled = true;
      if (didLoadDraft.current) {
        void saveDraft(draftKey, draftRef.current).catch(showError);
      }
    };
  }, [draftKey, showError]);
  useEffect(() => {
    if (!draftLoaded) {
      return;
    }
    const timer = setTimeout(() => {
      void saveDraft(draftKey, draftSnapshot).catch(showError);
    }, 500);
    return () => clearTimeout(timer);
  }, [draftKey, draftSnapshot, draftLoaded, showError]);
  const resolvedRestoredSkills = restoredSkillIDs.length
    ? skills.filter((skill) => restoredSkillIDs.includes(skill.id))
    : [];
  if (resolvedRestoredSkills.length > 0) {
    setSelectedSkills((current) => [
      ...current,
      ...resolvedRestoredSkills.filter(
        (skill) => !current.some((value) => value.id === skill.id)
      ),
    ]);
    setRestoredSkillIDs((current) =>
      current.filter(
        (id) => !resolvedRestoredSkills.some((skill) => skill.id === id)
      )
    );
  }
  const hasPrompt =
    !!draft.trim() ||
    attachments.length > 0 ||
    selectedSkills.length > 0 ||
    restoredSkillIDs.length > 0 ||
    selectedAgentIDs.length > 0;
  return {
    attachments,
    delivery,
    didLoadDraft,
    draft,
    draftLoaded,
    draftRef,
    hasPrompt,
    restoredSkillIDs,
    selectedAgentIDs,
    selectedSkills,
    setAttachments,
    setDelivery,
    setDraft,
    setRestoredSkillIDs,
    setSelectedAgentIDs,
    setSelectedSkills,
  };
};

export type ComposerDraft = ReturnType<typeof useComposerDraft>;
