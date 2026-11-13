import type { SessionMessageInfo } from "@opencode/client";
import { View } from "react-native";

import { Button, BodyText } from "../../components/ui";
import { usePublishSelectionBar } from "../../lib/selection-bar";
import { ChatIconButton } from "./controls";
import type { ChatController } from "./use-chat-controller";

interface RenderSelectionHeaderProps extends Pick<
  ChatController,
  | "active"
  | "backend"
  | "canCopySelected"
  | "capabilities"
  | "client"
  | "copySelected"
  | "draftLoaded"
  | "editMessage"
  | "onOpenSession"
  | "pending"
  | "run"
  | "sessionID"
  | "setPanel"
  | "setSelectedMessageID"
  | "styles"
> {
  actionMessage: SessionMessageInfo;
}

export const renderSelectionHeader = ({
  actionMessage,
  active,
  backend,
  canCopySelected,
  capabilities,
  client,
  copySelected,
  draftLoaded,
  editMessage,
  onOpenSession,
  pending,
  run,
  sessionID,
  setPanel,
  setSelectedMessageID,
  styles,
}: RenderSelectionHeaderProps) => (
  <>
    <View style={styles.headerLeading}>
      <ChatIconButton
        name="close"
        label="Close message selection"
        onPress={() => setSelectedMessageID(null)}
      />
    </View>
    <BodyText accessibilityRole="header" style={styles.selectionCount}>
      1 selected
    </BodyText>
    <Button
      title="Copy"
      compact
      variant="ghost"
      disabled={!canCopySelected}
      onPress={copySelected}
    />
    {actionMessage.type === "user" && (
      <Button
        title="Edit"
        compact
        variant="ghost"
        disabled={!draftLoaded || pending || active}
        onPress={() => {
          void editMessage(actionMessage);
        }}
      />
    )}
    {actionMessage.type !== "user" &&
      capabilities.forkMessage &&
      (!backend.canForkMessage || backend.canForkMessage(actionMessage)) && (
        <Button
          title="Fork"
          compact
          variant="ghost"
          disabled={pending}
          onPress={() => {
            void run(async () => {
              const next = await client.session.fork({
                before: actionMessage.id,
                sessionID,
              });
              onOpenSession(next.id);
            });
          }}
        />
      )}
    <View style={styles.headerTrailing}>
      <ChatIconButton
        name="more"
        label="Selected message actions"
        onPress={() => setPanel("message")}
      />
    </View>
  </>
);

type ChatHeaderProps = Pick<
  ChatController,
  | "actionMessage"
  | "active"
  | "backend"
  | "canCopySelected"
  | "capabilities"
  | "client"
  | "copySelected"
  | "draftLoaded"
  | "editMessage"
  | "onOpenSession"
  | "pending"
  | "run"
  | "sessionID"
  | "setPanel"
  | "setSelectedMessageID"
  | "styles"
> & { placement: "shell" | "inline" };

export const ChatHeader = ({
  placement,
  actionMessage,
  active,
  backend,
  canCopySelected,
  capabilities,
  client,
  copySelected,
  draftLoaded,
  editMessage,
  onOpenSession,
  pending,
  run,
  sessionID,
  setPanel,
  setSelectedMessageID,
  styles,
}: ChatHeaderProps) => {
  if (!actionMessage) {
    return null;
  }
  return (
    <View
      style={
        placement === "shell"
          ? [styles.header, styles.shellSelectionHeader]
          : [styles.header, styles.selectionHeader]
      }
    >
      {renderSelectionHeader({
        actionMessage,
        active,
        backend,
        canCopySelected,
        capabilities,
        client,
        copySelected,
        draftLoaded,
        editMessage,
        onOpenSession,
        pending,
        run,
        sessionID,
        setPanel,
        setSelectedMessageID,
        styles,
      })}
    </View>
  );
};

// Inside the app shell the bar sits over the tab strip, so the transcript
// stays still. Without a shell slot it renders inline above the transcript.
export const SelectionBar = ({
  visible,
  ...props
}: Omit<ChatHeaderProps, "placement"> & { visible: boolean }) => {
  const inShell = usePublishSelectionBar(
    visible && props.actionMessage ? (
      <ChatHeader placement="shell" {...props} />
    ) : null
  );
  return inShell ? null : <ChatHeader placement="inline" {...props} />;
};
