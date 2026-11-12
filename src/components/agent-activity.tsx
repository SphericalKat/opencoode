import React, { memo, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import type { AgentActivity } from "../lib/activity";
import { useTheme, useThemedStyles } from "../lib/theme";
import type { ThemeColors } from "../lib/theme";
import { WorkingIndicator } from "./motion";
import { BodyText } from "./ui";

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    action: {
      justifyContent: "center",
      minHeight: Platform.OS === "android" ? 48 : 44,
      paddingHorizontal: 8,
    },
    actionText: { fontSize: 13, fontWeight: "500" },
    announcement: {
      height: 1,
      opacity: 0,
      overflow: "hidden",
      position: "absolute",
      width: 1,
    },
    bar: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      minHeight: 28,
      paddingHorizontal: 6,
    },
    label: { flexShrink: 1, fontSize: 14, lineHeight: 21 },
    lane: { maxWidth: 736, minHeight: 28, width: "100%" },
    retryError: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 19,
      paddingBottom: 10,
      paddingHorizontal: 6,
    },
    summary: {
      alignItems: "center",
      flex: 1,
      flexDirection: "row",
      gap: 8,
      minWidth: 0,
    },
  });

interface ActivityText {
  activity: AgentActivity;
  connected: boolean;
  connectionStatus: string;
  retry: AgentActivity["retry"];
  sending: boolean;
  stopping: boolean;
}

const activityText = (
  {
    activity,
    connected,
    connectionStatus,
    retry,
    sending,
    stopping,
  }: ActivityText,
  retryText: (retry: NonNullable<AgentActivity["retry"]>) => string
): string => {
  if (!connected) {
    return connectionStatus;
  }
  if (stopping) {
    return "Stopping";
  }
  if (retry) {
    return retryText(retry);
  }
  if (sending && activity.kind === "idle") {
    return "Sending";
  }
  return activity.label;
};

const statusIcon = (needsAttention: boolean, active: boolean, color: string) =>
  needsAttention ? (
    <Svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>
      <Path
        d="M8 2 14 13H2L8 2ZM8 6v3m0 2v.1"
        stroke={color}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  ) : (
    <WorkingIndicator active={active} color={color} size={14} />
  );

const attentionState = (
  activity: AgentActivity,
  connected: boolean,
  stopping: boolean
) => {
  const blocked =
    connected &&
    !stopping &&
    (activity.kind === "approval" || activity.kind === "question");
  const needsAttention =
    blocked || (connected && !stopping && activity.kind === "error");
  return { blocked, needsAttention };
};

const AgentActivityBarView = ({
  activity,
  connectionStatus,
  sending,
  stopping,
  animate,
  show,
  onReview,
}: {
  activity: AgentActivity;
  connectionStatus: string;
  sending: boolean;
  stopping: boolean;
  animate: boolean;
  show: boolean;
  onReview: () => void;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const connected = connectionStatus === "Live";
  const retry = connected && !stopping ? activity.retry : undefined;
  const [now, setNow] = useState(Date.now);
  const [showError, setShowError] = useState(false);
  const retrying = retry !== undefined;
  const resetKey = `${retry?.at}:${retry?.attempt}:${retrying}:${animate}`;
  const [previousResetKey, setPreviousResetKey] = useState(resetKey);
  if (previousResetKey !== resetKey) {
    setPreviousResetKey(resetKey);
    setShowError(false);
  }
  useEffect(() => {
    if (!retrying || !animate) {
      return;
    }
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [retrying, animate]);
  const { blocked, needsAttention } = attentionState(
    activity,
    connected,
    stopping
  );
  const seconds = retry ? Math.max(0, Math.ceil((retry.at - now) / 1000)) : 0;
  const textState = {
    activity,
    connected,
    connectionStatus,
    retry,
    sending,
    stopping,
  };
  const label = activityText(
    textState,
    (value) =>
      `${seconds ? `Retrying in ${seconds}s` : "Retrying now"} · Attempt ${value.attempt}`
  );
  const announcement = activityText(textState, () => "Waiting to retry");
  const lastAnnouncement = useRef(announcement);
  useEffect(() => {
    if (lastAnnouncement.current === announcement) {
      return;
    }
    lastAnnouncement.current = announcement;
    if (animate && Platform.OS !== "web") {
      AccessibilityInfo.announceForAccessibility(
        announcement || "Agent is ready"
      );
    }
  }, [announcement, animate]);
  const busy = !!label && connected && !needsAttention;
  return (
    <>
      {Platform.OS === "web" && (
        <View aria-live="polite" style={styles.announcement}>
          <BodyText>{announcement || "Agent is ready"}</BodyText>
        </View>
      )}
      {show && (
        <View style={styles.lane}>
          <View style={styles.bar}>
            <View
              style={styles.summary}
              accessibilityLiveRegion="none"
              aria-live="off"
              accessibilityLabel={label || undefined}
            >
              {!!label &&
                statusIcon(needsAttention, busy && animate, colors.muted)}
              <BodyText muted numberOfLines={1} style={styles.label}>
                {label}
              </BodyText>
            </View>
            {blocked && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Review pending requests"
                onPress={onReview}
                style={styles.action}
              >
                <BodyText style={styles.actionText}>Review ↓</BodyText>
              </Pressable>
            )}
            {retry && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry details"
                accessibilityState={{ expanded: showError }}
                onPress={() => setShowError((value) => !value)}
                style={styles.action}
              >
                <BodyText muted style={styles.actionText}>
                  {showError ? "Less" : "Details"}
                </BodyText>
              </Pressable>
            )}
          </View>
          {retry && showError && (
            <BodyText style={styles.retryError}>{retry.message}</BodyText>
          )}
        </View>
      )}
    </>
  );
};

export const AgentActivityBar = memo(AgentActivityBarView);
