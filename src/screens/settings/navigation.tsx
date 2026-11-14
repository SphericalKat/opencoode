import React, { useMemo } from "react";
import { View } from "react-native";

import {
  BackButton,
  HeaderMenuButton,
  HeaderRefreshButton,
} from "../../components/screen-header";
import { SelectMenu } from "../../components/select";
import { useThemedStyles } from "../../lib/theme";
import { sectionMenuEntries } from "./sections";
import type { Section, SectionMenuValue } from "./sections";
import type { HeaderRefresh } from "./shared";
import { createStyles } from "./styles";

export const SettingsTopBar = ({
  availableSections,
  backLabel,
  headerRefresh,
  onBack,
  onManageServers,
  onOpenNavigation,
  onSelectSection,
  selected,
}: {
  availableSections: Section[];
  backLabel?: string;
  headerRefresh: HeaderRefresh;
  onBack?: () => void;
  onManageServers?: () => void;
  onOpenNavigation?: () => void;
  onSelectSection: (section: Section) => void;
  selected: Section | null;
}) => {
  const styles = useThemedStyles(createStyles);
  const entries = useMemo(
    () => sectionMenuEntries(availableSections, !!onManageServers),
    [availableSections, onManageServers]
  );
  const backText = `Back to ${backLabel ?? "app"}`;
  const handleRefresh = headerRefresh?.refresh;
  const choose = (value: SectionMenuValue) => {
    if (value === "Servers") {
      onManageServers?.();
      return;
    }
    onSelectSection(value);
  };
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarLeft}>
        {onOpenNavigation && <HeaderMenuButton onPress={onOpenNavigation} />}
        {onBack && (
          <BackButton
            label={backText}
            accessibilityLabel={backText}
            onPress={onBack}
          />
        )}
      </View>
      <View style={styles.topBarRight}>
        {handleRefresh && (
          <HeaderRefreshButton
            onPress={handleRefresh}
            busy={headerRefresh.loading}
          />
        )}
        {selected && (
          <SelectMenu
            accessibilityLabel="Settings section"
            appearance="outline"
            placement="bottom-end"
            value={selected as SectionMenuValue}
            options={entries}
            onSelect={choose}
          />
        )}
      </View>
    </View>
  );
};
