import "../lib/install-fetch";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ibmPlexMonoMediumFont from "../../assets/fonts/IBMPlexMono-Medium.ttf";
import ibmPlexMonoFont from "../../assets/fonts/IBMPlexMono-Text.ttf";
import interFont from "../../assets/fonts/Inter.ttf";
import { LiveStoreProvider } from "../lib/live-store";
import { ServerScopeProvider } from "../lib/server-scope";
import { useSheetCoordinator } from "../lib/sheets";
import { useTheme, useThemedStyles } from "../lib/theme";
import { useUnsavedGuard } from "../lib/unsaved";
import { AppServersSheet } from "../shell/app-sheets";
import { AppProviders } from "../shell/providers";
import { createStyles } from "../shell/styles";
import { ThemedStatusBar } from "../shell/themed-status-bar";
import { useConnection } from "../shell/use-connection";
import { useConnectionRecovery } from "../shell/use-connection-recovery";
import { useNavigationSheets } from "../shell/use-navigation-sheets";
import { useShellRoute } from "../shell/use-shell-view";
import { useConnectionStore } from "../stores/connection-store";

const fonts = {
  IBMPlexMono: ibmPlexMonoFont,
  "IBMPlexMono-Medium": ibmPlexMonoMediumFont,
  Inter: interFont,
};

const ShellRoot = () => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const confirmNavigation = useUnsavedGuard();
  const { suspendSheets, resumeSheets } = useSheetCoordinator();
  const { framed } = useShellRoute();
  const active = useConnectionStore((state) => state.active);
  const booting = useConnectionStore((state) => state.booting);

  // The Servers sheet and the recovery hook serve both backends, so they live
  // here. The OpenCode layout runs its own copies of the navigation hooks.
  useConnection({ confirmNavigation });
  const { showNavigationSheet } = useNavigationSheets({
    client: null,
    resumeSheets,
    suspendSheets,
  });
  useConnectionRecovery({ resumeSheets, showNavigationSheet });

  const openCode = !!active && active.backend !== "pi";
  return (
    <ServerScopeProvider scope={active?.id ?? null}>
      <LiveStoreProvider>
        <SafeAreaView
          style={[styles.safe, framed && { backgroundColor: colors.frame }]}
          edges={["top", "left", "right", "bottom"]}
        >
          <Stack screenOptions={{ animation: "none", headerShown: false }}>
            <Stack.Protected guard={booting}>
              <Stack.Screen name="restoring" />
            </Stack.Protected>
            <Stack.Protected guard={!booting && !active}>
              <Stack.Screen name="welcome" />
            </Stack.Protected>
            <Stack.Protected guard={!booting && openCode}>
              <Stack.Screen name="(opencode)" />
            </Stack.Protected>
            <Stack.Protected guard={!booting && active?.backend === "pi"}>
              <Stack.Screen name="pi" />
            </Stack.Protected>
          </Stack>
          <AppServersSheet onResumeSheets={resumeSheets} />
        </SafeAreaView>
      </LiveStoreProvider>
    </ServerScopeProvider>
  );
};

const RootLayout = () => {
  const [fontsReady, fontError] = useFonts(fonts);
  if (!fontsReady && !fontError) {
    return <View style={{ backgroundColor: "#080808", flex: 1 }} />;
  }
  return (
    <AppProviders>
      <ThemedStatusBar />
      <ShellRoot />
    </AppProviders>
  );
};

export default RootLayout;
