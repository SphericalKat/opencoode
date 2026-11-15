import type { SessionInboxInfo, SessionMessageInfo } from "@opencode/client";
import React from "react";

import { confirmAction } from "../../components/dialog";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import type { OpenCodeClient, Capabilities } from "./session-sync";
import type { Alive, SetPanel } from "./types";
import { useChatMutation } from "./use-chat-mutation";
import type { ChatMutationContext } from "./use-chat-mutation";
import type { ComposerDraft } from "./use-composer-draft";
import type { SessionState } from "./use-session-state";

interface UseDraftEditingOptions {
  alive: Alive;
  capabilities: Capabilities;
  context: ChatMutationContext;
  opencodeClient: OpenCodeClient;
  sessionID: string;
  setPanel: SetPanel;
  setSelectedMessageID: React.Dispatch<React.SetStateAction<string | null>>;
  sync: SessionState;
  composer: ComposerDraft;
}

export const useDraftEditing = ({
  alive,
  capabilities,
  context,
  opencodeClient,
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
  const scope = useServerScope();
  const inboxEdit = useChatMutation(context, {
    invalidate: () => [queryKeys.session.inbox(scope, sessionID)],
    mutationFn: async (item: SessionInboxInfo) => {
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
          "This opens the pending input in the composer and replaces the current draft.",
          { confirmLabel: "Replace draft", destructive: false }
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
    },
  });
  const editInbox = (item: SessionInboxInfo) => inboxEdit.run(item);

  const fillComposer = (
    message: Extract<SessionMessageInfo, { type: "user" }>
  ) => {
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

  const messageEdit = useChatMutation(context, {
    invalidate: () => [
      queryKeys.session.detail(scope, sessionID),
      queryKeys.session.messages(scope, sessionID),
    ],
    mutationFn: async (
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
          "This opens the earlier message in the composer and replaces the current draft.",
          { confirmLabel: "Replace draft", destructive: false }
        ))
      ) {
        return;
      }
      // The next prompt commits the staged revert on the server, which
      // replaces this message and removes everything after it.
      await opencodeClient?.session.revert.stage({
        files: true,
        messageID: message.id,
        sessionID,
      });
      if (!alive.current) {
        return;
      }
      fillComposer(message);
    },
  });
  const editMessage = (
    message: Extract<SessionMessageInfo, { type: "user" }>
  ) => messageEdit.run(message);

  return { editInbox, editMessage };
};
