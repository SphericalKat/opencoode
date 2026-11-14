import type { ComponentRef, Ref } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { ProjectAvatar } from "../../components/project-avatar";
import { SelectTrigger } from "../../components/select";
import { ShellIcon } from "../../components/shell-icon";
import { BodyText, Button, ErrorNotice, Field, Row } from "../../components/ui";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { searchPlaceholder } from "./format";
import { createStyles } from "./styles";

interface ProjectSelectorProps {
  expanded: boolean;
  hasProject: boolean;
  label: string;
  onPress: () => void;
  triggerRef: Ref<ComponentRef<typeof View>>;
}

const selectorStyles = StyleSheet.create({
  content: {
    alignItems: "center",
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    gap: 8,
    minWidth: 0,
  },
  label: { flexShrink: 1, fontSize: 13, fontWeight: "500", lineHeight: 16 },
});

const ProjectSelector = ({
  expanded,
  hasProject,
  label,
  onPress,
  triggerRef,
}: ProjectSelectorProps) => {
  const { colors } = useTheme();
  return (
    <SelectTrigger
      ref={triggerRef}
      value={label}
      accessibilityLabel="Projects"
      expanded={expanded}
      onPress={onPress}
    >
      <View style={selectorStyles.content}>
        {hasProject ? (
          <ProjectAvatar name={label} ringColor={colors.bg} />
        ) : (
          <ShellIcon name="folder" color={colors.muted} size={16} />
        )}
        <BodyText numberOfLines={1} style={selectorStyles.label}>
          {label}
        </BodyText>
      </View>
    </SelectTrigger>
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

const NativeSearchRow = ({ archived, onChangeSearch, search }: SearchProps) => {
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
      {!!search && (
        <Button
          title="Clear"
          accessibilityLabel="Clear session search"
          size="compact"
          variant="ghost"
          onPress={() => onChangeSearch("")}
        />
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
  onOpenProjects: () => void;
  onRefresh: () => void;
  projectLabel: string;
  projectsOpen: boolean;
  projectTriggerRef: Ref<ComponentRef<typeof View>>;
  hasProject: boolean;
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
  onOpenProjects,
  onRefresh,
  hasProject,
  projectLabel,
  projectsOpen,
  projectTriggerRef,
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
        hasProject={hasProject}
        label={projectLabel}
        onPress={onOpenProjects}
        triggerRef={projectTriggerRef}
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
