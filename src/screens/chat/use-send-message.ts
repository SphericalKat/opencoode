import React, { useEffect, useState } from "react";

import { parseComposer } from "../../lib/chat";
import { errorMessage } from "../../lib/client";
import { saveDraft } from "../../lib/drafts";
import type { CoreClient, OpenCodeClient, Capabilities } from "./session-sync";
import type { Alive, SetPanel } from "./types";
import type { ComposerDraft } from "./use-composer-draft";
import type { RunAction } from "./use-run-action";
import type { SessionState } from "./use-session-state";
import { withCleanup } from "./util";

interface UseSendMessageOptions {
  alive: Alive;
  capabilities: Capabilities;
  client: CoreClient;
  draftKey: string;
  jumpToLatest: () => void;
  opencodeClient: OpenCodeClient;
  run: RunAction;
  sessionID: string;
  setPanel: SetPanel;
  setSideQuestion: React.Dispatch<React.SetStateAction<string | undefined>>;
  showError: (reason: unknown) => void;
  submitting: React.RefObject<boolean>;
  sync: SessionState;
  composer: ComposerDraft;
}

export const useSendMessage = ({
  alive,
  capabilities,
  client,
  draftKey,
  jumpToLatest,
  opencodeClient,
  run,
  sessionID,
  setPanel,
  setSideQuestion,
  showError,
  submitting,
  sync,
  composer,
}: UseSendMessageOptions) => {
  const { commands, active } = sync;
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
    delivery,
    draftRef,
    hasPrompt,
  } = composer;
  const [sending, setSending] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopReady, setStopReady] = useState(false);
  const send = async () => {
    if (!draftLoaded) {
      return;
    }
    if (
      !draft.trim() &&
      !attachments.length &&
      !selectedSkills.length &&
      !restoredSkillIDs.length &&
      !selectedAgentIDs.length
    ) {
      return;
    }
    const btw = /^\/btw(?:\s+(?<text>[\s\S]*))?$/u.exec(draft.trim());
    if (btw && capabilities.sideQuestion && opencodeClient) {
      if (
        attachments.length ||
        selectedSkills.length ||
        restoredSkillIDs.length ||
        selectedAgentIDs.length
      ) {
        showError(
          new Error(
            "Side questions use the current session context. Remove unsent files, agents, or skills first."
          )
        );
        return;
      }
      setSideQuestion(btw[1] || "");
      setPanel("btw");
      return;
    }
    const sentText = draft;
    const sentAttachments = attachments;
    const sentSkills = selectedSkills;
    const sentSkillIDs = [
      ...new Set([...sentSkills.map((skill) => skill.id), ...restoredSkillIDs]),
    ];
    const sentAgentIDs = selectedAgentIDs;
    if (submitting.current) {
      return;
    }
    setSending(true);
    await withCleanup(
      () =>
        run(async () => {
          const submission =
            capabilities.shell || capabilities.commands
              ? parseComposer(
                  sentText,
                  commands.map((command) => command.name)
                )
              : { text: sentText.trim(), type: "prompt" as const };
          if (submission.type === "shell") {
            if (
              sentAttachments.length ||
              sentSkillIDs.length ||
              sentAgentIDs.length
            ) {
              throw new Error(
                "Shell commands cannot include attachments, agents, or skills"
              );
            }
            if (!opencodeClient || !capabilities.shell) {
              throw new Error(
                "Shell commands are unavailable for this connection"
              );
            }
            await opencodeClient.session.shell({
              command: submission.command,
              sessionID,
            });
          } else {
            const common = {
              agents: sentAgentIDs.map((name) => ({ name })),
              delivery,
              files: sentAttachments,
              sessionID,
              skills: sentSkillIDs.map((id) => ({ id })),
            };
            if (submission.type === "command") {
              if (!opencodeClient || !capabilities.commands) {
                throw new Error("Commands are unavailable for this connection");
              }
              await opencodeClient.session.command({
                ...common,
                name: submission.name,
                text: submission.text,
              });
            } else {
              await client.session.prompt({ ...common, text: submission.text });
            }
          }
          if (alive.current) {
            setDraft((current) => (current === sentText ? "" : current));
            setAttachments((current) =>
              current.filter((file) => !sentAttachments.includes(file))
            );
            setSelectedSkills((current) =>
              current.filter((skill) => !sentSkills.includes(skill))
            );
            setRestoredSkillIDs((current) =>
              current.filter((id) => !sentSkillIDs.includes(id))
            );
            setSelectedAgentIDs((current) =>
              current.filter((id) => !sentAgentIDs.includes(id))
            );
            jumpToLatest();
            const latest = draftRef.current;
            await saveDraft(draftKey, {
              ...latest,
              agentIDs: latest.agentIDs.filter(
                (id) => !sentAgentIDs.includes(id)
              ),
              files: latest.files.filter(
                (file) => !sentAttachments.includes(file)
              ),
              skillIDs: latest.skillIDs.filter(
                (id) => !sentSkillIDs.includes(id)
              ),
              text: latest.text === sentText ? "" : latest.text,
            }).catch((error_) =>
              showError(
                new Error(
                  `Message sent. Draft save failed: ${errorMessage(error_)}`
                )
              )
            );
          }
        }),
      () => {
        if (alive.current) {
          setSending(false);
        }
      }
    );
  };

  const interrupt = () =>
    run(async () => {
      setStopping(true);
      try {
        await client.session.interrupt({ sessionID });
      } catch (error_) {
        if (alive.current) {
          setStopping(false);
        }
        throw error_;
      }
    });
  if (!active && stopping) {
    setStopping(false);
  }

  useEffect(() => {
    const timer =
      active && !hasPrompt
        ? setTimeout(() => setStopReady(true), 400)
        : undefined;
    return () => {
      clearTimeout(timer);
      setStopReady(false);
    };
  }, [active, hasPrompt]);
  return { interrupt, send, sending, stopReady, stopping };
};
