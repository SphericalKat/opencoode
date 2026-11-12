import type {
  GenerateImageResult,
  ModelInfo,
  UsageLimitsInfo,
  UsageLimitsMeter,
  WebSearchProvider,
  WebSearchResult,
} from "@opencode/client";
import { ClientError } from "@opencode/client";
import * as Clipboard from "expo-clipboard";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useEffect, useEffectEvent, useRef, useState } from "react";
import { Image, Linking, Platform, ScrollView, Text, View } from "react-native";

import { errorMessage } from "../lib/client";
import type { Client } from "../lib/client";
import { externalURL } from "../lib/settings";
import { useNativePresentation } from "../lib/sheets";
import { useTheme } from "../lib/theme";
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
  const [info, setInfo] = useState<UsageLimitsInfo | null>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const active = useRef(true);
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await client.experimental.usage.limits({
        location: { directory },
      });
      if (active.current) {
        setInfo(result.data);
      }
    } catch (error_) {
      if (active.current) {
        setError(
          error_ instanceof ClientError &&
            error_.reason === "UnsupportedContentType"
            ? "Usage limits require OpenCode 2.2.1 or later. Update your server to use this view."
            : errorMessage(error_)
        );
      }
    }
    if (active.current) {
      setLoading(false);
    }
  };
  const loadOnMount = useEffectEvent(() => {
    void load();
  });
  useEffect(() => {
    active.current = true;
    loadOnMount();
    return () => {
      active.current = false;
    };
  }, []);
  return (
    <ScrollView contentContainerStyle={{ gap: 14, padding: 18 }}>
      <Row>
        <BodyText style={{ flex: 1, fontSize: 19, fontWeight: "600" }}>
          Server usage
        </BodyText>
        <Button
          title="Refresh"
          compact
          busy={loading}
          onPress={() => {
            void load();
          }}
        />
      </Row>
      <ErrorNotice
        error={error}
        onRetry={() => {
          void load();
        }}
      />
      {loading && !info && <Busy />}
      {info && (
        <>
          <BodyText muted>{info.workspace.name || info.workspace.id}</BodyText>
          <Button
            title="Open usage dashboard"
            onPress={() => {
              void openLink(info.workspace.usageURL).catch((error_) =>
                setError(errorMessage(error_))
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
  const [providers, setProviders] = useState<WebSearchProvider[]>([]);
  const [provider, setProvider] = useState<string>();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WebSearchResult[]>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    active.current = true;
    void client.websearch
      .providers({ location: { directory } })
      .then((result) => {
        if (active.current) {
          setProviders(result.data);
        }
        return null;
      })
      .catch((error_) => {
        if (active.current) {
          setError(errorMessage(error_));
        }
      });
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, [client, directory]);
  const search = async () => {
    const abort = new AbortController();
    request.current?.abort();
    request.current = abort;
    setBusy(true);
    setError(null);
    setResults(undefined);
    try {
      const result = await client.websearch.query(
        { location: { directory }, providerID: provider, query: query.trim() },
        { signal: abort.signal }
      );
      if (active.current && !abort.signal.aborted) {
        setResults(result.data.results);
      }
    } catch (error_) {
      if (active.current && !abort.signal.aborted) {
        setError(errorMessage(error_));
      }
    }
    if (active.current && !abort.signal.aborted) {
      setBusy(false);
    }
  };
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
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
            void search();
          }
        }}
      />
      <Row>
        <Button
          title="Default provider"
          compact
          variant={provider ? "secondary" : "primary"}
          onPress={() => setProvider(undefined)}
        />
        {providers.map((item) => (
          <Button
            key={item.id}
            title={item.name}
            compact
            variant={provider === item.id ? "primary" : "secondary"}
            onPress={() => setProvider(item.id)}
          />
        ))}
      </Row>
      <Button
        title="Search"
        variant="primary"
        busy={busy}
        disabled={!query.trim()}
        onPress={() => {
          void search();
        }}
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
            compact
            onPress={() => {
              void openLink(result.url).catch((error_) =>
                setError(errorMessage(error_))
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
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [model, setModel] = useState<ModelInfo>();
  const [query, setQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [images, setImages] = useState<GenerateImageResult>();
  const [aspect, setAspect] = useState("1:1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const active = useRef(true);
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => {
    active.current = true;
    void client.model
      .list({ location: { directory }, types: ["chat", "image"] })
      .then((result) => {
        if (active.current) {
          setModels(result.data.filter((item) => item.enabled));
        }
        return null;
      })
      .catch((error_) => {
        if (active.current) {
          setError(errorMessage(error_));
        }
      });
    return () => {
      active.current = false;
      request.current?.abort();
    };
  }, [client, directory]);
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
  const runGeneration = async (abort: AbortController) => {
    const ref = model
      ? { id: model.id, providerID: model.providerID }
      : undefined;
    if (kind === "image" && ref) {
      if (
        !/^\d+:\d+$/u.test(aspect) ||
        aspect.split(":").some((part) => Number(part) <= 0)
      ) {
        throw new Error("Enter an aspect ratio such as 1:1 or 16:9");
      }
      const result = await client.experimental.generate.image(
        { aspect: aspect as `${number}:${number}`, model: ref, n: 1, prompt },
        { signal: abort.signal }
      );
      if (active.current && !abort.signal.aborted) {
        setImages(result);
      }
    } else {
      const result = await client.experimental.generate.text(
        { model: ref, prompt },
        { signal: abort.signal }
      );
      if (active.current && !abort.signal.aborted) {
        setText(result.text);
      }
    }
  };
  const generate = async () => {
    if (kind === "image" && !model) {
      setError("Select an image model");
      return;
    }
    const abort = new AbortController();
    request.current?.abort();
    request.current = abort;
    setBusy(true);
    setError(null);
    setText("");
    setImages(undefined);
    try {
      await runGeneration(abort);
    } catch (error_) {
      if (active.current && !abort.signal.aborted) {
        setError(
          error_ instanceof ClientError &&
            error_.reason === "UnsupportedContentType"
            ? "Standalone generation requires OpenCode 2.2.1 or later. Update your server to use this feature."
            : errorMessage(error_)
        );
      }
    }
    if (active.current && !abort.signal.aborted) {
      setBusy(false);
    }
  };
  const shareImage = async (image: GenerateImageResult["images"][number]) => {
    setSharing(true);
    setError(null);
    try {
      await saveImage(image, withNativePresentation);
    } catch (error_) {
      setError(errorMessage(error_));
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
      <Row>
        <Button
          title="Text"
          compact
          variant={kind === "text" ? "primary" : "secondary"}
          disabled={busy}
          onPress={() => {
            setKind("text");
            setModel(undefined);
          }}
        />
        <Button
          title="Image"
          compact
          variant={kind === "image" ? "primary" : "secondary"}
          disabled={busy}
          onPress={() => {
            setKind("image");
            setModel(undefined);
          }}
        />
      </Row>
      <Field label="Find a model" value={query} onChangeText={setQuery} />
      <BodyText muted>{modelLabel}</BodyText>
      <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
        {kind === "text" && (
          <Button
            title="Server default"
            compact
            variant={model ? "secondary" : "primary"}
            onPress={() => setModel(undefined)}
          />
        )}
        {matches.slice(0, 30).map((item) => (
          <Button
            key={`${item.providerID}/${item.id}`}
            title={`${item.name} · ${item.providerID}`}
            compact
            variant={model === item ? "primary" : "secondary"}
            onPress={() => setModel(item)}
          />
        ))}
      </ScrollView>
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
        onPress={() => {
          void generate();
        }}
      />
      {busy && (
        <Button
          title="Stop waiting"
          compact
          onPress={() => {
            request.current?.abort();
            setBusy(false);
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
            compact
            onPress={() => {
              void Clipboard.setStringAsync(text).catch((error_) =>
                setError(errorMessage(error_))
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
  const [tool, setTool] = useState<"Usage" | "Search" | "Generate">("Usage");
  return (
    <View style={{ flex: 1 }}>
      <Row style={{ padding: 18 }}>
        {(["Usage", "Search", "Generate"] as const).map((item) => (
          <Button
            key={item}
            title={item}
            compact
            variant={tool === item ? "primary" : "secondary"}
            onPress={() => setTool(item)}
          />
        ))}
      </Row>
      {tool === "Usage" && <Usage client={client} directory={directory} />}
      {tool === "Search" && <WebSearch client={client} directory={directory} />}
      {tool === "Generate" && (
        <Generate client={client} directory={directory} />
      )}
    </View>
  );
};
