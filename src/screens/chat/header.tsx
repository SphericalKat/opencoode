import type { SessionMessageInfo } from "@opencode/client";
import { View } from "react-native";

import { IconButton } from "../../components/icon-button";
import { Button, BodyText } from "../../components/ui";
import { usePublishSelectionBar } from "../../lib/selection-bar";
import { messageMenuEntries, messageMenuInput } from "./message-menu-entries";
import { messageText } from "./message-rows";
import type { ChatController } from "./use-chat-controller";

type SelectionBarFields = Pick<
  ChatController,
  | "client"
  | "copySelected"
  | "editMessage"
  | "menuContext"
  | "onOpenSession"
  | "actions"
  | "sessionID"
  | "setSelectedMessageID"
  | "styles"
>;

interface RenderSelectionHeaderProps extends SelectionBarFields {
  actionMessage: SessionMessageInfo;
}

export const renderSelectionHeader = ({
  actionMessage,
  copySelected,
  editMessage,
  menuContext,
  actions,
  setSelectedMessageID,
  styles,
}: RenderSelectionHeaderProps) => {
  const entries = messageMenuEntries(
    messageMenuInput(actionMessage, messageText(actionMessage), menuContext)
  );
  return (
    <>
      <View style={styles.headerLeading}>
        <IconButton
          icon="close"
          size={32}
          accessibilityLabel="Exit selection"
          onPress={() => setSelectedMessageID(null)}
        />
      </View>
      <BodyText accessibilityRole="header" style={styles.selectionCount}>
        1 selected
      </BodyText>
      {entries.includes("copy") && (
        <Button
          title="Copy"
          size="compact"
          variant="ghost"
          onPress={copySelected}
        />
      )}
      {entries.includes("edit") && actionMessage.type === "user" && (
        <Button
          title="Edit"
          size="compact"
          variant="ghost"
          onPress={() => {
            void editMessage(actionMessage);
          }}
        />
      )}
      {entries.includes("fork") && (
        <Button
          title="Fork"
          size="compact"
          variant="ghost"
          onPress={() => {
            void actions.fork(actionMessage.id);
          }}
        />
      )}
    </>
  );
};

type ChatHeaderProps = SelectionBarFields &
  Pick<ChatController, "actionMessage"> & { placement: "shell" | "inline" };

export const ChatHeader = ({
  placement,
  actionMessage,
  ...fields
}: ChatHeaderProps) => {
  if (!actionMessage) {
    return null;
  }
  return (
    <View
      style={
        placement === "shell"
          ? [fields.styles.header, fields.styles.shellSelectionHeader]
          : [fields.styles.header, fields.styles.selectionHeader]
      }
    >
      {renderSelectionHeader({ actionMessage, ...fields })}
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
