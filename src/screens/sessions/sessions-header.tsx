import { Platform, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ShellIcon } from "../../components/shell-icon";
import { BodyText, Button, ErrorNotice, Field, Row } from "../../components/ui";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { headerTitle, searchPlaceholder } from "./format";
import { NewSessionIconButton } from "./new-session-buttons";
import type { NewSessionButtonProps } from "./new-session-buttons";
import { createStyles } from "./styles";

interface ProjectSelectorProps {
  expanded: boolean;
  label: string;
  onPress: () => void;
}

const ProjectSelector = ({
  expanded,
  label,
  onPress,
}: ProjectSelectorProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Select project"
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.projectSelector,
        pressed && styles.pressed,
      ]}
    >
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
        <Path
          d="M3 5h6l2 3h10v12H3V5Z"
          stroke={colors.muted}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </Svg>
      <BodyText numberOfLines={1} style={styles.projectSelectorLabel}>
        {label}
      </BodyText>
      <View style={styles.projectChevron}>
        <ShellIcon name="chevron" color={colors.faint} size={10} />
      </View>
    </Pressable>
  );
};

interface HeadingRowProps extends NewSessionButtonProps {
  archived: boolean;
  compact: boolean;
  compactHeader: boolean;
  onOpenActions: () => void;
  onOpenNavigation: (() => void) | undefined;
}

const HeadingRow = ({
  archived,
  busy,
  compact,
  compactHeader,
  creating,
  onOpenActions,
  onOpenNavigation,
  onPress,
}: HeadingRowProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Row style={styles.headingRow}>
      {!compact && onOpenNavigation && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation"
          onPress={onOpenNavigation}
          style={({ pressed }) => [
            styles.navigationButton,
            pressed && styles.pressed,
          ]}
        >
          <ShellIcon name="menu" color={colors.text} />
        </Pressable>
      )}
      <View style={styles.headingText}>
        <BodyText
          accessibilityRole="header"
          numberOfLines={1}
          style={[
            styles.title,
            compactHeader && styles.compactTitle,
            compact && Platform.OS === "android" && styles.drawerTitle,
          ]}
        >
          {headerTitle(archived, compact)}
        </BodyText>
      </View>
      <NewSessionIconButton busy={busy} creating={creating} onPress={onPress} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Session list actions"
        onPress={onOpenActions}
        style={({ pressed }) => [
          styles.actionButton,
          pressed && styles.pressed,
        ]}
      >
        <ShellIcon name="more" color={colors.muted} size={18} />
      </Pressable>
    </Row>
  );
};

interface SearchProps {
  archived: boolean;
  betaHome: boolean;
  onChangeSearch: (value: string) => void;
  search: string;
}

const AndroidSearch = ({
  archived,
  betaHome,
  onChangeSearch,
  search,
}: SearchProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.androidSearch,
        betaHome && styles.betaSearch,
        betaHome && {
          backgroundColor: scheme === "dark" ? colors.panel : colors.raised,
        },
      ]}
    >
      <ShellIcon name="search" color={colors.faint} size={16} />
      <Field
        accessibilityLabel="Search sessions"
        placeholder={searchPlaceholder(archived)}
        value={search}
        onChangeText={onChangeSearch}
        containerStyle={styles.searchField}
        style={[styles.androidSearchInput, betaHome && styles.betaSearchInput]}
      />
      {!!search && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear session search"
          hitSlop={4}
          onPress={() => onChangeSearch("")}
          style={({ pressed }) => [
            styles.clearSearch,
            pressed && styles.pressed,
          ]}
        >
          <ShellIcon name="close" color={colors.muted} size={16} />
        </Pressable>
      )}
    </View>
  );
};

const NativeSearchRow = ({
  archived,
  onChangeSearch,
  onChooseHistory,
  search,
}: Omit<SearchProps, "betaHome"> & { onChooseHistory: () => void }) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Row style={styles.searchRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Field
          accessibilityLabel="Search sessions"
          placeholder={searchPlaceholder(archived)}
          value={search}
          onChangeText={onChangeSearch}
          clearButtonMode="while-editing"
          style={styles.search}
        />
      </View>
      {search ? (
        <Button
          title="Clear"
          accessibilityLabel="Clear session search"
          compact
          variant="ghost"
          onPress={() => onChangeSearch("")}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Session history: ${archived ? "Archived" : "Recent"}`}
          onPress={onChooseHistory}
          style={styles.filter}
        >
          <BodyText muted style={styles.filterText}>
            {archived ? "Archived" : "Recent"} ⌄
          </BodyText>
        </Pressable>
      )}
    </Row>
  );
};

interface SessionsHeaderProps {
  archived: boolean;
  betaHome: boolean;
  busy: boolean;
  compact: boolean;
  compactHeader: boolean;
  creating: boolean;
  error: string | undefined;
  listError: string | undefined;
  onChangeSearch: (value: string) => void;
  onChooseHistory: () => void;
  onOpenActions: () => void;
  onOpenNavigation: (() => void) | undefined;
  onOpenProjects: () => void;
  onRefresh: () => void;
  onStartSession: () => void;
  projectLabel: string;
  projectsOpen: boolean;
  search: string;
  statusError: string | undefined;
  streamError: string | undefined;
}

export const SessionsHeader = ({
  archived,
  betaHome,
  busy,
  compact,
  compactHeader,
  creating,
  error,
  listError,
  onChangeSearch,
  onChooseHistory,
  onOpenActions,
  onOpenNavigation,
  onOpenProjects,
  onRefresh,
  onStartSession,
  projectLabel,
  projectsOpen,
  search,
  statusError,
  streamError,
}: SessionsHeaderProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <View
      style={[
        styles.header,
        compactHeader && styles.compactHeader,
        betaHome && styles.betaHeader,
      ]}
    >
      {betaHome ? (
        <ProjectSelector
          expanded={projectsOpen}
          label={projectLabel}
          onPress={onOpenProjects}
        />
      ) : (
        <HeadingRow
          archived={archived}
          busy={busy}
          compact={compact}
          compactHeader={compactHeader}
          creating={creating}
          onOpenActions={onOpenActions}
          onOpenNavigation={onOpenNavigation}
          onPress={onStartSession}
        />
      )}
      {Platform.OS === "android" ? (
        <AndroidSearch
          archived={archived}
          betaHome={betaHome}
          onChangeSearch={onChangeSearch}
          search={search}
        />
      ) : (
        <NativeSearchRow
          archived={archived}
          onChangeSearch={onChangeSearch}
          onChooseHistory={onChooseHistory}
          search={search}
        />
      )}
      <ErrorNotice error={listError} onRetry={onRefresh} />
      <ErrorNotice error={error} />
      {statusError && <BodyText muted>{statusError}</BodyText>}
      {streamError && <BodyText muted>{streamError}</BodyText>}
    </View>
  );
};
