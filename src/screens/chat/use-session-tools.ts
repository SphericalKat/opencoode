import type {
  FileDiffInfo,
  SessionInfo,
  SessionMessageInfo,
} from "@opencode/client";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Platform, Share } from "react-native";

import { settle } from "../../lib/async";
import type { useNativePresentation } from "../../lib/sheets";
import type { OpenCodeClient, Capabilities } from "./session-sync";
import type { Alive, SetPanel } from "./types";
import type { RunAction } from "./use-run-action";

interface UseSessionToolsOptions {
  alive: Alive;
  capabilities: Capabilities;
  opencodeClient: OpenCodeClient;
  run: RunAction;
  session: SessionInfo | null;
  sessionID: string;
  setPanel: SetPanel;
  showError: (reason: unknown) => void;
  withNativePresentation: ReturnType<typeof useNativePresentation>;
}

export const useSessionTools = ({
  alive,
  capabilities,
  opencodeClient,
  run,
  session,
  sessionID,
  setPanel,
  showError,
  withNativePresentation,
}: UseSessionToolsOptions) => {
  const [diffs, setDiffs] = useState<FileDiffInfo[]>([]);
  const [context, setContext] = useState<SessionMessageInfo[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const inspect = async (target: "diff" | "context") => {
    if (!opencodeClient || !capabilities[target]) {
      return;
    }
    setPanel(target);
    setPanelLoading(true);
    await settle(
      async () => {
        if (target === "diff") {
          const value = await opencodeClient.session.diff({ sessionID });
          if (alive.current) {
            setDiffs(value);
          }
        } else {
          const value = await opencodeClient.session.context({ sessionID });
          if (alive.current) {
            setContext(value);
          }
        }
      },
      showError,
      () => {
        if (alive.current) {
          setPanelLoading(false);
        }
      }
    );
  };

  const exportSession = () =>
    run(async () => {
      if (!opencodeClient || !capabilities.export) {
        return;
      }
      const value = await opencodeClient.experimental.session.export({
        sessionID,
      });
      const content = JSON.stringify(value, null, 2);
      const filename = `${sessionID.replaceAll(/[^a-zA-Z0-9_-]/gu, "_")}.json`;
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(
          new Blob([content], { type: "application/json" })
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        const file = new File(Paths.cache, filename);
        await file.write(content);
        await ((await Sharing.isAvailableAsync())
          ? withNativePresentation(() =>
              Sharing.shareAsync(file.uri, {
                dialogTitle: session?.title || "OpenCode session",
                mimeType: "application/json",
              })
            )
          : withNativePresentation(() =>
              Share.share({
                message: content,
                title: session?.title || "OpenCode session",
              })
            ));
      }
    });

  return { context, diffs, exportSession, inspect, panelLoading };
};
