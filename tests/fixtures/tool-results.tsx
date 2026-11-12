import type { SessionMessageAssistant } from "@opencode/client";
import { registerRootComponent } from "expo";
import { useFonts } from "expo-font";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AssistantTurn } from "../../src/components/AssistantTurn";
import { projectLiveEvent } from "../../src/lib/chat";
import { makeOpenCodeChatBackend } from "../../src/lib/chatBackend";
import { createClient } from "../../src/lib/client";
import { makePiChatBackend } from "../../src/lib/piChatBackend";
import { createPiClient } from "../../src/lib/piClient";
import { SheetCoordinatorProvider } from "../../src/lib/sheets";
import { ThemeProvider } from "../../src/lib/theme";

// Browser fixture renders the production conversation components; no app route is added.
Object.assign(globalThis, {
  createClient,
  createPiClient,
  makeOpenCodeChatBackend,
  makePiChatBackend,
  projectLiveEvent,
});
const png =
  (globalThis as typeof globalThis & { fixtureImage?: string }).fixtureImage ||
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
function Demo() {
  const [mime, setMime] = useState("image/png");
  useEffect(() => {
    const update = () => setMime("image/jpeg");
    addEventListener("fixture-mime", update);
    return () => removeEventListener("fixture-mime", update);
  }, []);
  const [fontsReady] = useFonts({
    IBMPlexMono: require("../../assets/fonts/IBMPlexMono-Text.ttf"),
    Inter: require("../../assets/fonts/Inter.ttf"),
  });
  const scenario =
    new URLSearchParams(location.search).get("scenario") || "single";
  const files =
    scenario === "multiple"
      ? ["First.png", "Second.png", "Third.png"]
      : ["Screenshot.png"];
  const message: SessionMessageAssistant = {
    agent: "build",
    content: [
      {
        id: "capture",
        name: "screenshot",
        state: {
          content: [
            { text: "Screenshot captured successfully", type: "text" },
            ...files.map((name) => ({
              mime,
              name,
              type: "file" as const,
              uri: ["unavailable", "loading", "undecodable"].includes(scenario)
                ? `${location.origin}/fixture-image.png`
                : `data:image/png;base64,${png}`,
            })),
            {
              mime: "text/plain",
              name: "report.txt",
              type: "file",
              uri: "data:text/plain,report",
            },
          ],
          input: {},
          status: "completed",
        },
        time: { created: 1 },
        type: "tool",
      },
      { text: "The screenshot is ready for review.", type: "text" },
    ],
    id: "assistant",
    model: { id: "model", providerID: "provider" },
    time: { created: 1 },
    type: "assistant",
  };
  if (scenario === "tools") {
    const first = message.content[0];
    if (first.type === "tool") {
      message.content.splice(1, 0, {
        ...first,
        id: "read",
        name: "read",
        state: {
          ...first.state,
          content: [
            {
              mime: "image/png",
              name: "Result.png",
              type: "file",
              uri: `data:image/png;base64,${png}`,
            },
          ],
          input: { path: "/project/result.png" },
          status: "completed",
        },
      });
    }
  }
  if (!fontsReady) {
    return null;
  }
  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        <ThemeProvider>
          <SheetCoordinatorProvider>
            <View
              style={{
                backgroundColor: "#171717",
                minHeight: "100%",
                padding: 16,
              }}
            >
              <AssistantTurn
                turn={{
                  id: "turn",
                  messages: [message],
                  type: "assistant-turn",
                }}
                animate={false}
                directory="/project"
                renderSource={(_message, key, content) => (
                  <View key={key}>{content}</View>
                )}
              />
            </View>
          </SheetCoordinatorProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
registerRootComponent(Demo);
