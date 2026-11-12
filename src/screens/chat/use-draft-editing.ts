import type { SessionInboxInfo, SessionMessageInfo } from "@opencode/client";
import React from "react";

import { confirmAction } from "../../components/ui";
import type { OpenCodeClient, Capabilities } from "./session-sync";
import type { Alive, SetPanel } from "./types";
import type { ComposerDraft } from "./use-composer-draft";
import type { RunAction } from "./use-run-action";
import type { SessionState } from "./use-session-state";

interface UseDraftEditingOptions {
  alive: Alive;
  capabilities: Capabilities;
  opencodeClient: OpenCodeClient;
  run: RunAction;
  sessionID: string;
  setPanel: SetPanel;
  setSelectedMessageID: React.Dispatch<React.SetStateAction<string | null>>;
  sync: SessionState;
  composer: ComposerDraft;
}

export const useDraftEditing = ({
  alive,
  capabilities,
  opencodeClient,
  run,
  sessionID,
  setPanel,
  setSelectedMessageID,
  sync,
  composer,
}: UseDraftEditingOptions) => {
  const { skills } = sync;
  const {
    draft,
    setDraft,
    attachments,
    setAttachments,
    selectedSkills,
    setSelectedSkills,
    selectedAgentIDs,
    setSelectedAgentIDs,
    restoredSkillIDs,
    setRestoredSkillIDs,
    draftLoaded,
    setDelivery,
  } = composer;
  const editInbox = (item: SessionInboxInfo) =>
    run(async () => {
      if (!opencodeClient || !capabilities.inbox || !draftLoaded) {
        return;
      }
      if (item.type !== "user" && item.type !== "synthetic") {
        return;
      }
      if (
        (draft ||
          attachments.length ||
          selectedSkills.length ||
          restoredSkillIDs.length ||
          selectedAgentIDs.length) &&
        !(await confirmAction(
          "Replace the message draft?",
          "This opens the pending input in the composer and replaces the current draft."
        ))
      ) {
        return;
      }
      await opencodeClient.session.inbox.cancel({
        inboxID: item.id,
        sessionID,
      });
      if (!alive.current) {
        return;
      }
      setDraft(item.payload.text);
      setDelivery(item.delivery);
      if (item.type === "user") {
        setAttachments(
          (item.payload.files ?? []).map((file) => ({
            name: file.name,
            uri:
              file.source.type === "uri"
                ? file.source.uri
                : `data:${file.mime};base64,${file.data}`,
          }))
        );
        setSelectedSkills(
          skills.filter((skill) =>
            item.payload.skills?.some((selected) => selected.id === skill.id)
          )
        );
        setRestoredSkillIDs(
          (item.payload.skills ?? [])
            .filter(
              (selected) => !skills.some((skill) => skill.id === selected.id)
            )
            .map((skill) => skill.id)
        );
        setSelectedAgentIDs(
          (item.payload.agents ?? []).map((agent) => agent.name)
        );
      } else {
        setAttachments([]);
        setSelectedSkills([]);
        setRestoredSkillIDs([]);
        setSelectedAgentIDs([]);
      }
    });

  const editMessage = async (
    message: Extract<SessionMessageInfo, { type: "user" }>
  ) => {
    if (!draftLoaded) {
      return;
    }
    if (
      (draft ||
        attachments.length ||
        selectedSkills.length ||
        restoredSkillIDs.length ||
        selectedAgentIDs.length) &&
      !(await confirmAction(
        "Replace the message draft?",
        "This opens the earlier message in the composer and replaces the current draft."
      ))
    ) {
      return;
    }
    if (!alive.current) {
      return;
    }
    setDraft(message.text);
    setAttachments(
      (message.files ?? []).map((file) => ({
        name: file.name,
        uri:
          file.source.type === "uri"
            ? file.source.uri
            : `data:${file.mime};base64,${file.data}`,
      }))
    );
    setSelectedSkills(
      skills.filter((skill) =>
        message.skills?.some((selected) => selected.id === skill.id)
      )
    );
    setRestoredSkillIDs(
      (message.skills ?? [])
        .filter((selected) => !skills.some((skill) => skill.id === selected.id))
        .map((skill) => skill.id)
    );
    setSelectedAgentIDs((message.agents ?? []).map((agent) => agent.name));
    setSelectedMessageID(null);
    setPanel(null);
  };

  return { editInbox, editMessage };
};
