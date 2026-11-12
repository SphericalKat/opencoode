import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Markdown } from "../../src/components/Markdown";
import { Patch } from "../../src/components/Patch";
import { Button } from "../../src/components/ui";
import { BetaLayoutContext } from "../../src/lib/betaLayout";
import { SheetCoordinatorProvider } from "../../src/lib/sheets";
import { ThemeProvider, useTheme } from "../../src/lib/theme";
import { UnsavedProvider } from "../../src/lib/unsaved";
import { ChatScreen } from "../../src/screens/ChatScreen";
import { AppearanceSettings } from "../../src/screens/SettingsScreen";
const noop = () => {};
const model = {
  id: "demo-model",
  providerID: "openai",
  name: "Sample Model",
  enabled: true,
  variants: ["low", "medium", "high", "xhigh"].map((id) => ({ id })),
  limit: { context: 200000, output: 32000 },
  capabilities: {},
  cost: { input: 0, output: 0 },
};
const session = {
  id: "visual-42",
  title: "Picker spacing comparison",
  agent: "build",
  location: { directory: "/sample" },
  model: { id: model.id, providerID: model.providerID, variant: "medium" },
  time: { created: 1, updated: 1 },
  tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
};
const backend: any = {
  subscribe: async function* ({ signal }: { signal?: AbortSignal }) {
    await new Promise<void>((resolve) => {
      if (signal?.aborted) resolve();
      else signal?.addEventListener("abort", () => resolve(), { once: true });
    });
  },
  kind: "pi",
  capabilities: { defaultVariant: true },
  core: {
    session: {
      get: async () => session,
      active: async () => ({}),
      switchModel: async () => {},
      update: async () => {},
      fork: async () => {},
      prompt: async () => {},
      interrupt: async () => {},
      compact: async () => {},
    },
    message: { list: async () => ({ data: [], cursor: {} }) },
    model: { list: async () => ({ data: [model] }) },
  },
};
function Content() {
  const { colors } = useTheme();
  const [screen, setScreen] = useState<"chat" | "appearance" | "content">(
    "chat"
  );
  return (
    <View style={{ flex: 1, paddingTop: 56, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          paddingHorizontal: 12,
        }}
      >
        <Button title="Chat fixture" onPress={() => setScreen("chat")} />
        <Button
          title="Appearance fixture"
          onPress={() => setScreen("appearance")}
        />
        <Button title="Content fixture" onPress={() => setScreen("content")} />
      </View>
      {screen === "chat" ? (
        <ChatScreen
          backend={backend}
          sessionID={session.id}
          serverID="visual-42"
          betaLayout={true}
          onSessionChanged={noop}
          onOpenSession={noop}
        />
      ) : screen === "appearance" ? (
        <AppearanceSettings />
      ) : (
        <ScrollView>
          <Markdown
            text={
              '```javascript\nconst message = "hello";\nconsole.log(message);\n```'
            }
          />
          <Patch patch={"@@ -1,2 +1,2 @@\n context\n-old text\n+new text\n"} />
        </ScrollView>
      )}
    </View>
  );
}
function Demo() {
  const [ready] = useFonts({
    Inter: require("../../assets/fonts/Inter.ttf"),
    IBMPlexMono: require("../../assets/fonts/IBMPlexMono-Text.ttf"),
  });
  if (!ready) return null;
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <BetaLayoutContext.Provider value={true}>
          <ThemeProvider>
            <SheetCoordinatorProvider>
              <UnsavedProvider>
                <Content />
              </UnsavedProvider>
            </SheetCoordinatorProvider>
          </ThemeProvider>
        </BetaLayoutContext.Provider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
registerRootComponent(Demo);
