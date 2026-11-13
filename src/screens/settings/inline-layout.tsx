import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, View } from "react-native";

import { ScreenHeader } from "../../components/screen-header";
import { BodyText, Row } from "../../components/ui";
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
      value === "Appearance" ||
      (value === "Models" && hasModelCatalog)
  );

export const resolveSelected = (
  section: Section | null,
  availableSections: Section[],
  wide: boolean
) => {
  if (section !== null && availableSections.includes(section)) {
    return section;
  }
  if (!wide) {
    return null;
  }
  return availableSections.includes("Accounts")
    ? "Accounts"
    : (availableSections[0] ?? null);
};

export const useInlineBackHandling = ({
  changeSection,
  nativeStackEnabled,
  onBackStateChange,
  section,
  visible,
  wide,
}: {
  changeSection: (next: Section | null) => Promise<boolean>;
  nativeStackEnabled: boolean;
  onBackStateChange?: (canGoBack: boolean) => void;
  section: Section | null;
  visible: boolean;
  wide: boolean;
}) => {
  useEffect(() => {
    if (nativeStackEnabled) {
      return;
    }
    onBackStateChange?.(visible && !wide && section !== null);
    return () => onBackStateChange?.(false);
  }, [nativeStackEnabled, onBackStateChange, visible, wide, section]);
  useEffect(() => {
    if (nativeStackEnabled || !visible || wide || section === null) {
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
  }, [nativeStackEnabled, visible, wide, section, changeSection]);
};

export const useNativeStackBackHandling = ({
  nativeStackEnabled,
  navigationRef,
  onBackStateChange,
  visible,
  wide,
}: {
  nativeStackEnabled: boolean;
  navigationRef: SettingsNavigationRef;
  onBackStateChange?: (canGoBack: boolean) => void;
  visible: boolean;
  wide: boolean;
}) => {
  const updateNativeBackState = useCallback(() => {
    if (!nativeStackEnabled) {
      return;
    }
    const canGoBack = navigationRef.current?.canGoBack() ?? false;
    onBackStateChange?.(visible && !wide && canGoBack);
  }, [nativeStackEnabled, navigationRef, onBackStateChange, visible, wide]);
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
  wide,
}: {
  backLabel?: string;
  changeSection: (next: Section | null) => Promise<boolean>;
  onBack?: () => void;
  onOpenNavigation?: () => void;
  renderIndex: () => React.ReactElement;
  renderSection: (value: Section) => React.ReactElement;
  section: Section | null;
  selected: Section | null;
  wide: boolean;
}) => {
  const styles = useThemedStyles(createStyles);
  const [headerRefresh, setHeaderRefresh] = useState<HeaderRefresh>(null);
  const atIndex = section === null;
  return (
    <>
      {!wide && (
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
      )}
      <HeaderRefreshContext.Provider value={wide ? null : setHeaderRefresh}>
        <View style={[styles.content, !wide && styles.narrowContent]}>
          {(wide || atIndex) && renderIndex()}
          {selected && (wide || !atIndex) && (
            <View style={styles.detail}>
              {wide && (
                <Row style={styles.detailHeader}>
                  <BodyText
                    accessibilityRole="header"
                    style={styles.detailTitle}
                  >
                    {selected}
                  </BodyText>
                </Row>
              )}
              {renderSection(selected)}
            </View>
          )}
        </View>
      </HeaderRefreshContext.Provider>
    </>
  );
};
