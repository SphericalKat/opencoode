import type { ModelInfo } from "@opencode/client";
import { useMemo, useState } from "react";

import type { useModelPreferences } from "../../lib/model-preferences";
import { sortByPreference } from "./labels";
import { composerModelLabel } from "./model-label";
import type { CoreClient } from "./session-sync";
import type { RunAction } from "./use-run-action";
import type { SessionState } from "./use-session-state";

interface UseModelSelectionOptions {
  client: CoreClient;
  defaultModel: ModelInfo | null;
  modelPreferences: ReturnType<typeof useModelPreferences>;
  run: RunAction;
  sessionID: string;
  sync: SessionState;
}

export const useModelSelection = ({
  client,
  defaultModel,
  modelPreferences,
  run,
  sessionID,
  sync,
}: UseModelSelectionOptions) => {
  const { session, models, providers } = sync;
  const [modelSearch, setModelSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<
    "all" | "favorites" | "recent"
  >("all");
  const sessionModelID = session?.model?.id;
  const sessionProviderID = session?.model?.providerID;
  const sessionModel = useMemo(
    () =>
      models.find(
        (model) =>
          model.id === sessionModelID && model.providerID === sessionProviderID
      ),
    [models, sessionModelID, sessionProviderID]
  );
  const hasSessionModel = !!sessionModelID;
  const currentModel =
    sessionModel ?? (hasSessionModel ? undefined : (defaultModel ?? undefined));
  const selectedVariant = session?.model?.variant;
  const labelSource =
    currentModel ??
    (sessionModelID && sessionProviderID
      ? { name: sessionModelID, providerID: sessionProviderID }
      : undefined);
  const providerLabel = labelSource
    ? composerModelLabel(labelSource, providers).provider
    : undefined;
  const enabledModels = useMemo(
    () => models.filter((model) => model.enabled),
    [models]
  );
  const preferredIDs =
    modelFilter === "favorites"
      ? modelPreferences.favoriteIDs
      : modelPreferences.recentIDs;
  const scopedModels = useMemo(
    () =>
      modelFilter === "all"
        ? enabledModels
        : sortByPreference(enabledModels, preferredIDs),
    [enabledModels, modelFilter, preferredIDs]
  );
  const filteredModels = useMemo(
    () =>
      scopedModels.filter((model) =>
        `${model.name} ${model.providerID} ${model.id}`
          .toLowerCase()
          .includes(modelSearch.toLowerCase())
      ),
    [scopedModels, modelSearch]
  );
  const chooseModel = (
    model: ModelInfo,
    variant?: string,
    closePanel = false
  ) =>
    run(async () => {
      await client.session.switchModel({
        model: {
          id: model.id,
          providerID: model.providerID,
          ...(variant === undefined ? {} : { variant }),
        },
        sessionID,
      });
      await modelPreferences.recordRecent(model.providerID, model.id);
    }, closePanel);
  return {
    chooseModel,
    currentModel,
    enabledModels,
    filteredModels,
    modelFilter,
    modelSearch,
    providerLabel,
    scopedModels,
    selectedVariant,
    setModelFilter,
    setModelSearch,
  };
};
