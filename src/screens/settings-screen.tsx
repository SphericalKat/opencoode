import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, View } from "react-native";

import type { Client } from "../lib/client";
import { useThemedStyles } from "../lib/theme";
import { useUnsavedGuard } from "../lib/unsaved";
import { SettingsTopBar } from "./settings/navigation";
import { SettingsSection } from "./settings/section-views";
import {
  allSections,
  filterSections,
  resolveSelected,
  sectionDescriptions,
} from "./settings/sections";
import type { Section, ModelCatalog } from "./settings/sections";
import {
  HeaderRefreshContext,
  SectionHeaderContext,
  SectionPageHeader,
} from "./settings/shared";
import type { HeaderRefresh } from "./settings/shared";
import { createStyles } from "./settings/styles";

export type { Section } from "./settings/sections";
export { AppearanceSettings } from "./settings/appearance-settings";

// Advanced renders its own scroll views, so Page cannot carry its header.
const headerInPage = (section: Section) => section !== "Advanced";

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
  sectionRequest,
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
  sectionRequest?: { id: number; section: Section };
  serverLabel?: string;
}) => {
  const modelCatalog = modelCatalogProp ?? client?.model;
  const styles = useThemedStyles(createStyles);
  const [section, setSection] = useState<Section | null>(null);
  const [headerRefresh, setHeaderRefresh] = useState<HeaderRefresh>(null);
  const confirmNavigation = useUnsavedGuard(`configuration:${directory}`);
  const mounted = useRef(true);
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
    async (next: Section) => {
      if (!availableSections.includes(next)) {
        return false;
      }
      if (next === selected) {
        return true;
      }
      if (!(await confirmNavigation()) || !mounted.current) {
        return false;
      }
      setSection(next);
      return true;
    },
    [availableSections, selected, confirmNavigation]
  );
  const handledRequest = useRef(0);
  useEffect(() => {
    if (!sectionRequest || sectionRequest.id === handledRequest.current) {
      return;
    }
    handledRequest.current = sectionRequest.id;
    void changeSection(sectionRequest.section);
  }, [sectionRequest, changeSection]);
  const exit = useCallback(async () => {
    if ((await confirmNavigation()) && mounted.current) {
      onBack?.();
    }
  }, [confirmNavigation, onBack]);
  const canExit = visible && !!onBack;
  useEffect(() => {
    onBackStateChange?.(canExit);
    return () => onBackStateChange?.(false);
  }, [onBackStateChange, canExit]);
  useEffect(() => {
    if (!canExit) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        void exit();
        return true;
      }
    );
    return () => subscription.remove();
  }, [canExit, exit]);

  const header = useMemo(
    () =>
      selected
        ? { description: sectionDescriptions[selected], title: selected }
        : null,
    [selected]
  );
  const pageHeader = selected && headerInPage(selected) ? header : null;
  const handleBack = () => {
    void exit();
  };
  const handleSelectSection = (next: Section) => {
    void changeSection(next);
  };
  return (
    <View style={styles.screen}>
      <SettingsTopBar
        availableSections={availableSections}
        backLabel={backLabel}
        headerRefresh={headerRefresh}
        onBack={onBack ? handleBack : undefined}
        onManageServers={onManageServers}
        onOpenNavigation={onOpenNavigation}
        onSelectSection={handleSelectSection}
        selected={selected}
      />
      {header && !pageHeader && <SectionPageHeader {...header} />}
      <HeaderRefreshContext.Provider value={setHeaderRefresh}>
        <SectionHeaderContext.Provider value={pageHeader}>
          <View style={styles.body}>
            {selected && (
              <SettingsSection
                client={client}
                modelCatalog={modelCatalog}
                directory={directory}
                section={selected}
              />
            )}
          </View>
        </SectionHeaderContext.Provider>
      </HeaderRefreshContext.Provider>
    </View>
  );
};
