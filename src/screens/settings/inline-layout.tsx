import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, View } from "react-native";

import { ScreenHeader } from "../../components/screen-header";
import { useThemedStyles } from "../../lib/theme";
import type { SettingsNavigationRef } from "./navigation";
import type { Section } from "./sections";
import { HeaderRefreshContext } from "./shared";
import type { HeaderRefresh } from "./shared";
import { createStyles } from "./styles";

export const filterSections = (
  sections: Section[],
  hasClient: boolean,
  hasModelCatalog: boolean
) =>
  sections.filter(
    (value) =>
      hasClient ||
      value === "Look and feel" ||
      (value === "Models" && hasModelCatalog)
  );

export const resolveSelected = (
  section: Section | null,
  availableSections: Section[]
) => (section !== null && availableSections.includes(section) ? section : null);

export const useInlineBackHandling = ({
  changeSection,
  nativeStackEnabled,
  onBackStateChange,
  section,
  visible,
}: {
  changeSection: (next: Section | null) => Promise<boolean>;
  nativeStackEnabled: boolean;
  onBackStateChange?: (canGoBack: boolean) => void;
  section: Section | null;
  visible: boolean;
}) => {
  useEffect(() => {
    if (nativeStackEnabled) {
      return;
    }
    onBackStateChange?.(visible && section !== null);
    return () => onBackStateChange?.(false);
  }, [nativeStackEnabled, onBackStateChange, visible, section]);
  useEffect(() => {
    if (nativeStackEnabled || !visible || section === null) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        void changeSection(null);
        return true;
      }
    );
    return () => subscription.remove();
  }, [nativeStackEnabled, visible, section, changeSection]);
};

export const useNativeStackBackHandling = ({
  nativeStackEnabled,
  navigationRef,
  onBackStateChange,
  visible,
}: {
  nativeStackEnabled: boolean;
  navigationRef: SettingsNavigationRef;
  onBackStateChange?: (canGoBack: boolean) => void;
  visible: boolean;
}) => {
  const updateNativeBackState = useCallback(() => {
    if (!nativeStackEnabled) {
      return;
    }
    const canGoBack = navigationRef.current?.canGoBack() ?? false;
    onBackStateChange?.(visible && canGoBack);
  }, [nativeStackEnabled, navigationRef, onBackStateChange, visible]);
  useEffect(() => {
    updateNativeBackState();
    return () => onBackStateChange?.(false);
  }, [updateNativeBackState, onBackStateChange]);
  useEffect(() => {
    if (!nativeStackEnabled || !visible) {
      return;
    }
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!navigationRef.current?.canGoBack()) {
          return false;
        }
        navigationRef.current.goBack();
        return true;
      }
    );
    return () => subscription.remove();
  }, [nativeStackEnabled, navigationRef, visible]);
  return updateNativeBackState;
};

export const SettingsInlineLayout = ({
  backLabel,
  changeSection,
  onBack,
  onOpenNavigation,
  renderIndex,
  renderSection,
  section,
  selected,
}: {
  backLabel?: string;
  changeSection: (next: Section | null) => Promise<boolean>;
  onBack?: () => void;
  onOpenNavigation?: () => void;
  renderIndex: () => React.ReactElement;
  renderSection: (value: Section) => React.ReactElement;
  section: Section | null;
  selected: Section | null;
}) => {
  const styles = useThemedStyles(createStyles);
  const [headerRefresh, setHeaderRefresh] = useState<HeaderRefresh>(null);
  const atIndex = section === null;
  return (
    <>
      <ScreenHeader
        title={selected ?? "Settings"}
        backLabel={atIndex ? backLabel : "Settings"}
        onBack={
          atIndex
            ? onBack
            : () => {
                void changeSection(null);
              }
        }
        onOpenNavigation={atIndex ? onOpenNavigation : undefined}
        onRefresh={atIndex ? undefined : headerRefresh?.refresh}
        refreshing={headerRefresh?.loading}
      />
      <HeaderRefreshContext.Provider value={setHeaderRefresh}>
        <View style={[styles.content, styles.narrowContent]}>
          {atIndex && renderIndex()}
          {selected && !atIndex && (
            <View style={styles.detail}>{renderSection(selected)}</View>
          )}
        </View>
      </HeaderRefreshContext.Provider>
    </>
  );
};
