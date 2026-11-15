import { useMutation } from "@tanstack/react-query";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dimensions, View } from "react-native";

import type { Client } from "../lib/client";
import { useServerScope } from "../lib/server-scope";
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
import type { ModelCatalog, Section } from "./settings/sections";
import {
  HeaderRefreshContext,
  SectionHeaderContext,
  SectionPageHeader,
} from "./settings/shared";
import type { HeaderRefresh } from "./settings/shared";
import { createStyles } from "./settings/styles";

const WIDE_SETTINGS_WIDTH = 920;

// What the shell around the settings routes supplies.
export interface SettingsHost {
  backLabel?: string;
  client?: Client;
  directory: string;
  modelCatalog?: ModelCatalog;
  onBack?: () => void;
  onManageServers?: () => void;
  onOpenNavigation?: () => void;
}

export const SettingsHostContext = createContext<SettingsHost | null>(null);

const useSettingsHost = () => {
  const host = useContext(SettingsHostContext);
  if (!host) {
    throw new Error("Settings are used outside a settings host");
  }
  return host;
};

interface SettingsRouteConfig {
  sectionPath: (section: Section) => Href;
  sections: Section[];
}

const SettingsRouteConfigContext = createContext<SettingsRouteConfig | null>(
  null
);

const useSettingsRouteConfig = () => {
  const config = useContext(SettingsRouteConfigContext);
  if (!config) {
    throw new Error("Settings routes are used outside a settings layout");
  }
  return config;
};

// Advanced renders its own scroll views, so Page cannot carry its header.
const headerInPage = (section: Section) => section !== "Advanced";

export const SettingsLayout = ({
  section,
  sections,
  onSelectSection,
}: {
  section: Section | null;
  sections: Section[];
  onSelectSection: (section: Section) => void;
}) => {
  const {
    backLabel,
    client,
    directory,
    modelCatalog: modelCatalogProp,
    onBack,
    onManageServers,
    onOpenNavigation,
  } = useSettingsHost();
  const modelCatalog = modelCatalogProp ?? client?.model;
  const styles = useThemedStyles(createStyles);
  const [headerRefresh, setHeaderRefresh] = useState<HeaderRefresh>(null);
  const confirmNavigation = useUnsavedGuard(`configuration:${directory}`);
  const hasClient = !!client;
  const hasModelCatalog = !!modelCatalog;
  const availableSections = useMemo(
    () => filterSections(sections, hasClient, hasModelCatalog),
    [hasClient, hasModelCatalog, sections]
  );
  const selected = resolveSelected(section, availableSections);
  const { mutate: confirmSection } = useMutation({
    mutationFn: (_next: Section) => confirmNavigation(),
    networkMode: "always",
  });
  const changeSection = useCallback(
    (next: Section) => {
      if (!availableSections.includes(next) || next === selected) {
        return;
      }
      confirmSection(next, {
        onSuccess: (confirmed) => {
          if (confirmed) {
            onSelectSection(next);
          }
        },
      });
    },
    [availableSections, selected, confirmSection, onSelectSection]
  );
  const header = useMemo(
    () =>
      selected
        ? { description: sectionDescriptions[selected], title: selected }
        : null,
    [selected]
  );
  const pageHeader = selected && headerInPage(selected) ? header : null;
  return (
    <View style={styles.screen}>
      <SettingsTopBar
        availableSections={availableSections}
        backLabel={backLabel}
        headerRefresh={headerRefresh}
        onBack={onBack}
        onManageServers={onManageServers}
        onOpenNavigation={onOpenNavigation}
        onSelectSection={changeSection}
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

const isSection = (value: string | undefined): value is Section =>
  allSections.some((candidate) => candidate === value);

// Route screen for `index` (no section) and `[section]`. A section change
// from `[section]` stays inside one route, so a dirty Config editor is
// never removed by the switch.
export const SettingsRouteScreen = ({ section }: { section?: string }) => {
  const router = useRouter();
  const { sectionPath, sections } = useSettingsRouteConfig();
  const current = isSection(section) ? section : null;
  const handleSelect = useCallback(
    (next: Section) => {
      if (section === undefined) {
        router.replace(sectionPath(next));
      } else {
        router.setParams({ section: next });
      }
    },
    [router, section, sectionPath]
  );
  return (
    <SettingsLayout
      section={current}
      sections={sections}
      onSelectSection={handleSelect}
    />
  );
};

const InlineSettings = ({ sections }: { sections: Section[] }) => {
  const [section, setSection] = useState<Section | null>(null);
  return (
    <SettingsLayout
      section={section}
      sections={sections}
      onSelectSection={setSection}
    />
  );
};

// The settings stack stays mounted while other tabs have focus. When the
// server or directory changes, the next focus returns it to its index route.
const useResetOnLocationChange = (indexPath: Href) => {
  const router = useRouter();
  const scope = useServerScope();
  const { directory } = useSettingsHost();
  const key = `${scope}:${directory}`;
  const applied = useRef(key);
  useFocusEffect(
    useCallback(() => {
      if (applied.current === key) {
        return;
      }
      applied.current = key;
      router.dismissTo(indexPath);
    }, [indexPath, key, router])
  );
  return key;
};

// The width choice is fixed at mount, so a rotation cannot swap the layout
// and drop the state of the open section.
export const SettingsRoutesLayout = ({
  indexPath,
  sectionPath,
  sections,
}: {
  indexPath: Href;
  sectionPath: (section: Section) => Href;
  sections: Section[];
}) => {
  const wide = useMemo(
    () => Dimensions.get("window").width >= WIDE_SETTINGS_WIDTH,
    []
  );
  const config = useMemo(
    () => ({ sectionPath, sections }),
    [sectionPath, sections]
  );
  const resetKey = useResetOnLocationChange(indexPath);
  if (wide) {
    return <InlineSettings key={resetKey} sections={sections} />;
  }
  return (
    <SettingsRouteConfigContext.Provider value={config}>
      <Stack screenOptions={{ animation: "none", headerShown: false }} />
    </SettingsRouteConfigContext.Provider>
  );
};
