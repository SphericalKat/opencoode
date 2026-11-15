import type {
  GenerateImageResult,
  ModelInfo,
  UsageLimitsMeter,
} from "@opencode/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, {
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";
import { Image, Linking, Platform, ScrollView, Text, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { copyText } from "../lib/clipboard";
import {
  GENERATE_UNSUPPORTED,
  generateModelsOptions,
  isUnsupportedContent,
  usageLimitsOptions,
  webSearchProvidersOptions,
} from "../lib/queries/advanced";
import { useServerScope } from "../lib/server-scope";
import { externalURL } from "../lib/settings";
import { useNativePresentation } from "../lib/sheets";
import { useTheme } from "../lib/theme";
import { HeaderRefreshContext } from "../screens/settings/shared";
import { ListSheet } from "./list-sheet";
import type { ListSheetOption } from "./list-sheet";
import { SegmentedControl } from "./segmented-control";
import { SelectTrigger } from "./select";
import {
  Button,
  Busy,
  Card,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  Row,
  sans,
} from "./ui";

const DEFAULT_CHOICE = "default";
const MODEL_LIMIT = 30;

type ToolName = "Usage" | "Search" | "Generate";

const toolOptions: readonly ListSheetOption<string>[] = [
  { label: "Usage", value: "Usage" },
  { label: "Search", value: "Search" },
  { label: "Generate", value: "Generate" },
];

const generateKindOptions = [
  { label: "Text", value: "text" },
  { label: "Image", value: "image" },
] as const;

const modelKey = (item: ModelInfo) => `${item.providerID}/${item.id}`;

const SheetSelect = ({
  label,
  shown,
  value,
  options,
  onSelect,
}: {
  label: string;
  shown: string;
  value: string;
  options: readonly ListSheetOption<string>[];
  onSelect: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
      <SelectTrigger
        appearance="outline"
        indicator="sheet"
        value={shown}
        accessibilityLabel={`${label}: ${shown}`}
        expanded={open}
        onPress={() => setOpen(true)}
      />
      <ListSheet
        visible={open}
        title={label}
        options={options}
        value={value}
        onSelect={onSelect}
        onClose={() => setOpen(false)}
      />
    </View>
  );
};

const openLink = async (url: string) => {
  await Linking.openURL(externalURL(url));
};

const imageExtension = (mime: string) => {
  if (mime === "image/jpeg") {
    return "jpg";
  }
  if (mime === "image/webp") {
    return "webp";
  }
  return "png";
};

const saveImage = async (
  image: GenerateImageResult["images"][number],
  withNativePresentation: ReturnType<typeof useNativePresentation>
) => {
  const extension = imageExtension(image.mime);
  const filename = `opencoode-${Date.now()}.${extension}`;
  if (Platform.OS === "web") {
    const link = document.createElement("a");
    link.href = `data:${image.mime};base64,${image.data}`;
    link.download = filename;
    link.click();
  } else {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("File sharing is unavailable on this device");
    }
    const file = new File(Paths.cache, filename);
    try {
      await file.write(image.data, { encoding: "base64" });
      await withNativePresentation(() =>
        Sharing.shareAsync(file.uri, {
          dialogTitle: "Save or share image",
          mimeType: image.mime,
        })
      );
    } finally {
      if (file.exists) {
        await file.delete();
      }
    }
  }
};

const Meter = ({
  label,
  meter,
}: {
  label: string;
  meter: UsageLimitsMeter;
}) => {
  const { colors } = useTheme();
  const percent = Math.min(100, Math.max(0, meter.percent));
  return (
    <Card>
      <Row style={{ justifyContent: "space-between" }}>
        <BodyText>{label}</BodyText>
        <BodyText
          style={{ color: meter.limited ? colors.danger : colors.success }}
        >
          {Math.round(percent)}% used
        </BodyText>
      </Row>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ max: 100, min: 0, now: percent }}
        style={{
          backgroundColor: colors.raised,
          borderRadius: 3,
          height: 5,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            backgroundColor: meter.limited ? colors.danger : colors.success,
            height: 5,
            width: `${percent}%`,
          }}
        />
      </View>
      <BodyText muted>
        Resets {new Date(meter.resetsAt).toLocaleString()}
      </BodyText>
    </Card>
  );
};

const Usage = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  useTheme();
  const scope = useServerScope();
  const usage = useQuery(usageLimitsOptions(scope, client, directory));
  const [linkError, setLinkError] = useState<string | null>(null);
  const { data: info, isFetching: loading, refetch } = usage;
  let error = linkError;
  if (usage.error) {
    error = errorMessage(usage.error);
  }
  const load = async () => {
    setLinkError(null);
    await refetch();
  };
  const setHeaderRefresh = useContext(HeaderRefreshContext);
  const refreshUsage = useEffectEvent(() => {
    void load();
  });
  useEffect(() => {
    setHeaderRefresh?.({ loading, refresh: refreshUsage });
    return () => setHeaderRefresh?.(null);
  }, [setHeaderRefresh, loading]);
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, padding: 18 }}
    >
      <ErrorNotice
        error={error}
        onRetry={() => {
          void load();
        }}
      />
      {usage.isPending && <Busy />}
      {info && (
        <>
          <BodyText muted>{info.workspace.name || info.workspace.id}</BodyText>
          <Button
            title="Open usage dashboard"
            onPress={() => {
              void openLink(info.workspace.usageURL).catch((error_) =>
                setLinkError(errorMessage(error_))
              );
            }}
          />
          {info.go && (
            <>
              <Meter label="Rolling allowance" meter={info.go.rolling} />
              <Meter label="Weekly allowance" meter={info.go.weekly} />
              <Meter label="Monthly allowance" meter={info.go.monthly} />
            </>
          )}
          {info.budgets.map((budget) => (
            <Card key={budget.id}>
              <BodyText style={{ fontWeight: "600" }}>
                {budget.vendors.join(", ") || "Model budget"}
              </BodyText>
              <BodyText>
                ${budget.spent.toFixed(2)} of ${budget.limit.toFixed(2)}
              </BodyText>
              <BodyText muted>
                Resets {new Date(budget.resetsAt).toLocaleString()}
              </BodyText>
              {budget.models.map((model) => (
                <BodyText key={`${model.providerID}/${model.modelID}`} muted>
                  {model.name}
                  {model.spent === undefined
                    ? ""
                    : ` · $${model.spent.toFixed(2)}`}
                </BodyText>
              ))}
            </Card>
          ))}
        </>
      )}
      {info === null && (
        <Empty
          title="No usage information"
          detail="Your server does not expose usage limits for this account."
        />
      )}
    </ScrollView>
  );
};

const WebSearch = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const { colors } = useTheme();
  const scope = useServerScope();
  const providerList = useQuery(
    webSearchProvidersOptions(scope, client, directory)
  );
  const providers = providerList.data ?? [];
  const [provider, setProvider] = useState<string>();
  const [query, setQuery] = useState("");
  const request = useRef<AbortController | undefined>(undefined);
  const searchWeb = useMutation({
    mutationFn: async (input: {
      providerID: string | undefined;
      query: string;
      signal: AbortSignal;
    }) => {
      const result = await client.websearch.query(
        {
          location: { directory },
          providerID: input.providerID,
          query: input.query,
        },
        { signal: input.signal }
      );
      return result.data.results;
    },
  });
  const { isPending: busy, data: results } = searchWeb;
  const [linkError, setLinkError] = useState<string | null>(null);
  let error = linkError;
  if (searchWeb.error) {
    error = errorMessage(searchWeb.error);
  } else if (providerList.error) {
    error = errorMessage(providerList.error);
  }
  useEffect(() => () => request.current?.abort(), []);
  const search = () => {
    const abort = new AbortController();
    request.current?.abort();
    request.current = abort;
    setLinkError(null);
    searchWeb.mutate({
      providerID: provider,
      query: query.trim(),
      signal: abort.signal,
    });
  };
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, padding: 18 }}
    >
      <BodyText style={{ fontSize: 19, fontWeight: "600" }}>
        Search the web
      </BodyText>
      <BodyText muted>
        Use the web search providers on your OpenCode server.
      </BodyText>
      <Field
        label="Search query"
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
        onSubmitEditing={() => {
          if (query.trim() && !busy) {
            search();
          }
        }}
      />
      <SheetSelect
        label="Search provider"
        shown={
          providers.find((item) => item.id === provider)?.name ??
          "Default provider"
        }
        value={provider ?? DEFAULT_CHOICE}
        options={[
          { label: "Default provider", value: DEFAULT_CHOICE },
          ...providers.map((item) => ({ label: item.name, value: item.id })),
        ]}
        onSelect={(next) =>
          setProvider(next === DEFAULT_CHOICE ? undefined : next)
        }
      />
      <Button
        title="Search"
        variant="primary"
        busy={busy}
        disabled={!query.trim()}
        onPress={search}
      />
      <ErrorNotice error={error} />
      {results?.map((result, index) => (
        <Card key={`${result.url}:${index}`}>
          <BodyText style={{ fontSize: 17, fontWeight: "600" }}>
            {result.title || result.url}
          </BodyText>
          <BodyText muted>{result.url}</BodyText>
          {result.content && (
            <Text
              selectable
              style={{
                color: colors.text,
                fontFamily: sans,
                fontSize: 15,
                lineHeight: 23,
              }}
            >
              {result.content}
            </Text>
          )}
          <Button
            title="Open source"
            size="compact"
            onPress={() => {
              void openLink(result.url).catch((error_) =>
                setLinkError(errorMessage(error_))
              );
            }}
          />
        </Card>
      ))}
      {results && !results.length && (
        <Empty
          title="No results"
          detail="Try another query or search provider."
        />
      )}
    </ScrollView>
  );
};

interface GenerateInput {
  aspect: string;
  kind: "text" | "image";
  model: ModelInfo | undefined;
  prompt: string;
}

type GenerateOutput =
  | { images: GenerateImageResult; kind: "image" }
  | { kind: "text"; text: string };

const useGeneration = (client: Client) => {
  const request = useRef<AbortController | undefined>(undefined);
  const generation = useMutation({
    mutationFn: async (
      input: GenerateInput & { signal: AbortSignal }
    ): Promise<GenerateOutput> => {
      const ref = input.model
        ? { id: input.model.id, providerID: input.model.providerID }
        : undefined;
      if (input.kind === "image" && ref) {
        if (
          !/^\d+:\d+$/u.test(input.aspect) ||
          input.aspect.split(":").some((part) => Number(part) <= 0)
        ) {
          throw new Error("Enter an aspect ratio such as 1:1 or 16:9");
        }
        const images = await client.experimental.generate.image(
          {
            aspect: input.aspect as `${number}:${number}`,
            model: ref,
            n: 1,
            prompt: input.prompt,
          },
          { signal: input.signal }
        );
        return { images, kind: "image" };
      }
      const result = await client.experimental.generate.text(
        { model: ref, prompt: input.prompt },
        { signal: input.signal }
      );
      return { kind: "text", text: result.text };
    },
  });
  useEffect(() => () => request.current?.abort(), []);
  const { data, error, isPending, mutate, reset } = generation;
  const start = (input: GenerateInput) => {
    const abort = new AbortController();
    request.current?.abort();
    request.current = abort;
    mutate({ ...input, signal: abort.signal });
  };
  const stop = () => {
    request.current?.abort();
    reset();
  };
  let message: string | null = null;
  if (error) {
    message = isUnsupportedContent(error)
      ? GENERATE_UNSUPPORTED
      : errorMessage(error);
  }
  return {
    busy: isPending,
    clear: reset,
    error: message,
    images: data?.kind === "image" ? data.images : undefined,
    start,
    stop,
    text: data?.kind === "text" ? data.text : "",
  };
};

const useGenerateModels = (client: Client, directory: string) => {
  const scope = useServerScope();
  const list = useQuery(generateModelsOptions(scope, client, directory));
  return {
    error: list.error ? errorMessage(list.error) : null,
    models: list.data ?? [],
  };
};

const Generate = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const { colors } = useTheme();
  const withNativePresentation = useNativePresentation();
  const [kind, setKind] = useState<"text" | "image">("text");
  const { models, error: modelError } = useGenerateModels(client, directory);
  const [model, setModel] = useState<ModelInfo>();
  const [query, setQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [localError, setLocalError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const {
    busy,
    clear: clearGeneration,
    error: generationError,
    images,
    start,
    stop,
    text,
  } = useGeneration(client);
  const [modelErrorShown, setModelErrorShown] = useState(true);
  const error =
    generationError ?? localError ?? (modelErrorShown ? modelError : null);
  const resetErrors = () => {
    setLocalError(null);
    setModelErrorShown(false);
  };
  const showError = (message: string) => {
    clearGeneration();
    setModelErrorShown(false);
    setLocalError(message);
  };
  const available = models.filter((item) =>
    kind === "image"
      ? item.type === "image"
      : !item.type || item.type === "chat"
  );
  const matches = available.filter((item) =>
    `${item.name} ${item.providerID}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const generate = () => {
    if (kind === "image" && !model) {
      showError("Select an image model");
      return;
    }
    resetErrors();
    start({ aspect, kind, model, prompt });
  };
  const shareImage = async (image: GenerateImageResult["images"][number]) => {
    setSharing(true);
    resetErrors();
    try {
      await saveImage(image, withNativePresentation);
    } catch (error_) {
      showError(errorMessage(error_));
    }
    setSharing(false);
  };
  let modelLabel = "Choose an available image model";
  if (model) {
    modelLabel = `${model.name} · ${model.providerID}`;
  } else if (kind === "text") {
    modelLabel = "Server default model";
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, padding: 18 }}
    >
      <BodyText style={{ fontSize: 19, fontWeight: "600" }}>Generate</BodyText>
      <BodyText muted>
        Create a standalone result through your server. Requests use your
        connected provider and can incur charges.
      </BodyText>
      <BodyText muted>
        Standalone generation uses the server global configuration. Project-only
        model settings do not apply.
      </BodyText>
      <SegmentedControl
        accessibilityLabel="Result type"
        disabled={busy}
        options={generateKindOptions}
        value={kind}
        onChange={(next) => {
          setKind(next);
          setModel(undefined);
        }}
      />
      <Field label="Find a model" value={query} onChangeText={setQuery} />
      <BodyText muted>{modelLabel}</BodyText>
      <SheetSelect
        label="Model"
        shown={modelLabel}
        value={model ? modelKey(model) : DEFAULT_CHOICE}
        options={[
          ...(kind === "text"
            ? [{ label: "Server default", value: DEFAULT_CHOICE }]
            : []),
          ...matches.slice(0, MODEL_LIMIT).map((item) => ({
            label: `${item.name} · ${item.providerID}`,
            value: modelKey(item),
          })),
        ]}
        onSelect={(next) =>
          setModel(matches.find((item) => modelKey(item) === next))
        }
      />
      {kind === "image" && !available.length && (
        <BodyText muted>
          No image models are connected. Add one through Accounts or your server
          configuration.
        </BodyText>
      )}
      <Field
        label="Prompt"
        multiline
        value={prompt}
        onChangeText={setPrompt}
        placeholder={
          kind === "image" ? "Describe the image" : "Describe what you need"
        }
      />
      {kind === "image" && (
        <Field
          label="Aspect ratio"
          value={aspect}
          onChangeText={setAspect}
          placeholder="1:1"
        />
      )}
      <Button
        title={kind === "image" ? "Generate image" : "Generate text"}
        variant="primary"
        busy={busy}
        disabled={!prompt.trim() || (kind === "image" && !model)}
        onPress={generate}
      />
      {busy && (
        <Button
          title="Stop waiting"
          size="compact"
          onPress={() => {
            stop();
          }}
        />
      )}
      <ErrorNotice error={error} />
      {!!text && (
        <Card>
          <Text
            selectable
            style={{
              color: colors.text,
              fontFamily: sans,
              fontSize: 15,
              lineHeight: 24,
            }}
          >
            {text}
          </Text>
          <Button
            title="Copy text"
            size="compact"
            onPress={() => {
              void copyText(text).catch((error_) =>
                showError(errorMessage(error_))
              );
            }}
          />
        </Card>
      )}
      {images?.images.map((image, index) => (
        <Card key={index}>
          <Image
            accessibilityLabel={prompt}
            source={{ uri: `data:${image.mime};base64,${image.data}` }}
            resizeMode="contain"
            style={{ aspectRatio: 1, borderRadius: 6, width: "100%" }}
          />
          <Button
            title={Platform.OS === "web" ? "Save image" : "Save or share image"}
            busy={sharing}
            onPress={() => {
              void shareImage(image);
            }}
          />
        </Card>
      ))}
      {images?.cost !== undefined && (
        <BodyText muted>Cost: ${images.cost.toFixed(4)}</BodyText>
      )}
    </ScrollView>
  );
};

export const AdvancedSettings = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  useTheme();
  const [tool, setTool] = useState<ToolName>("Usage");
  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 18 }}>
        <SheetSelect
          label="Tool"
          shown={tool}
          value={tool}
          options={toolOptions}
          onSelect={(next) => setTool(next as ToolName)}
        />
      </View>
      {tool === "Usage" && <Usage client={client} directory={directory} />}
      {tool === "Search" && <WebSearch client={client} directory={directory} />}
      {tool === "Generate" && (
        <Generate client={client} directory={directory} />
      )}
    </View>
  );
};
