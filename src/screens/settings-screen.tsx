import { useNavigationContainerRef } from "@react-navigation/native";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import type { Client } from "../lib/client";
import { useThemedStyles } from "../lib/theme";
import { useUnsavedGuard } from "../lib/unsaved";
import {
  filterSections,
  resolveSelected,
  useInlineBackHandling,
  useNativeStackBackHandling,
  SettingsInlineLayout,
} from "./settings/inline-layout";
import { SettingsIndex, SettingsNativeStack } from "./settings/navigation";
import { SettingsSection } from "./settings/section-views";
import { allSections } from "./settings/sections";
import type { Section, ModelCatalog } from "./settings/sections";
import { zeroInsets } from "./settings/stack";
import type { SettingsStackParams } from "./settings/stack";
import { createStyles } from "./settings/styles";

export type { Section } from "./settings/sections";
export { AppearanceSettings } from "./settings/appearance-settings";

const keepState = (state: boolean) => state;
const isNativeStackWidth = (width: number) =>
  Platform.OS !== "web" && width < 920;

export const SettingsScreen = ({
  client,
  modelCatalog: modelCatalogProp,
  directory,
  sections = allSections,
  visible = true,
  onBackStateChange,
  onBack,
  backLabel,
  onOpenNavigation,
  onManageServers,
  serverLabel,
}: {
  client?: Client;
  modelCatalog?: ModelCatalog;
  directory: string;
  sections?: Section[];
  visible?: boolean;
  onBackStateChange?: (canGoBack: boolean) => void;
  onBack?: () => void;
  backLabel?: string;
  onOpenNavigation?: () => void;
  onManageServers?: () => void;
  serverLabel?: string;
}) => {
  const modelCatalog = modelCatalogProp ?? client?.model;
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  // A resize must not replace the navigator and discard an open editor.
  const [nativeStackEnabled] = useReducer(keepState, width, isNativeStackWidth);
  const [section, setSection] = useState<Section | null>(null);
  const confirmNavigation = useUnsavedGuard(`configuration:${directory}`);
  const mounted = useRef(true);
  const navigationRef = useNavigationContainerRef<SettingsStackParams>();
  const hasClient = !!client;
  const hasModelCatalog = !!modelCatalog;
  const availableSections = useMemo(
    () => filterSections(sections, hasClient, hasModelCatalog),
    [hasClient, hasModelCatalog, sections]
  );
  const selected = resolveSelected(section, availableSections);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const changeSection = useCallback(
    async (next: Section | null) => {
      if (next !== null && !availableSections.includes(next)) {
        return false;
      }
      if (next === section) {
        return true;
      }
      if (section !== null && !(await confirmNavigation())) {
        return false;
      }
      if (!mounted.current) {
        return false;
      }
      setSection(next);
      return true;
    },
    [section, availableSections, confirmNavigation]
  );
  useInlineBackHandling({
    changeSection,
    nativeStackEnabled,
    onBackStateChange,
    section,
    visible,
  });
  const updateNativeBackState = useNativeStackBackHandling({
    nativeStackEnabled,
    navigationRef,
    onBackStateChange,
    visible,
  });

  const renderIndex = () => (
    <SettingsIndex
      onSelect={(next) => {
        if (!nativeStackEnabled) {
          void changeSection(next);
          return;
        }
        navigationRef.navigate("Section", { section: next });
      }}
      sections={availableSections}
      selected={selected}
      onManageServers={onManageServers}
      serverLabel={serverLabel}
    />
  );
  const renderSection = (value: Section) => (
    <SettingsSection
      client={client}
      modelCatalog={modelCatalog}
      directory={directory}
      section={value}
    />
  );

  return (
    <View style={[styles.screen, styles.narrowScreen]}>
      {nativeStackEnabled ? (
        <SafeAreaInsetsContext.Provider value={zeroInsets}>
          <View style={styles.nativeNavigation}>
            <SettingsNativeStack
              availableSections={availableSections}
              backLabel={backLabel}
              client={client}
              directory={directory}
              modelCatalog={modelCatalog}
              navigationRef={navigationRef}
              onBack={onBack}
              onReady={updateNativeBackState}
              renderIndex={renderIndex}
            />
          </View>
        </SafeAreaInsetsContext.Provider>
      ) : (
        <SettingsInlineLayout
          backLabel={backLabel}
          changeSection={changeSection}
          onBack={onBack}
          onOpenNavigation={onOpenNavigation}
          renderIndex={renderIndex}
          renderSection={renderSection}
          section={section}
          selected={selected}
        />
      )}
    </View>
  );
};
