import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { Markdown } from "../../src/components/markdown";
import { Patch } from "../../src/components/patch";
import { Button } from "../../src/components/ui";
import { BetaLayoutContext } from "../../src/lib/beta-layout";
import { SheetCoordinatorProvider } from "../../src/lib/sheets";
import { ThemeProvider, useTheme } from "../../src/lib/theme";
import { UnsavedProvider } from "../../src/lib/unsaved";
import { ChatScreen } from "../../src/screens/chat-screen";
import { AppearanceSettings } from "../../src/screens/settings-screen";

const noop = () => {};
const model = {
  capabilities: {},
  cost: { input: 0, output: 0 },
  enabled: true,
  id: "demo-model",
  limit: { context: 200_000, output: 32_000 },
  name: "Sample Model",
  providerID: "openai",
  variants: ["low", "medium", "high", "xhigh"].map((id) => ({ id })),
};
const session = {
  agent: "build",
  id: "visual-42",
  location: { directory: "/sample" },
  model: { id: model.id, providerID: model.providerID, variant: "medium" },
  time: { created: 1, updated: 1 },
  title: "Picker spacing comparison",
  tokens: { cache: { read: 0, write: 0 }, input: 0, output: 0, reasoning: 0 },
};
const backend: any = {
  capabilities: { defaultVariant: true },
  core: {
    message: { list: async () => ({ cursor: {}, data: [] }) },
    model: { list: async () => ({ data: [model] }) },
    session: {
      active: async () => ({}),
      compact: async () => {},
      fork: async () => {},
      get: async () => session,
      interrupt: async () => {},
      prompt: async () => {},
      switchModel: async () => {},
      update: async () => {},
    },
  },
  kind: "pi",
  async *subscribe({ signal }: { signal?: AbortSignal }) {
    await new Promise<void>((resolve) => {
      if (signal?.aborted) {
        resolve();
      } else {
        signal?.addEventListener("abort", () => resolve(), { once: true });
      }
    });
  },
};
function Content() {
  const { colors } = useTheme();
  const [screen, setScreen] = useState<"chat" | "appearance" | "content">(
    "chat"
  );
  return (
    <View style={{ backgroundColor: colors.bg, flex: 1, paddingTop: 56 }}>
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
    IBMPlexMono: require("../../assets/fonts/IBMPlexMono-Text.ttf"),
    Inter: require("../../assets/fonts/Inter.ttf"),
  });
  if (!ready) {
    return null;
  }
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
