import type { SessionInfo } from "@opencode/client";
import { Pressable, View } from "react-native";

import { BodyText } from "../../components/ui";
import { playHaptic } from "../../lib/haptics";
import { useThemedStyles } from "../../lib/theme";
import {
  isUnread,
  sessionDateGroup,
  sessionStatus,
  startsDateGroup,
  visibleSessionStatus,
} from "./format";
import { createStyles } from "./styles";

interface SessionMainProps {
  active: boolean;
  item: SessionInfo;
  name: string;
  onManage: (item: SessionInfo) => void;
  onOpen: (id: string) => void;
}

const BetaMetadata = ({
  name,
  unread,
  visibleStatus,
}: {
  name: string;
  unread: boolean;
  visibleStatus: string | undefined;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.betaMetadataRow}>
      <BodyText
        muted
        numberOfLines={1}
        style={[styles.betaMetadata, styles.betaProjectName]}
      >
        {name}
      </BodyText>
      {visibleStatus || unread ? (
        <BodyText muted numberOfLines={1} style={styles.betaMetadata}>
          {" "}
          ·{" "}
          {[visibleStatus, unread ? "Unread" : undefined]
            .filter(Boolean)
            .join(" · ")}
        </BodyText>
      ) : null}
    </View>
  );
};

const SessionMain = ({
  active,
  item,
  name,
  onManage,
  onOpen,
}: SessionMainProps) => {
  const styles = useThemedStyles(createStyles);
  const status = sessionStatus(item, active);
  const unread = !!isUnread(item);
  const visibleStatus = visibleSessionStatus(status);
  const manage = () => onManage(item);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title || "Untitled session"}`}
      accessibilityHint={`${status}. Updated ${new Date(item.time.updated).toLocaleString()}`}
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
        pressed && styles.sessionPressed,
      ]}
    >
      <View style={styles.projectBadge}>
        <BodyText style={styles.projectBadgeLabel}>
          {name.charAt(0).toUpperCase()}
        </BodyText>
      </View>
      <View style={[styles.sessionText, styles.betaSessionText]}>
        <BodyText
          numberOfLines={1}
          style={[styles.sessionTitle, styles.betaSessionTitle]}
        >
          {item.title || "Untitled session"}
        </BodyText>
        <BetaMetadata
          name={name}
          unread={unread}
          visibleStatus={visibleStatus}
        />
      </View>
    </Pressable>
  );
};

interface SessionRowProps extends SessionMainProps {
  index: number;
  search: string;
  selected: boolean;
  sessions: SessionInfo[];
}

export const SessionRow = ({
  index,
  search,
  selected,
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
      <View
        style={[
          styles.session,
          styles.betaSession,
          selected && styles.selected,
        ]}
      >
        <SessionMain {...mainProps} />
      </View>
    </View>
  );
};
