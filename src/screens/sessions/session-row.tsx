import type { SessionInfo } from "@opencode/client";
import { useRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { useContextMenu } from "../../components/anchored-menu";
import type { Rect } from "../../components/anchored-menu";
import { ProjectAvatar } from "../../components/project-avatar";
import { BodyText, usePressFeedback } from "../../components/ui";
import { sessionLabel } from "../../lib/session-title";
import { useTheme, useThemedStyles } from "../../lib/theme";
import type { ThemeColors } from "../../lib/theme";
import {
  isUnread,
  sessionDateGroup,
  sessionStatus,
  startsDateGroup,
} from "./format";
import type { SessionActions } from "./session-menu";
import { createStyles } from "./styles";

interface SessionMainProps {
  active: boolean;
  item: SessionInfo;
  actions: SessionActions;
  name: string;
  onCancelRename: () => void;
  onMenu: (item: SessionInfo, anchor: Rect) => void;
  onOpen: (id: string) => void;
  onRename: (item: SessionInfo, title: string) => void;
  renameSaving: boolean;
  renaming: boolean;
  showProjectName: boolean;
}

const createRenameStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    input: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "500",
      includeFontPadding: false,
      lineHeight: 16,
      padding: 0,
    },
  });

const RenameField = ({
  editable,
  onCancel,
  onSubmit,
  title,
}: {
  editable: boolean;
  onCancel: () => void;
  onSubmit: (title: string) => void;
  title: string;
}) => {
  const renameStyles = useThemedStyles(createRenameStyles);
  const submitted = useRef(false);
  return (
    <TextInput
      accessibilityLabel="Session title"
      autoCorrect={false}
      autoFocus
      defaultValue={title}
      editable={editable}
      onBlur={() => {
        if (!submitted.current) {
          onCancel();
        }
      }}
      onSubmitEditing={(event) => {
        submitted.current = true;
        onSubmit(event.nativeEvent.text);
      }}
      returnKeyType="done"
      selectTextOnFocus
      style={renameStyles.input}
      submitBehavior="blurAndSubmit"
      underlineColorAndroid="transparent"
    />
  );
};

const accessibilityLabelFor = ({
  active,
  item,
  name,
  unread,
}: {
  active: boolean;
  item: SessionInfo;
  name: string;
  unread: boolean;
}) => {
  const parts = [`${sessionLabel(item)}, ${name}`];
  if (unread) {
    parts.push("unread");
  }
  if (active) {
    parts.push("working");
  } else if (item.outcome === "failed") {
    parts.push("failed");
  } else if (item.outcome === "interrupted") {
    parts.push("stopped");
  }
  return parts.join(", ");
};

const SessionMain = ({
  active,
  item,
  name,
  actions,
  onCancelRename,
  onMenu,
  onOpen,
  onRename,
  renameSaving,
  renaming,
  showProjectName,
}: SessionMainProps) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const unread = !!isUnread(item);
  const failed = !active && sessionStatus(item, active) === "Failed";
  const contextMenu = useContextMenu({
    onOpen: (anchor) => onMenu(item, anchor),
  });
  const handleLongPress = contextMenu.onLongPress;
  const accessibilityActions = [
    { label: "Rename", name: "rename" },
    { label: "Export", name: "export" },
    ...(unread ? [{ label: "Mark as read", name: "markRead" }] : []),
    item.time.archived
      ? { label: "Restore", name: "restore" }
      : { label: "Archive", name: "archive" },
    { label: "Delete", name: "delete" },
  ];
  const runAction = (actionName: string) => {
    const handlers: Record<string, (session: SessionInfo) => void> = {
      archive: actions.archive,
      delete: actions.remove,
      export: actions.exportSession,
      markRead: actions.markRead,
      rename: actions.rename,
      restore: actions.archive,
    };
    handlers[actionName]?.(item);
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabelFor({ active, item, name, unread })}
      accessibilityHint={`Updated ${new Date(item.time.updated).toLocaleString()}`}
      android_ripple={android_ripple}
      onPress={() => {
        if (!renaming) {
          onOpen(item.id);
        }
      }}
      onLongPress={handleLongPress}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={(event) => runAction(event.nativeEvent.actionName)}
      style={({ pressed }) => [
        styles.sessionMain,
        styles.betaSessionMain,
        pressed && pressedStyle,
      ]}
    >
      <ProjectAvatar
        name={name}
        unread={unread && !active}
        ringColor={colors.bg}
      />
      <View style={[styles.sessionText, styles.betaSessionText]}>
        {renaming ? (
          <RenameField
            editable={!renameSaving}
            onCancel={onCancelRename}
            onSubmit={(title) => onRename(item, title)}
            title={sessionLabel(item)}
          />
        ) : (
          <BodyText
            numberOfLines={1}
            style={[styles.sessionTitle, styles.betaSessionTitle]}
          >
            {sessionLabel(item)}
          </BodyText>
        )}
        {showProjectName ? (
          <BodyText muted numberOfLines={1} style={styles.betaProjectName}>
            {name}
          </BodyText>
        ) : null}
      </View>
      {active || renameSaving ? (
        <ActivityIndicator
          size="small"
          color={colors.faint}
          style={styles.betaSessionActivity}
        />
      ) : null}
      {failed ? (
        <BodyText numberOfLines={1} style={styles.betaSessionFailed}>
          Failed
        </BodyText>
      ) : null}
    </Pressable>
  );
};

interface SessionRowProps extends SessionMainProps {
  index: number;
  search: string;
  sessions: SessionInfo[];
}

export const SessionRow = ({
  index,
  search,
  sessions,
  ...mainProps
}: SessionRowProps) => {
  const styles = useThemedStyles(createStyles);
  const { item } = mainProps;
  const group = sessionDateGroup(item.time.updated);
  const startsGroup = startsDateGroup({
    group,
    index,
    search,
    sessions,
  });
  return (
    <View>
      {startsGroup && (
        <BodyText
          accessibilityRole="header"
          muted
          style={[
            styles.dateGroup,
            index > 0 && styles.laterDateGroup,
            styles.betaDateGroup,
          ]}
        >
          {group}
        </BodyText>
      )}
      <View style={[styles.session, styles.betaSession]}>
        <SessionMain {...mainProps} />
      </View>
    </View>
  );
};
