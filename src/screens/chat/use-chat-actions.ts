import type { SessionInboxInfo } from "@opencode/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ChatBackend } from "../../lib/chat-backend";
import { resetMessages } from "../../lib/queries/messages";
import { removeDeletedSessionQueries } from "../../lib/queries/sessions";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import { useChatMutation, useChatPending } from "./use-chat-mutation";
import type { ChatMutationContext } from "./use-chat-mutation";

interface UseChatActionsOptions {
  backend: ChatBackend;
  context: ChatMutationContext;
  onOpenSession: (id: string) => void;
}

const requireOpenCode = (client: ChatBackend["opencodeClient"]) => {
  if (!client) {
    throw new Error("This connection does not support that action");
  }
  return client;
};

// The session writes that the chat sheets and menus trigger.
export const useChatActions = ({
  backend,
  context,
  onOpenSession,
}: UseChatActionsOptions) => {
  const scope = useServerScope();
  const { sessionID } = context;
  const { core, opencodeClient } = backend;
  const detail = () => queryKeys.session.detail(scope, sessionID);
  const messages = () => queryKeys.session.messages(scope, sessionID);
  const sessions = () => queryKeys.sessions.all(scope);
  const running = () => [
    queryKeys.sessions.active(scope),
    queryKeys.session.status(scope, sessionID),
  ];
  const inbox = () => [queryKeys.session.inbox(scope, sessionID)];
  const pending = useChatPending(context);
  const queryClient = useQueryClient();
  // Delete runs after the undo window, when the chat is already closed, so it
  // is a plain mutation that does not wait for the chat to stay mounted.
  const removeSession = useMutation({
    mutationFn: () =>
      requireOpenCode(opencodeClient).session.remove({ sessionID }),
    onSuccess: () => {
      removeDeletedSessionQueries(queryClient, scope, sessionID);
      return queryClient.invalidateQueries({ queryKey: sessions() });
    },
  });

  const rename = useChatMutation(context, {
    closePanel: true,
    invalidate: () => [detail(), sessions()],
    mutationFn: (title: string) => core.session.update({ sessionID, title }),
  });
  const archive = useChatMutation(context, {
    closePanel: true,
    invalidate: () => [detail(), sessions()],
    mutationFn: (archived: boolean) =>
      requireOpenCode(opencodeClient).session.update({ archived, sessionID }),
  });
  const move = useChatMutation(context, {
    closePanel: true,
    invalidate: () => [
      detail(),
      sessions(),
      queryKeys.session.forms(scope, sessionID),
      queryKeys.session.permissions(scope, sessionID),
    ],
    mutationFn: (input: { delivery: "queue" | "steer"; directory: string }) =>
      requireOpenCode(opencodeClient).session.move({
        ...input,
        sessionID,
      }),
  });
  const fork = useChatMutation(context, {
    invalidate: () => [sessions()],
    mutationFn: async (before: string | undefined) => {
      const next = await core.session.fork({ before, sessionID });
      onOpenSession(next.id);
    },
  });
  const forkSession = useChatMutation(context, {
    closePanel: true,
    invalidate: () => [sessions()],
    mutationFn: async () => {
      const next = await core.session.fork({ sessionID });
      onOpenSession(next.id);
    },
  });
  const compact = useChatMutation(context, {
    closePanel: true,
    invalidate: running,
    mutationFn: () => core.session.compact({ delivery: "queue", sessionID }),
  });
  const background = useChatMutation(context, {
    closePanel: true,
    invalidate: running,
    mutationFn: () =>
      requireOpenCode(opencodeClient).session.background({ sessionID }),
  });
  const interrupt = useChatMutation(context, {
    invalidate: running,
    mutationFn: () => core.session.interrupt({ sessionID }),
  });
  const switchAgent = useChatMutation(context, {
    invalidate: () => [detail()],
    mutationFn: (agent: string) =>
      requireOpenCode(opencodeClient).session.switchAgent({ agent, sessionID }),
  });
  const updateInbox = useChatMutation(context, {
    invalidate: inbox,
    mutationFn: (input: {
      delivery: SessionInboxInfo["delivery"];
      inboxID: string;
    }) =>
      requireOpenCode(opencodeClient).session.inbox.update({
        ...input,
        sessionID,
      }),
  });
  const cancelInbox = useChatMutation(context, {
    invalidate: inbox,
    mutationFn: (inboxID: string) =>
      requireOpenCode(opencodeClient).session.inbox.cancel({
        inboxID,
        sessionID,
      }),
  });
  const stageRevert = useChatMutation(context, {
    invalidate: () => [detail(), messages()],
    mutationFn: (messageID: string) =>
      requireOpenCode(opencodeClient).session.revert.stage({
        files: true,
        messageID,
        sessionID,
      }),
  });
  const clearRevert = useChatMutation(context, {
    invalidate: () => [detail(), messages()],
    mutationFn: () =>
      requireOpenCode(opencodeClient).session.revert.clear({ sessionID }),
  });
  const commitRevert = useChatMutation(context, {
    invalidate: () => [detail()],
    mutationFn: () =>
      requireOpenCode(opencodeClient).session.revert.commit({ sessionID }),
    onWritten: () => {
      void resetMessages(queryClient, scope, sessionID);
    },
  });

  return {
    archive: archive.run,
    background: background.run,
    cancelInbox: cancelInbox.run,
    clearRevert: clearRevert.run,
    commitRevert: commitRevert.run,
    compact: compact.run,
    fork: fork.run,
    forkSession: forkSession.run,
    interrupt: interrupt.run,
    move: move.run,
    pending,
    remove: removeSession.mutateAsync,
    rename: rename.run,
    stageRevert: stageRevert.run,
    switchAgent: switchAgent.run,
    updateInbox: updateInbox.run,
  };
};

export type ChatActions = ReturnType<typeof useChatActions>;
