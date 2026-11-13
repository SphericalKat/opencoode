import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import React, { useState } from "react";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import IBMPlexMono from "../../assets/fonts/IBMPlexMono-Text.ttf";
import Inter from "../../assets/fonts/Inter.ttf";
import { Markdown } from "../../src/components/markdown";
import { Patch } from "../../src/components/patch";
import { Button } from "../../src/components/ui";
import type { ChatBackend } from "../../src/lib/chat-backend";
import { SheetCoordinatorProvider } from "../../src/lib/sheets";
import { ThemeProvider, useTheme } from "../../src/lib/theme";
import { UnsavedProvider } from "../../src/lib/unsaved";
import { ChatScreen } from "../../src/screens/chat-screen";
import { AppearanceSettings } from "../../src/screens/settings-screen";

const noop = () => {
  // The fixture ignores session navigation.
};
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
const backend = {
  capabilities: { defaultVariant: true },
  core: {
    message: { list: () => Promise.resolve({ cursor: {}, data: [] }) },
    model: { list: () => Promise.resolve({ data: [model] }) },
    session: {
      active: () => Promise.resolve({}),
      compact: () => Promise.resolve(),
      fork: () => Promise.resolve(),
      get: () => Promise.resolve(session),
      interrupt: () => Promise.resolve(),
      prompt: () => Promise.resolve(),
      switchModel: () => Promise.resolve(),
      update: () => Promise.resolve(),
    },
  },
  kind: "pi",
  async *subscribe({ signal }: { signal?: AbortSignal }) {
    const { promise, resolve } = Promise.withResolvers<undefined>();
    if (signal?.aborted) {
      resolve(undefined);
    } else {
      signal?.addEventListener("abort", () => resolve(undefined), {
        once: true,
      });
    }
    await promise;
    yield* [];
  },
} as unknown as ChatBackend;
const Content = () => {
  const { colors } = useTheme();
  const [screen, setScreen] = useState<"chat" | "appearance" | "content">(
    "chat"
  );
  let body: ReactNode;
  if (screen === "chat") {
    body = (
      <ChatScreen
        backend={backend}
        sessionID={session.id}
        serverID="visual-42"
        onSessionChanged={noop}
        onOpenSession={noop}
      />
    );
  } else if (screen === "appearance") {
    body = <AppearanceSettings />;
  } else {
    body = (
      <ScrollView>
        <Markdown
          text={
            '```javascript\nconst message = "hello";\nconsole.log(message);\n```'
          }
        />
        <Patch patch={"@@ -1,2 +1,2 @@\n context\n-old text\n+new text\n"} />
      </ScrollView>
    );
  }
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
      {body}
    </View>
  );
};
const Demo = () => {
  const [ready] = useFonts({
    IBMPlexMono,
    Inter,
  });
  if (!ready) {
    return null;
  }
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider>
          <SheetCoordinatorProvider>
            <UnsavedProvider>
              <Content />
            </UnsavedProvider>
          </SheetCoordinatorProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
};
registerRootComponent(Demo);
