import type { ModelInfo } from "@opencode/client";
import { useMemo, useState } from "react";

import type { useModelPreferences } from "../../lib/model-preferences";
import { groupModels } from "./model-groups";
import { composerModelLabel } from "./model-label";
import type { CoreClient } from "./session-sync";
import type { SetPanel } from "./types";
import type { SessionState } from "./use-session-state";

interface UseModelSelectionOptions {
  client: CoreClient;
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

const modelKey = (model: StagedModel) =>
  `${model.providerID}/${model.id}/${model.variant ?? ""}`;

export const useModelSelection = ({
  client,
  defaultModel,
  modelPreferences,
  sessionID,
  setPanel,
  showError,
  sync,
}: UseModelSelectionOptions) => {
  const { session, models, providers } = sync;
  const [, setRevision] = useState(0);
  const sessionModelKey = session?.model ? modelKey(session.model) : undefined;
  const pick = stagedModels.get(sessionID);
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
    setRevision((value) => value + 1);
    if (closePanel) {
      setPanel(null);
    }
    try {
      await modelPreferences.recordRecent(model.providerID, model.id);
    } catch (error) {
      showError(error);
    }
  };
  const commitModel = async () => {
    const stagedPick = stagedModels.get(sessionID);
    if (!stagedPick) {
      return;
    }
    if (modelKey(stagedPick) !== sessionModelKey) {
      await client.session.switchModel({ model: stagedPick, sessionID });
    }
    stagedModels.delete(sessionID);
    setRevision((value) => value + 1);
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
