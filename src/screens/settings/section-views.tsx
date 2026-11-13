import { usePreventRemove } from "@react-navigation/native";
import type { NavigationAction } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";

import { AdvancedSettings } from "../../components/advanced-settings";
import { ShellIcon } from "../../components/shell-icon";
import type { Client } from "../../lib/client";
import { useTheme } from "../../lib/theme";
import { useHasUnsavedChanges, useUnsavedGuard } from "../../lib/unsaved";
import { Accounts } from "./accounts";
import { AppearanceSettings } from "./appearance-settings";
import { Configuration } from "./configuration";
import { Mcp } from "./mcp";
import { Models } from "./models";
import { Permissions } from "./permissions";
import { Plugins } from "./plugins";
import type { Section, ModelCatalog } from "./sections";
import { HeaderRefreshContext } from "./shared";
import type { HeaderRefresh } from "./shared";
import { Skills } from "./skills";
import type { SettingsStackParams } from "./stack";

export const SettingsSection = ({
  client,
  modelCatalog,
  directory,
  section,
}: {
  client?: Client;
  modelCatalog?: ModelCatalog;
  directory: string;
  section: Section;
}) => {
  if (section === "Look and feel") {
    return (
      <View key={`${directory}:${section}`} style={{ flex: 1 }}>
        <AppearanceSettings />
      </View>
    );
  }
  if (section === "Models") {
    return modelCatalog ? (
      <View key={`${directory}:${section}`} style={{ flex: 1 }}>
        <Models catalog={modelCatalog} client={client} directory={directory} />
      </View>
    ) : null;
  }
  if (!client) {
    return null;
  }
  return (
    <View key={`${directory}:${section}`} style={{ flex: 1 }}>
      {section === "Accounts" && (
        <Accounts client={client} directory={directory} />
      )}
      {section === "MCP" && <Mcp client={client} directory={directory} />}
      {section === "Config" && (
        <Configuration client={client} directory={directory} />
      )}
      {section === "Skills" && <Skills client={client} directory={directory} />}
      {section === "Plugins" && (
        <Plugins client={client} directory={directory} />
      )}
      {section === "Permissions" && (
        <Permissions client={client} directory={directory} />
      )}
      {section === "Advanced" && (
        <AdvancedSettings client={client} directory={directory} />
      )}
    </View>
  );
};

export const NativeSettingsSection = ({
  client,
  modelCatalog,
  directory,
  section,
  navigation,
}: {
  client?: Client;
  modelCatalog?: ModelCatalog;
  directory: string;
  section: Section;
  navigation: NativeStackScreenProps<
    SettingsStackParams,
    "Section"
  >["navigation"];
}) => {
  const { colors } = useTheme();
  const [headerRefresh, setHeaderRefresh] = useState<HeaderRefresh>(null);
  const confirmNavigation = useUnsavedGuard(`configuration:${directory}`);
  const hasUnsavedConfiguration = useHasUnsavedChanges(
    `configuration:${directory}`
  );
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(
    null
  );
  const prompting = useRef(false);
  usePreventRemove(
    section === "Config" && hasUnsavedConfiguration && !pendingAction,
    ({ data }) => {
      if (prompting.current) {
        return;
      }
      prompting.current = true;
      void confirmNavigation().then((leave) => {
        prompting.current = false;
        if (leave) {
          setPendingAction(data.action);
        }
        return leave;
      });
    }
  );
  useEffect(() => {
    if (pendingAction) {
      navigation.dispatch(pendingAction);
    }
  }, [navigation, pendingAction]);
  useEffect(() => {
    navigation.setOptions({
      headerRight: headerRefresh?.refresh
        ? () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refresh"
              accessibilityState={{
                busy: headerRefresh.loading,
                disabled: headerRefresh.loading,
              }}
              disabled={headerRefresh.loading}
              onPress={() => headerRefresh.refresh?.()}
              style={{
                alignItems: "center",
                height: 44,
                justifyContent: "center",
                marginEnd: Platform.OS === "android" ? -16 : 0,
                width: 44,
              }}
            >
              {headerRefresh.loading ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <ShellIcon name="refresh" color={colors.text} />
              )}
            </Pressable>
          )
        : undefined,
    });
  }, [colors, headerRefresh, navigation]);
  return (
    <HeaderRefreshContext.Provider value={setHeaderRefresh}>
      <SettingsSection
        client={client}
        modelCatalog={modelCatalog}
        directory={directory}
        section={section}
      />
    </HeaderRefreshContext.Provider>
  );
};
