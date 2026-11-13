import { Platform, Pressable, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { ShellIcon } from "../../components/shell-icon";
import { BodyText, Button, ErrorNotice, Field, Row } from "../../components/ui";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { searchPlaceholder } from "./format";
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

interface SearchProps {
  archived: boolean;
  onChangeSearch: (value: string) => void;
  search: string;
}

const AndroidSearch = ({ archived, onChangeSearch, search }: SearchProps) => {
  const styles = useThemedStyles(createStyles);
  const { colors, scheme } = useTheme();
  return (
    <View
      style={[
        styles.androidSearch,
        styles.betaSearch,
        {
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
        style={[styles.androidSearchInput, styles.betaSearchInput]}
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
}: SearchProps & { onChooseHistory: () => void }) => {
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
  compactHeader: boolean;
  error: string | undefined;
  listError: string | undefined;
  onChangeSearch: (value: string) => void;
  onChooseHistory: () => void;
  onOpenProjects: () => void;
  onRefresh: () => void;
  projectLabel: string;
  projectsOpen: boolean;
  search: string;
  statusError: string | undefined;
  streamError: string | undefined;
}

export const SessionsHeader = ({
  archived,
  compactHeader,
  error,
  listError,
  onChangeSearch,
  onChooseHistory,
  onOpenProjects,
  onRefresh,
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
        styles.betaHeader,
      ]}
    >
      <ProjectSelector
        expanded={projectsOpen}
        label={projectLabel}
        onPress={onOpenProjects}
      />
      {Platform.OS === "android" ? (
        <AndroidSearch
          archived={archived}
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
