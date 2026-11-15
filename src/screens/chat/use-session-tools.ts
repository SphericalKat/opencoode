import type {
  FileDiffInfo,
  SessionInfo,
  SessionMessageInfo,
} from "@opencode/client";
import { useQuery } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useEffect } from "react";
import { Platform, Share } from "react-native";

import {
  sessionContextOptions,
  sessionDiffOptions,
} from "../../lib/queries/panels";
import { useServerScope } from "../../lib/server-scope";
import type { useNativePresentation } from "../../lib/sheets";
import type { OpenCodeClient, Capabilities } from "./session-sync";
import type { Alive, Panel, SetPanel } from "./types";
import { useChatMutation } from "./use-chat-mutation";
import type { ChatMutationContext } from "./use-chat-mutation";

const NO_DIFFS: FileDiffInfo[] = [];
const NO_CONTEXT: SessionMessageInfo[] = [];

interface UseSessionToolsOptions {
  alive: Alive;
  capabilities: Capabilities;
  context: ChatMutationContext;
  opencodeClient: OpenCodeClient;
  panel: Panel;
  session: SessionInfo | null;
  sessionID: string;
  setPanel: SetPanel;
  showError: (reason: unknown) => void;
  withNativePresentation: ReturnType<typeof useNativePresentation>;
}

export const useSessionTools = ({
  capabilities,
  context: mutationContext,
  opencodeClient,
  panel,
  session,
  sessionID,
  setPanel,
  showError,
  withNativePresentation,
}: UseSessionToolsOptions) => {
  const scope = useServerScope();
  const canInspect = (target: "diff" | "context") =>
    !!opencodeClient && capabilities[target];
  const diff = useQuery({
    ...sessionDiffOptions(scope, opencodeClient, sessionID),
    enabled: panel === "diff" && canInspect("diff"),
  });
  const context = useQuery({
    ...sessionContextOptions(scope, opencodeClient, sessionID),
    enabled: panel === "context" && canInspect("context"),
  });
  const { error: diffError, errorUpdatedAt: diffErrorAt } = diff;
  const { error: contextError, errorUpdatedAt: contextErrorAt } = context;
  useEffect(() => {
    if (diffError && diffErrorAt) {
      showError(diffError);
    }
  }, [diffError, diffErrorAt, showError]);
  useEffect(() => {
    if (contextError && contextErrorAt) {
      showError(contextError);
    }
  }, [contextError, contextErrorAt, showError]);
  const inspect = (target: "diff" | "context") => {
    if (canInspect(target)) {
      setPanel(target);
    }
  };
  const exporting = useChatMutation(mutationContext, {
    invalidate: () => [],
    mutationFn: async () => {
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
    },
  });
  let panelLoading = false;
  if (panel === "diff") {
    panelLoading = diff.isFetching;
  } else if (panel === "context") {
    panelLoading = context.isFetching;
  }
  return {
    context: context.data ?? NO_CONTEXT,
    diffs: diff.data ?? NO_DIFFS,
    exportSession: () => exporting.run(),
    inspect,
    panelLoading,
  };
};
