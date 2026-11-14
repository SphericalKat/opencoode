import type { ModelInfo } from "@opencode/client";
import { useMemo, useState } from "react";

import type { useModelPreferences } from "../../lib/model-preferences";
import { sortByPreference } from "./labels";
import type { CoreClient } from "./session-sync";
import type { RunAction } from "./use-run-action";
import type { SessionState } from "./use-session-state";

const providerLabels = new Map([
  ["openai", "OpenAI"],
  ["openai-codex", "OpenAI Codex"],
]);

interface UseModelSelectionOptions {
  client: CoreClient;
  modelPreferences: ReturnType<typeof useModelPreferences>;
  run: RunAction;
  sessionID: string;
  sync: SessionState;
}

export const useModelSelection = ({
  client,
  modelPreferences,
  run,
  sessionID,
  sync,
}: UseModelSelectionOptions) => {
  const { session, models, providers, setSession } = sync;
  const [modelSearch, setModelSearch] = useState("");
  const [modelFilter, setModelFilter] = useState<
    "all" | "favorites" | "recent"
  >("all");
  const sessionModelID = session?.model?.id;
  const sessionProviderID = session?.model?.providerID;
  const currentModel = useMemo(
    () =>
      models.find(
        (model) =>
          model.id === sessionModelID && model.providerID === sessionProviderID
      ),
    [models, sessionModelID, sessionProviderID]
  );
  const providerID = currentModel?.providerID || sessionProviderID;
  const providerLabel =
    providers.find((provider) => provider.id === providerID)?.name ||
    (providerID ? providerLabels.get(providerID) : undefined) ||
    providerID
      ?.replaceAll(/[-_]/gu, " ")
      .replaceAll(/\b\w/gu, (letter) => letter.toUpperCase());
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
    // The server event and the optimistic update below keep the session in sync.
    // A full refresh would reload the message history on every model change.
    run(
      async () => {
        const previousModel = session?.model;
        const nextModel = {
          id: model.id,
          providerID: model.providerID,
          ...(variant === undefined ? {} : { variant }),
        };
        setSession((current) =>
          current ? { ...current, model: nextModel } : current
        );
        try {
          await client.session.switchModel({
            model: nextModel,
            sessionID,
          });
        } catch (error) {
          setSession((current) =>
            current?.model?.id === nextModel.id &&
            current.model.providerID === nextModel.providerID
              ? { ...current, model: previousModel }
              : current
          );
          throw error;
        }
        await modelPreferences.recordRecent(model.providerID, model.id);
      },
      closePanel,
      false
    );
  return {
    chooseModel,
    currentModel,
    enabledModels,
    filteredModels,
    modelFilter,
    modelSearch,
    providerLabel,
    scopedModels,
    setModelFilter,
    setModelSearch,
  };
};
