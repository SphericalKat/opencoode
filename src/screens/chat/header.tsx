import type { SessionInfo, SessionMessageInfo } from "@opencode/client";
import { View } from "react-native";

import { MotionContent, WorkingIndicator } from "../../components/motion";
import { Button, BodyText } from "../../components/ui";
import { ChatIconButton } from "./controls";
import type { ChatController } from "./use-chat-controller";

interface RenderSelectionHeaderProps extends Pick<
  ChatController,
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
        disabled={!draftLoaded || pending}
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

interface RenderSessionHeaderProps extends Pick<
  ChatController,
  | "activity"
  | "colors"
  | "foreground"
  | "onOpenNavigation"
  | "projectLabel"
  | "setPanel"
  | "showHeaderActivity"
  | "styles"
  | "visible"
> {
  session: SessionInfo;
}

export const renderSessionHeader = ({
  activity,
  colors,
  foreground,
  onOpenNavigation,
  projectLabel,
  session,
  setPanel,
  showHeaderActivity,
  styles,
  visible,
}: RenderSessionHeaderProps) => (
  <>
    {onOpenNavigation && (
      <View style={styles.headerLeading}>
        <ChatIconButton
          name="menu"
          label="Open navigation"
          onPress={onOpenNavigation}
        />
      </View>
    )}
    <View
      style={[
        styles.headerTitle,
        onOpenNavigation && styles.headerTitleWithNavigation,
      ]}
    >
      <BodyText
        numberOfLines={1}
        accessibilityLabel={session.title || "New session"}
        style={styles.sessionTitle}
      >
        {session.title || "New session"}
      </BodyText>
      <View style={styles.headerSubtitle}>
        {showHeaderActivity && (
          <WorkingIndicator
            active={visible && foreground}
            color={colors.muted}
            size={12}
          />
        )}
        <BodyText numberOfLines={1} muted style={styles.projectLabel}>
          {showHeaderActivity
            ? activity.label
            : projectLabel ||
              session.location.directory.split("/").findLast(Boolean) ||
              session.location.directory}
        </BodyText>
      </View>
    </View>
    <View style={styles.headerTrailing}>
      <ChatIconButton
        name="more"
        label="Session actions"
        onPress={() => setPanel("actions")}
      />
    </View>
  </>
);

interface ChatHeaderProps extends Pick<
  ChatController,
  | "actionMessage"
  | "activity"
  | "backend"
  | "betaLayout"
  | "canCopySelected"
  | "capabilities"
  | "client"
  | "colors"
  | "copySelected"
  | "draftLoaded"
  | "editMessage"
  | "foreground"
  | "onOpenNavigation"
  | "onOpenSession"
  | "pending"
  | "projectLabel"
  | "run"
  | "sessionID"
  | "setPanel"
  | "setSelectedMessageID"
  | "showHeaderActivity"
  | "styles"
  | "visible"
> {
  session: SessionInfo;
}

export const ChatHeader = ({
  actionMessage,
  activity,
  backend,
  betaLayout,
  canCopySelected,
  capabilities,
  client,
  colors,
  copySelected,
  draftLoaded,
  editMessage,
  foreground,
  onOpenNavigation,
  onOpenSession,
  pending,
  projectLabel,
  run,
  session,
  sessionID,
  setPanel,
  setSelectedMessageID,
  showHeaderActivity,
  styles,
  visible,
}: ChatHeaderProps) => {
  if (betaLayout && !actionMessage) {
    return null;
  }
  return (
    <MotionContent
      variant="context"
      transitionKey={!!actionMessage}
      style={[styles.header, !!actionMessage && styles.selectionHeader]}
    >
      {actionMessage
        ? renderSelectionHeader({
            actionMessage,
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
          })
        : renderSessionHeader({
            activity,
            colors,
            foreground,
            onOpenNavigation,
            projectLabel,
            session,
            setPanel,
            showHeaderActivity,
            styles,
            visible,
          })}
    </MotionContent>
  );
};
