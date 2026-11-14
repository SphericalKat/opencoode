import type { ProviderInfo } from "@opencode/client";

const providerLabels = new Map([
  ["openai", "OpenAI"],
  ["openai-codex", "OpenAI Codex"],
]);

const NATIVE_PROVIDER_ID = "opencode";

export const modelDisplayName = (name: string) =>
  name.replace("(latest)", "").trim();

export const capitalizeFirst = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

// OpenCode's own models show no provider, because the provider adds nothing.
export const composerModelLabel = (
  model: { providerID: string; name: string },
  providers: Pick<ProviderInfo, "id" | "name">[]
): { provider?: string; model: string } => {
  const name = modelDisplayName(model.name);
  if (model.providerID === NATIVE_PROVIDER_ID) {
    return { model: name };
  }
  const provider =
    providers.find((item) => item.id === model.providerID)?.name ||
    providerLabels.get(model.providerID) ||
    model.providerID
      .replaceAll(/[-_]/gu, " ")
      .replaceAll(/\b\w/gu, (letter) => letter.toUpperCase());
  return { model: name, provider: provider || undefined };
};
