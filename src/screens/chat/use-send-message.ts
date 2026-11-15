import React, { useEffect, useState } from "react";

import { parseComposer } from "../../lib/chat";
import { errorMessage } from "../../lib/client";
import { saveDraft } from "../../lib/drafts";
import { playHaptic } from "../../lib/haptics";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import type {
  Alive,
  Attachment,
  Capabilities,
  CoreClient,
  OpenCodeClient,
  SetPanel,
  SessionState,
} from "./types";
import type { ChatActions } from "./use-chat-actions";
import { useChatMutation } from "./use-chat-mutation";
import type { ChatMutationContext } from "./use-chat-mutation";
import type { ComposerDraft } from "./use-composer-draft";

interface SentMessage {
  agentIDs: string[];
  attachments: Attachment[];
  delivery: "steer" | "queue";
  skillIDs: string[];
  skills: SessionState["skills"];
  text: string;
}

type SessionCommandInput = Parameters<
  NonNullable<OpenCodeClient>["session"]["command"]
>[0];
type SessionPromptInput = Parameters<CoreClient["session"]["prompt"]>[0];

const requireOpenCode = (
  client: OpenCodeClient,
  supported: boolean,
  message: string
) => {
  if (!client || !supported) {
    throw new Error(message);
  }
  return client;
};

interface UseSendMessageOptions {
  actions: ChatActions;
  alive: Alive;
  capabilities: Capabilities;
  client: CoreClient;
  commitModel: () => Promise<boolean>;
  composer: ComposerDraft;
  context: ChatMutationContext;
  draftKey: string;
  jumpToLatest: () => void;
  opencodeClient: OpenCodeClient;
  sessionID: string;
  setPanel: SetPanel;
  setSideQuestion: React.Dispatch<React.SetStateAction<string | undefined>>;
  showError: (reason: unknown) => void;
  sync: SessionState;
}

export const useSendMessage = ({
  actions,
  alive,
  capabilities,
  client,
  commitModel,
  composer,
  context,
  draftKey,
  jumpToLatest,
  opencodeClient,
  sessionID,
  setPanel,
  setSideQuestion,
  showError,
  sync,
}: UseSendMessageOptions) => {
  const scope = useServerScope();
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
  const [stopping, setStopping] = useState(false);
  const [stopReady, setStopReady] = useState(false);
  const inboxKeys = () => [queryKeys.session.inbox(scope, sessionID)];
  const shell = useChatMutation(context, {
    invalidate: inboxKeys,
    mutationFn: (command: string) =>
      requireOpenCode(
        opencodeClient,
        capabilities.shell,
        "Shell commands are unavailable for this connection"
      ).session.shell({
        command,
        sessionID,
      }),
  });
  const command = useChatMutation(context, {
    invalidate: inboxKeys,
    mutationFn: (input: SessionCommandInput) =>
      requireOpenCode(
        opencodeClient,
        capabilities.commands,
        "Commands are unavailable for this connection"
      ).session.command(input),
  });
  const prompt = useChatMutation(context, {
    invalidate: inboxKeys,
    mutationFn: (input: SessionPromptInput) => client.session.prompt(input),
  });
  const clearSent = async (sent: SentMessage) => {
    if (!alive.current) {
      return;
    }
    setDraft((current) => (current === sent.text ? "" : current));
    setAttachments((current) =>
      current.filter((file) => !sent.attachments.includes(file))
    );
    setSelectedSkills((current) =>
      current.filter((skill) => !sent.skills.includes(skill))
    );
    setRestoredSkillIDs((current) =>
      current.filter((id) => !sent.skillIDs.includes(id))
    );
    setSelectedAgentIDs((current) =>
      current.filter((id) => !sent.agentIDs.includes(id))
    );
    jumpToLatest();
    const latest = draftRef.current;
    await saveDraft(draftKey, {
      ...latest,
      agentIDs: latest.agentIDs.filter((id) => !sent.agentIDs.includes(id)),
      files: latest.files.filter((file) => !sent.attachments.includes(file)),
      skillIDs: latest.skillIDs.filter((id) => !sent.skillIDs.includes(id)),
      text: latest.text === sent.text ? "" : latest.text,
    }).catch((error_) =>
      showError(
        new Error(`Message sent. Draft save failed: ${errorMessage(error_)}`)
      )
    );
  };
  const [committing, setCommitting] = useState(false);
  const submit = async (sent: SentMessage) => {
    context.setError(null);
    const submission =
      capabilities.shell || capabilities.commands
        ? parseComposer(
            sent.text,
            commands.map((entry) => entry.name)
          )
        : { text: sent.text.trim(), type: "prompt" as const };
    if (submission.type === "shell") {
      if (
        sent.attachments.length ||
        sent.skillIDs.length ||
        sent.agentIDs.length
      ) {
        showError(
          new Error(
            "Shell commands cannot include attachments, agents, or skills"
          )
        );
        return;
      }
      if (!(await shell.run(submission.command))) {
        return;
      }
      await clearSent(sent);
      return;
    }
    const common = {
      agents: sent.agentIDs.map((name) => ({ name })),
      delivery: sent.delivery,
      files: sent.attachments,
      sessionID,
      skills: sent.skillIDs.map((id) => ({ id })),
    };
    if (submission.type === "command") {
      try {
        requireOpenCode(
          opencodeClient,
          capabilities.commands,
          "Commands are unavailable for this connection"
        );
      } catch (error_) {
        showError(error_);
        return;
      }
    }
    setCommitting(true);
    const committed = await commitModel().finally(() => {
      if (alive.current) {
        setCommitting(false);
      }
    });
    if (!committed) {
      return;
    }
    const sentOk =
      submission.type === "command"
        ? await command.run({
            ...common,
            name: submission.name,
            text: submission.text,
          })
        : await prompt.run({ ...common, text: submission.text });
    if (sentOk) {
      await clearSent(sent);
    }
  };
  const sending =
    committing || shell.isPending || command.isPending || prompt.isPending;
  const send = async (options?: { delivery?: "steer" | "queue" }) => {
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
    if (actions.pending) {
      return;
    }
    playHaptic("send");
    await submit({
      agentIDs: selectedAgentIDs,
      attachments,
      delivery: options?.delivery ?? delivery,
      skillIDs: [
        ...new Set([
          ...selectedSkills.map((skill) => skill.id),
          ...restoredSkillIDs,
        ]),
      ],
      skills: selectedSkills,
      text: draft,
    });
  };
  const interrupt = async () => {
    playHaptic("stop");
    setStopping(true);
    const stopped = await actions.interrupt();
    if (!stopped && alive.current) {
      setStopping(false);
    }
  };
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
