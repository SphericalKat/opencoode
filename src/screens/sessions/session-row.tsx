import type { SessionInfo } from "@opencode/client";
import { ActivityIndicator, Pressable, View } from "react-native";

import { ProjectAvatar } from "../../components/project-avatar";
import { BodyText, usePressFeedback } from "../../components/ui";
import { playHaptic } from "../../lib/haptics";
import { sessionLabel } from "../../lib/session-title";
import { useTheme, useThemedStyles } from "../../lib/theme";
import {
  isUnread,
  sessionDateGroup,
  sessionStatus,
  startsDateGroup,
} from "./format";
import { createStyles } from "./styles";

interface SessionMainProps {
  active: boolean;
  item: SessionInfo;
  name: string;
  onManage: (item: SessionInfo) => void;
  onOpen: (id: string) => void;
  showProjectName: boolean;
}

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
  onManage,
  onOpen,
  showProjectName,
}: SessionMainProps) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { android_ripple, pressedStyle } = usePressFeedback();
  const unread = !!isUnread(item);
  const failed = !active && sessionStatus(item, active) === "Failed";
  const manage = () => onManage(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabelFor({ active, item, name, unread })}
      accessibilityHint={`Updated ${new Date(item.time.updated).toLocaleString()}`}
      android_ripple={android_ripple}
      onPress={() => onOpen(item.id)}
      onLongPress={() => {
        playHaptic("longPress");
        manage();
      }}
      accessibilityActions={[{ label: "Manage session", name: "manage" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "manage") {
          manage();
        }
      }}
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
        <BodyText
          numberOfLines={1}
          style={[styles.sessionTitle, styles.betaSessionTitle]}
        >
          {sessionLabel(item)}
        </BodyText>
        {showProjectName ? (
          <BodyText muted numberOfLines={1} style={styles.betaProjectName}>
            {name}
          </BodyText>
        ) : null}
      </View>
      {active ? (
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
