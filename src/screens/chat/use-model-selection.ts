import type { ModelInfo } from "@opencode/client";
import { useMemo, useState, useSyncExternalStore } from "react";

import type { useModelPreferences } from "../../lib/model-preferences";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import { groupModels } from "./model-groups";
import { composerModelLabel } from "./model-label";
import type { CoreClient } from "./session-sync";
import type { SetPanel } from "./types";
import { useChatMutation } from "./use-chat-mutation";
import type { ChatMutationContext } from "./use-chat-mutation";
import type { SessionState } from "./use-session-state";

interface UseModelSelectionOptions {
  client: CoreClient;
  context: ChatMutationContext;
  defaultModel: ModelInfo | null;
  modelPreferences: ReturnType<typeof useModelPreferences>;
  sessionID: string;
  setPanel: SetPanel;
  showError: (reason: unknown) => void;
  sync: SessionState;
}

interface StagedModel {
  id: string;
  providerID: string;
  variant?: string;
}

const stagedModels = new Map<string, StagedModel>();

const stagedListeners = new Set<() => void>();

const subscribeStaged = (listener: () => void) => {
  stagedListeners.add(listener);
  return () => {
    stagedListeners.delete(listener);
  };
};

const notifyStaged = () => {
  for (const listener of stagedListeners) {
    listener();
  }
};

const modelKey = (model: StagedModel) =>
  `${model.providerID}/${model.id}/${model.variant ?? ""}`;

export const useModelSelection = ({
  client,
  context,
  defaultModel,
  modelPreferences,
  sessionID,
  setPanel,
  showError,
  sync,
}: UseModelSelectionOptions) => {
  const { session, models, providers } = sync;
  const scope = useServerScope();
  const pick = useSyncExternalStore(subscribeStaged, () =>
    stagedModels.get(sessionID)
  );
  const switchModel = useChatMutation(context, {
    invalidate: () => [queryKeys.session.detail(scope, sessionID)],
    mutationFn: (model: StagedModel) =>
      client.session.switchModel({ model, sessionID }),
  });
  const sessionModelKey = session?.model ? modelKey(session.model) : undefined;
  const staged = pick && modelKey(pick) !== sessionModelKey ? pick : undefined;
  const selected = staged ?? session?.model;
  const [modelSearch, setModelSearch] = useState("");
  const selectedModelID = selected?.id;
  const selectedProviderID = selected?.providerID;
  const selectedModel = useMemo(
    () =>
      models.find(
        (model) =>
          model.id === selectedModelID &&
          model.providerID === selectedProviderID
      ),
    [models, selectedModelID, selectedProviderID]
  );
  const hasSelectedModel = !!selectedModelID;
  const currentModel =
    selectedModel ??
    (hasSelectedModel ? undefined : (defaultModel ?? undefined));
  const selectedVariant = selected?.variant;
  const labelSource =
    currentModel ??
    (selectedModelID && selectedProviderID
      ? { name: selectedModelID, providerID: selectedProviderID }
      : undefined);
  const providerLabel = labelSource
    ? composerModelLabel(labelSource, providers).provider
    : undefined;
  const enabledModels = useMemo(
    () => models.filter((model) => model.enabled),
    [models]
  );
  const { favoriteIDs, recentIDs } = modelPreferences;
  const modelGroups = useMemo(
    () =>
      groupModels({
        favoriteIDs,
        models: enabledModels,
        providers,
        recentIDs,
        search: modelSearch,
      }),
    [enabledModels, favoriteIDs, modelSearch, providers, recentIDs]
  );
  const chooseModel = async (
    model: ModelInfo,
    variant?: string,
    closePanel = false
  ) => {
    stagedModels.set(sessionID, {
      id: model.id,
      providerID: model.providerID,
      ...(variant === undefined ? {} : { variant }),
    });
    notifyStaged();
    if (closePanel) {
      setPanel(null);
    }
    try {
      await modelPreferences.recordRecent(model.providerID, model.id);
    } catch (error) {
      showError(error);
    }
  };
  // Returns false when the switch failed or was dropped, so the caller must
  // not send the message.
  const commitModel = async (): Promise<boolean> => {
    const stagedPick = stagedModels.get(sessionID);
    if (!stagedPick) {
      return true;
    }
    if (modelKey(stagedPick) !== sessionModelKey) {
      const switched = await switchModel.run(stagedPick);
      if (!switched) {
        return false;
      }
    }
    stagedModels.delete(sessionID);
    notifyStaged();
    return true;
  };
  return {
    chooseModel,
    commitModel,
    currentModel,
    enabledModels,
    modelGroups,
    modelSearch,
    providerLabel,
    selectedVariant,
    setModelSearch,
  };
};
