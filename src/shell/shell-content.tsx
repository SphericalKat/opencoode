import { TabList, Tabs, TabSlot, TabTrigger } from "expo-router/ui";
import type { TabsDescriptor, TabsSlotRenderOptions } from "expo-router/ui";
import type { ReactNode } from "react";
import { Keyboard } from "react-native";

import type { SessionPane } from "../components/beta-navigation";
import { MotionScreen } from "../components/motion";
import { routes } from "../lib/routes";
import { useThemedStyles } from "../lib/theme";
import { useSheetStoreApi } from "../stores/sheet-store";
import { ShellFrame } from "./shell-frame";
import type { ShellView } from "./shell-view";
import { createStyles } from "./styles";

const TAB_BACK_BEHAVIOR = { backBehavior: "firstRoute" } as const;

// A tab loads on its first visit and then stays mounted. The fade replays
// whenever the tab becomes visible.
const renderTab = (
  descriptor: TabsDescriptor,
  { isFocused, loaded }: TabsSlotRenderOptions
) => {
  if (!loaded && !isFocused) {
    return null;
  }
  return (
    <TabScreen
      key={descriptor.route.key}
      focused={isFocused}
      row={descriptor.route.name === "index"}
    >
      {descriptor.render()}
    </TabScreen>
  );
};

interface TabScreenProps {
  children: ReactNode;
  focused: boolean;
  row: boolean;
}

const TabScreen = ({ children, focused, row }: TabScreenProps) => {
  const styles = useThemedStyles(createStyles);
  return (
    <MotionScreen
      visible={focused}
      style={[styles.full, row && styles.row, !focused && styles.hidden]}
    >
      {children}
    </MotionScreen>
  );
};

const ShellTabs = () => {
  const styles = useThemedStyles(createStyles);
  return (
    <Tabs options={TAB_BACK_BEHAVIOR} style={styles.full}>
      <TabSlot detachInactiveScreens={false} renderFn={renderTab} />
      <TabList style={styles.hidden}>
        <TabTrigger name="index" href={routes.sessions} />
        <TabTrigger name="workspace" href={routes.workspace} />
        <TabTrigger name="settings" href={routes.settings} />
      </TabList>
    </Tabs>
  );
};

interface ShellContentProps {
  onChooseDirectory: () => void;
  onOpenNavigation: () => void;
  onRetryLocation: () => void;
  onSelectPane: (pane: SessionPane) => void;
  view: ShellView;
}

export const ShellContent = ({
  onChooseDirectory,
  onOpenNavigation,
  onRetryLocation,
  onSelectPane,
  view,
}: ShellContentProps) => {
  const sheetApi = useSheetStoreApi();
  return (
    <ShellFrame
      currentOpenTab={view.currentOpenTab}
      onMore={() => {
        Keyboard.dismiss();
        sheetApi.setState({ moreOpen: true });
      }}
      onOpenNavigation={onOpenNavigation}
      onProject={onChooseDirectory}
      onRetryLocation={onRetryLocation}
      onSelectPane={onSelectPane}
      selectedPane={view.selectedPane}
    >
      <ShellTabs />
    </ShellFrame>
  );
};
