import type { Project } from "@opencode/client";
import { Pressable, View } from "react-native";

import {
  BodyText,
  Busy,
  Button,
  ErrorNotice,
  Sheet,
} from "../../components/ui";
import { useThemedStyles } from "../../lib/theme";
import { directoryName } from "./format";
import { createStyles } from "./styles";

interface ProjectRowProps {
  onSelect: (directory: string | undefined) => void;
  project: Project;
  selectedDirectory: string | undefined;
}

const ProjectRow = ({
  onSelect,
  project,
  selectedDirectory,
}: ProjectRowProps) => {
  const styles = useThemedStyles(createStyles);
  const checked = selectedDirectory === project.canonical;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={() => onSelect(project.canonical)}
      style={styles.menuRow}
    >
      <View style={styles.projectOption}>
        <BodyText numberOfLines={1}>
          {project.name || directoryName(project.canonical)}
        </BodyText>
        <BodyText muted numberOfLines={1} style={styles.metadata}>
          {project.canonical}
        </BodyText>
      </View>
      <BodyText muted>{checked ? "✓" : ""}</BodyText>
    </Pressable>
  );
};

interface ProjectsSheetProps {
  betaHome: boolean;
  onChooseFolder: (() => void) | undefined;
  onClose: () => void;
  onDismiss: () => void;
  onListActions: () => void;
  onRetry: () => void;
  onSelect: (directory: string | undefined) => void;
  projectDirectory: string | undefined;
  projects: Project[];
  projectsError: string | undefined;
  projectsLoading: boolean;
  visible: boolean;
}

export const ProjectsSheet = ({
  betaHome,
  onChooseFolder,
  onClose,
  onDismiss,
  onListActions,
  onRetry,
  onSelect,
  projectDirectory,
  projects,
  projectsError,
  projectsLoading,
  visible,
}: ProjectsSheetProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Sheet
      visible={visible}
      fitContent={betaHome}
      contentStyle={betaHome ? styles.projectSheetContent : undefined}
      title="Projects"
      onClose={onClose}
      onDismiss={onDismiss}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: !projectDirectory }}
        onPress={() => onSelect(undefined)}
        style={styles.menuRow}
      >
        <BodyText>All projects</BodyText>
        <BodyText muted>{projectDirectory ? "" : "✓"}</BodyText>
      </Pressable>
      {projectsLoading && <Busy />}
      <ErrorNotice error={projectsError} onRetry={onRetry} />
      {projects.map((project) => (
        <ProjectRow
          key={project.id}
          onSelect={onSelect}
          project={project}
          selectedDirectory={projectDirectory}
        />
      ))}
      <Button
        title="Session list actions"
        variant="ghost"
        onPress={onListActions}
      />
      {onChooseFolder && (
        <Button
          title="Choose a folder"
          variant="ghost"
          onPress={onChooseFolder}
        />
      )}
    </Sheet>
  );
};
