import { HeaderBackButton } from "@react-navigation/elements";
import {
  BaseNavigationContainer,
  DefaultTheme,
} from "@react-navigation/native";
import type { NavigationContainerRefWithCurrent } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useMemo } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";

import { useMotionPreference } from "../../components/motion";
import { ShellIcon } from "../../components/shell-icon";
import { BodyText } from "../../components/ui";
import type { Client } from "../../lib/client";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { NativeSettingsSection } from "./section-views";
import { sectionDescriptions, sectionGroups } from "./sections";
import type { Section, ModelCatalog } from "./sections";
import { SettingsStack, nativeBackInsets } from "./stack";
import type { SettingsStackParams } from "./stack";
import { createStyles } from "./styles";

const SettingsBackImage = ({ tintColor }: { tintColor: string }) => (
  <ShellIcon name="back" color={tintColor} size={22} />
);

const SettingsBackButton = ({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) => {
  const { colors } = useTheme();
  // The stock iOS image reserves label space even in icon-only mode.
  return (
    <HeaderBackButton
      displayMode="minimal"
      accessibilityLabel={`Back to ${label}`}
      onPress={onPress}
      tintColor={colors.text}
      style={nativeBackInsets}
      backImage={Platform.OS === "ios" ? SettingsBackImage : undefined}
    />
  );
};

export const SettingsIndex = ({
  onSelect,
  sections,
  selected,
  onManageServers,
  serverLabel,
}: {
  onSelect: (section: Section) => void;
  sections: Section[];
  selected: Section | null;
  onManageServers?: () => void;
  serverLabel?: string;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <ScrollView contentContainerStyle={styles.index}>
      {sectionGroups.map((group) => {
        const items = group.items.filter((item) => sections.includes(item));
        const manageServers = group.title === "Connections" && onManageServers;
        if (!items.length && !manageServers) {
          return null;
        }
        return (
          <View key={group.title} style={styles.group}>
            {!(items.length === 1 && items[0] === group.title) && (
              <BodyText muted style={styles.groupTitle}>
                {group.title.toUpperCase()}
              </BodyText>
            )}
            <View style={styles.groupPanel}>
              {manageServers && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Servers. Scan a QR code, paste a link, or switch servers"
                  onPress={onManageServers}
                  style={({ pressed }) => [
                    styles.sectionRow,
                    pressed && { backgroundColor: colors.raised },
                  ]}
                >
                  <View style={styles.detail}>
                    <BodyText style={styles.sectionName}>Servers</BodyText>
                    <BodyText muted style={styles.sectionDescription}>
                      {serverLabel
                        ? `${serverLabel} · Scan or paste a link`
                        : "Scan, paste a link, or switch servers"}
                    </BodyText>
                  </View>
                  <ShellIcon name="chevron" size={16} color={colors.muted} />
                </Pressable>
              )}
              {items.map((item, index) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item}. ${sectionDescriptions[item]}`}
                  accessibilityState={{ selected: selected === item }}
                  aria-current={selected === item ? "page" : undefined}
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [
                    styles.sectionRow,
                    pressed && { backgroundColor: colors.raised },
                  ]}
                >
                  {(index > 0 || !!manageServers) && (
                    <View pointerEvents="none" style={styles.sectionDivider} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <BodyText style={styles.sectionName}>{item}</BodyText>
                    <BodyText
                      muted
                      numberOfLines={1}
                      style={styles.sectionDescription}
                    >
                      {sectionDescriptions[item]}
                    </BodyText>
                  </View>
                  <ShellIcon name="chevron" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

export type SettingsNavigationRef =
  NavigationContainerRefWithCurrent<SettingsStackParams>;
type SectionScreenProps = NativeStackScreenProps<
  SettingsStackParams,
  "Section"
>;

const renderBackButton = (label: string, onPress: () => void) => (
  <SettingsBackButton label={label} onPress={onPress} />
);

const indexScreenOptions = ({
  backLabel,
  onBack,
}: {
  backLabel?: string;
  onBack?: () => void;
}) => ({
  headerLeft: onBack
    ? () => renderBackButton(backLabel || "Sessions", onBack)
    : undefined,
  title: "Settings",
});

const sectionScreenOptions = ({
  route,
  navigation,
}: Pick<SectionScreenProps, "navigation" | "route">) => ({
  headerBackButtonDisplayMode: "minimal" as const,
  title: route.params.section,
  ...(Platform.OS === "android"
    ? {
        headerBackVisible: false,
        headerLeft: () =>
          renderBackButton("Settings", () => navigation.goBack()),
      }
    : {}),
});

export const SettingsNativeStack = ({
  availableSections,
  backLabel,
  client,
  directory,
  modelCatalog,
  navigationRef,
  onBack,
  onReady,
  renderIndex,
}: {
  availableSections: Section[];
  backLabel?: string;
  client?: Client;
  directory: string;
  modelCatalog?: ModelCatalog;
  navigationRef: SettingsNavigationRef;
  onBack?: () => void;
  onReady: () => void;
  renderIndex: () => React.ReactElement;
}) => {
  const { colors, scheme } = useTheme();
  const reducedMotion = useMotionPreference();
  const navigationTheme = useMemo(
    () => ({
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: colors.bg,
        border: colors.border,
        card: colors.panel,
        notification: colors.danger,
        primary: colors.accent,
        text: colors.text,
      },
      dark: scheme === "dark",
    }),
    [colors, scheme]
  );
  return (
    <BaseNavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={onReady}
      onStateChange={onReady}
    >
      <SettingsStack.Navigator
        screenOptions={{
          animation: reducedMotion ? "fade" : "default",
          contentStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: {
            color: colors.text,
            fontFamily: "Inter",
            fontSize: 18,
            fontWeight: "600",
          },
        }}
      >
        <SettingsStack.Screen
          name="Index"
          options={indexScreenOptions({ backLabel, onBack })}
        >
          {renderIndex}
        </SettingsStack.Screen>
        <SettingsStack.Screen name="Section" options={sectionScreenOptions}>
          {({ route, navigation: screenNavigation }) =>
            availableSections.includes(route.params.section) ? (
              <NativeSettingsSection
                client={client}
                modelCatalog={modelCatalog}
                directory={directory}
                section={route.params.section}
                navigation={screenNavigation}
              />
            ) : null
          }
        </SettingsStack.Screen>
      </SettingsStack.Navigator>
    </BaseNavigationContainer>
  );
};
