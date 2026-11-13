import type { SessionInfo } from "@opencode/client";
import { Pressable, View } from "react-native";

import { ShellIcon } from "../../components/shell-icon";
import { BodyText } from "../../components/ui";
import { useTheme, useThemedStyles } from "../../lib/theme";
import {
  isUnread,
  metadataLine,
  sessionDateGroup,
  sessionStatus,
  startsDateGroup,
  visibleSessionStatus,
} from "./format";
import { createStyles } from "./styles";

interface SessionMainProps {
  active: boolean;
  betaHome: boolean;
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
  betaHome,
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
      onLongPress={betaHome ? manage : undefined}
      accessibilityActions={
        betaHome ? [{ label: "Manage session", name: "manage" }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "manage") {
          manage();
        }
      }}
      style={({ pressed }) => [
        styles.sessionMain,
        betaHome && styles.betaSessionMain,
        pressed && styles.sessionPressed,
      ]}
    >
      {betaHome && (
        <View style={styles.projectBadge}>
          <BodyText style={styles.projectBadgeLabel}>
            {name.charAt(0).toUpperCase()}
          </BodyText>
        </View>
      )}
      <View style={[styles.sessionText, betaHome && styles.betaSessionText]}>
        <BodyText
          numberOfLines={1}
          style={[styles.sessionTitle, betaHome && styles.betaSessionTitle]}
        >
          {item.title || "Untitled session"}
        </BodyText>
        {betaHome ? (
          <BetaMetadata
            name={name}
            unread={unread}
            visibleStatus={visibleStatus}
          />
        ) : (
          <BodyText muted numberOfLines={1} style={styles.metadata}>
            {metadataLine(item, visibleStatus, unread)}
          </BodyText>
        )}
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
  const { colors } = useTheme();
  const { betaHome, item, onManage } = mainProps;
  const group = sessionDateGroup(item.time.updated);
  const startsGroup = startsDateGroup({
    betaHome,
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
            betaHome && styles.betaDateGroup,
          ]}
        >
          {group}
        </BodyText>
      )}
      <View
        style={[
          styles.session,
          betaHome && styles.betaSession,
          selected && styles.selected,
        ]}
      >
        <SessionMain {...mainProps} />
        {!betaHome && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Manage ${item.title || "session"}`}
            onPress={() => onManage(item)}
            style={({ pressed }) => [
              styles.rowAction,
              pressed && styles.pressed,
            ]}
          >
            <ShellIcon name="more" color={colors.faint} size={18} />
          </Pressable>
        )}
      </View>
    </View>
  );
};
