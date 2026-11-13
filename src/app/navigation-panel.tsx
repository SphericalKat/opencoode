import type { ServerInfo } from "@opencode/client";
import { Platform, Pressable, View } from "react-native";

import { NavIcon } from "../components/icons";
import { OpenCodeLogo } from "../components/open-code-logo";
import { ShellIcon } from "../components/shell-icon";
import { BodyText } from "../components/ui";
import type { Connection } from "../lib/client";
import { useTheme, useThemedStyles } from "../lib/theme";
import { SessionsScreen } from "../screens/sessions-screen";
import { destinations } from "./constants";
import { createStyles } from "./styles";
import type { ServerClient, Tab } from "./types";

interface NavigationPanelProps {
  active: Connection;
  client: ServerClient;
  connectionRevision: number;
  directory: string;
  info: ServerInfo | null;
  onChangeTab: (tab: Tab) => void;
  onClose: () => void;
  onOpenProjects: () => void;
  onOpenServers: () => void;
  onOpenSession: (id: string, keepNavigation?: boolean) => Promise<boolean>;
  projectLabel: string;
  revision: number;
  sessionID: string | null;
  tab: Tab;
  wide: boolean;
}

export const NavigationPanel = ({
  active,
  client,
  connectionRevision,
  directory,
  info,
  onChangeTab,
  onClose,
  onOpenProjects,
  onOpenServers,
  onOpenSession,
  projectLabel,
  revision,
  sessionID,
  tab,
  wide,
}: NavigationPanelProps) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <View style={styles.navigationBrand}>
        <OpenCodeLogo width={Platform.OS === "android" ? 112 : 136} />
        {!wide && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close navigation"
            onPress={onClose}
            style={styles.iconButton}
          >
            <ShellIcon name="close" color={colors.muted} />
          </Pressable>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Switch project directory. Current project: ${projectLabel}`}
        accessibilityHint={directory}
        onPress={onOpenProjects}
        style={({ pressed }) => [
          styles.projectChoice,
          pressed && styles.pressed,
        ]}
      >
        <NavIcon name="workspace" color={colors.muted} size={18} />
        <View style={styles.contextText}>
          <BodyText numberOfLines={1} style={styles.projectName}>
            {projectLabel}
          </BodyText>
          {Platform.OS !== "android" && (
            <BodyText
              muted
              numberOfLines={1}
              ellipsizeMode="middle"
              style={styles.contextDetail}
            >
              {directory}
            </BodyText>
          )}
        </View>
        <ShellIcon name="chevron" size={14} color={colors.faint} />
      </Pressable>
      <View style={styles.navigationSessions}>
        <SessionsScreen
          compact
          key={`${active.id}:${connectionRevision}:navigation`}
          client={client}
          directory={directory}
          selectedSessionID={sessionID ?? undefined}
          revision={revision}
          onOpenSession={onOpenSession}
        />
      </View>
      <View style={styles.navigationFooter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch server"
          onPress={onOpenServers}
          style={({ pressed }) => [
            styles.serverChoice,
            pressed && styles.pressed,
          ]}
        >
          <ShellIcon name="server" color={colors.muted} size={18} />
          <View style={styles.contextText}>
            <BodyText numberOfLines={1} style={styles.serverName}>
              {active.name}
            </BodyText>
            <BodyText muted style={styles.contextDetail}>
              OpenCode {info?.version ? `· v${info.version}` : ""}
            </BodyText>
          </View>
          <ShellIcon name="chevron" size={14} color={colors.faint} />
        </Pressable>
        <View style={styles.navigationLinks}>
          {destinations.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.label}`}
              aria-current={tab === item.id ? "page" : undefined}
              onPress={() => onChangeTab(item.id)}
              style={({ pressed }) => [
                styles.navigationLink,
                tab === item.id && styles.selectedDestination,
                pressed && styles.pressed,
              ]}
            >
              <NavIcon name={item.id} color={colors.muted} size={16} />
              <BodyText style={styles.navigationLinkText}>
                {item.label}
              </BodyText>
            </Pressable>
          ))}
        </View>
      </View>
    </>
  );
};
