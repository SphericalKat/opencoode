import type { SessionInfo, SessionMessageInfo } from "@opencode/client";
import * as Clipboard from "expo-clipboard";

import { Button, confirmAction, ErrorNotice, Sheet } from "../../components/ui";
import { MessageRow } from "./message-rows";
import type { ChatController } from "./use-chat-controller";

export const MessageSheet = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const {
    actionMessage,
    active,
    alive,
    backend,
    capabilities,
    client,
    draftLoaded,
    editMessage,
    error,
    messages,
    onOpenSession,
    opencodeClient,
    panel,
    pending,
    queuedMessagePanelRef,
    run,
    selectedMessageID,
    sessionID,
    setBackgroundDirectory,
    setBackgroundShellID,
    setPanel,
    setTextSelectionMessage,
    showError,
  } = chat;
  return (
    <Sheet
      visible={panel === "message"}
      title="Message"
      fitContent
      onClose={() => {
        queuedMessagePanelRef.current = null;
        setPanel(null);
      }}
      onDismiss={() => {
        const target = queuedMessagePanelRef.current;
        queuedMessagePanelRef.current = null;
        if (target && alive.current && panel === null && selectedMessageID) {
          setPanel(target);
        }
      }}
    >
      <ErrorNotice error={error} />
      {actionMessage && (
        <>
          <Button
            title="Select text"
            onPress={() => {
              setTextSelectionMessage(actionMessage);
              queuedMessagePanelRef.current = "selectText";
              setPanel(null);
            }}
          />
          {"text" in actionMessage && (
            <Button
              title="Copy message"
              onPress={() => {
                void Clipboard.setStringAsync(actionMessage.text)
                  .then(() => setPanel(null))
                  .catch(showError);
              }}
            />
          )}
          {actionMessage.type === "assistant" && (
            <Button
              title="Copy response"
              onPress={() => {
                void Clipboard.setStringAsync(
                  actionMessage.content
                    .filter((part) => part.type === "text")
                    .map((part) => part.text)
                    .join("\n\n")
                )
                  .then(() => setPanel(null))
                  .catch(showError);
              }}
            />
          )}
          {actionMessage.type === "user" && (
            <Button
              title="Edit & resend"
              disabled={!draftLoaded}
              onPress={() => {
                void editMessage(actionMessage);
              }}
            />
          )}
          {opencodeClient &&
            capabilities.background &&
            actionMessage.type === "shell" && (
              <Button
                title="Full command output"
                onPress={() => {
                  const index = messages.findIndex(
                    (message) => message.id === actionMessage.id
                  );
                  const nextMove = messages
                    .slice(index + 1)
                    .find(
                      (
                        message
                      ): message is Extract<
                        SessionMessageInfo,
                        { type: "location-switched" }
                      > => message.type === "location-switched"
                    );
                  setBackgroundShellID(actionMessage.shellID);
                  setBackgroundDirectory(
                    nextMove?.previous?.location.directory ??
                      session.location.directory
                  );
                  queuedMessagePanelRef.current = "background";
                  setPanel(null);
                }}
              />
            )}
          {capabilities.forkMessage &&
            (!backend.canForkMessage ||
              backend.canForkMessage(actionMessage)) && (
              <Button
                title="Fork before this message"
                disabled={pending}
                onPress={() => {
                  void run(async () => {
                    const next = await client.session.fork({
                      before: actionMessage.id,
                      sessionID,
                    });
                    onOpenSession(next.id);
                  }, true);
                }}
              />
            )}
          {opencodeClient && actionMessage.type === "user" && (
            <Button
              title="Undo from this message"
              disabled={pending || active}
              onPress={() => {
                void run(async () => {
                  if (
                    await confirmAction(
                      "Undo from this message?",
                      "The server will stage a revert of later messages and file changes. You can restore the staged changes."
                    )
                  ) {
                    await opencodeClient.session.revert.stage({
                      files: true,
                      messageID: actionMessage.id,
                      sessionID,
                    });
                  }
                }, true);
              }}
            />
          )}
        </>
      )}
    </Sheet>
  );
};

export const SelectTextSheet = ({
  chat,
  session,
}: {
  chat: ChatController;
  session: SessionInfo;
}) => {
  const {
    opencodeClient,
    panel,
    setPanel,
    setTextSelectionMessage,
    textSelectionMessage,
  } = chat;
  return (
    <Sheet
      visible={panel === "selectText"}
      title="Select text"
      onClose={() => {
        setPanel(null);
        setTextSelectionMessage(null);
      }}
    >
      {textSelectionMessage && (
        <MessageRow
          message={textSelectionMessage}
          client={opencodeClient}
          directory={session.location.directory}
        />
      )}
    </Sheet>
  );
};
