import type { Project } from "@opencode/client";
import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import {
  AnchoredMenu,
  MenuRow,
  MenuSeparator,
  useMenuAnchor,
} from "../../components/anchored-menu";
import type { AnchoredMenuItem, Rect } from "../../components/anchored-menu";
import { IconButton } from "../../components/icon-button";
import { ProjectAvatar } from "../../components/project-avatar";
import { ErrorNotice } from "../../components/ui";
import { useTheme } from "../../lib/theme";
import { directoryName } from "./format";

const MAX_HEIGHT_RATIO = 0.7;
const DROPDOWN_GUTTER = 6;
const ROW_HEIGHT = 48;
const ROW_GAP = 4;

const styles = StyleSheet.create({
  loading: {
    alignItems: "center",
    height: ROW_HEIGHT,
    justifyContent: "center",
  },
  projects: { gap: ROW_GAP },
  trailing: { alignItems: "center", flexDirection: "row", gap: ROW_GAP },
});

const afterAll = { marginBottom: ROW_GAP } as const;
const beforeAdd = { marginTop: ROW_GAP } as const;

export interface ProjectActions {
  clearNotifications: (project: Project) => void;
  importSession: (directory: string) => void;
  newNamedSession: (directory: string) => void;
  newSession: (directory: string) => void;
}

interface ProjectRowProps {
  actions: ProjectActions;
  onClose: () => void;
  onMenu: (project: Project, anchor: Rect) => void;
  onSelect: (directory: string | undefined) => void;
  project: Project;
  selected: boolean;
  unread: boolean;
}

const ProjectRow = ({
  actions,
  onClose,
  onMenu,
  onSelect,
  project,
  selected,
  unread,
}: ProjectRowProps) => {
  const { colors } = useTheme();
  const { measure, ref } = useMenuAnchor();
  const name = project.name || directoryName(project.canonical);
  const openMenu = async () => {
    const anchor = await measure().catch(() => null);
    if (anchor) {
      onMenu(project, anchor);
    }
  };
  return (
    <MenuRow
      accessibilityRole="menuitemradio"
      checked={selected}
      label={name}
      leading={
        <ProjectAvatar
          name={name}
          unread={unread}
          ringColor={selected ? colors.selected : colors.bg}
        />
      }
      onPress={() => onSelect(project.canonical)}
      selected={selected}
      trailing={
        <View style={styles.trailing}>
          <IconButton
            ref={ref}
            accessibilityLabel={`More options for ${name}`}
            borderless
            color={colors.faint}
            icon="dots"
            onPress={() => {
              void openMenu();
            }}
            pressedColor={colors.text}
          />
          <IconButton
            accessibilityLabel={`New session in ${name}`}
            borderless
            color={colors.faint}
            icon="compose"
            onPress={() => {
              onClose();
              actions.newSession(project.canonical);
            }}
            pressedColor={colors.text}
          />
        </View>
      }
    />
  );
};

const projectMenuItems = (
  project: Project,
  actions: ProjectActions,
  hasUnread: boolean
): AnchoredMenuItem[] => [
  {
    key: "new-session",
    label: "New session",
    onSelect: () => actions.newSession(project.canonical),
  },
  {
    key: "new-named-session",
    label: "New named session…",
    onSelect: () => actions.newNamedSession(project.canonical),
  },
  {
    key: "import-session",
    label: "Import session…",
    onSelect: () => actions.importSession(project.canonical),
  },
  {
    disabled: !hasUnread,
    key: "clear-notifications",
    label: "Clear notifications",
    onSelect: () => actions.clearNotifications(project),
  },
];

interface ProjectsDropdownProps {
  actions: ProjectActions;
  anchor: Rect | null;
  archived: boolean;
  onChooseDirectory: (() => void) | undefined;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (directory: string | undefined) => void;
  onToggleArchived: () => void;
  projectDirectory: string | undefined;
  projects: Project[];
  projectsError: string | undefined;
  projectsLoading: boolean;
  unreadProjectIDs: ReadonlySet<string>;
  visible: boolean;
}

export const ProjectsDropdown = ({
  actions,
  anchor,
  archived,
  onChooseDirectory,
  onClose,
  onRetry,
  onSelect,
  onToggleArchived,
  projectDirectory,
  projects,
  projectsError,
  projectsLoading,
  unreadProjectIDs,
  visible,
}: ProjectsDropdownProps) => {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [menu, setMenu] = useState<{ anchor: Rect; project: Project } | null>(
    null
  );
  const [menuVisible, setMenuVisible] = useState(false);
  const [afterMenuClosed, setAfterMenuClosed] = useState<(() => void) | null>(
    null
  );
  const [afterClosed, setAfterClosed] = useState<(() => void) | null>(null);

  const closeMenu = () => setMenuVisible(false);
  const finishMenu = () => {
    setMenu(null);
    setAfterMenuClosed(null);
    afterMenuClosed?.();
  };
  const finishDropdown = () => {
    setAfterClosed(null);
    afterClosed?.();
  };
  const openMenu = (project: Project, next: Rect) => {
    setMenu({ anchor: next, project });
    setMenuVisible(true);
  };
  const chooseDirectory = () => {
    setAfterClosed(() => onChooseDirectory ?? null);
  };
  const menuActions: ProjectActions = {
    clearNotifications: (project) => {
      onClose();
      actions.clearNotifications(project);
    },
    importSession: (directory) => {
      onClose();
      setAfterMenuClosed(() => () => actions.importSession(directory));
    },
    newNamedSession: (directory) => {
      onClose();
      setAfterMenuClosed(() => () => actions.newNamedSession(directory));
    },
    newSession: (directory) => {
      onClose();
      setAfterMenuClosed(() => () => actions.newSession(directory));
    },
  };

  return (
    <>
      <AnchoredMenu
        accessibilityLabel="Projects"
        anchor={anchor}
        appearance="dropdown"
        gutter={DROPDOWN_GUTTER}
        maxHeight={MAX_HEIGHT_RATIO * height}
        onClose={onClose}
        onClosed={finishDropdown}
        placement="bottom-start"
        sameWidth
        visible={visible}
      >
        <View style={afterAll}>
          <MenuRow
            accessibilityRole="menuitemradio"
            checked={!projectDirectory}
            icon="folder"
            label="All projects"
            onPress={() => onSelect(undefined)}
            selected={!projectDirectory}
          />
        </View>
        {projectsLoading && projects.length === 0 && (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.faint} />
          </View>
        )}
        <ErrorNotice error={projectsError} onRetry={onRetry} />
        <View style={styles.projects}>
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              actions={actions}
              onClose={onClose}
              onMenu={openMenu}
              onSelect={onSelect}
              project={project}
              selected={projectDirectory === project.canonical}
              unread={unreadProjectIDs.has(project.id)}
            />
          ))}
        </View>
        {onChooseDirectory && (
          <View style={beforeAdd}>
            <MenuRow
              icon="folder-add"
              label="Add project"
              onPress={chooseDirectory}
            />
          </View>
        )}
        <MenuSeparator />
        <MenuRow
          accessibilityRole="switch"
          checked={archived}
          icon="archive"
          label="Archived sessions"
          onPress={onToggleArchived}
        />
      </AnchoredMenu>
      <AnchoredMenu
        accessibilityLabel="Project actions"
        anchor={menu?.anchor ?? null}
        gutter={DROPDOWN_GUTTER}
        items={
          menu
            ? projectMenuItems(
                menu.project,
                menuActions,
                unreadProjectIDs.has(menu.project.id)
              )
            : []
        }
        onClose={closeMenu}
        onClosed={finishMenu}
        placement="bottom-end"
        visible={menuVisible}
      />
    </>
  );
};
