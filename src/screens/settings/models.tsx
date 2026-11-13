import type { ModelInfo } from "@opencode/client";
import { useState } from "react";
import { View } from "react-native";

import {
  Button,
  Card,
  Disclosure,
  Empty,
  Field,
  JsonView,
  BodyText,
  Row,
  Sheet,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { useThemedStyles } from "../../lib/theme";
import type { ModelCatalog } from "./sections";
import { Page, useResource } from "./shared";
import { createStyles } from "./styles";

const ModelCard = ({
  item,
  onSelect,
}: {
  item: ModelInfo;
  onSelect: (item: ModelInfo) => void;
}) => {
  const styles = useThemedStyles(createStyles);
  return (
    <Card style={styles.card}>
      <Row style={styles.cardHeader}>
        <View style={styles.cardText}>
          <BodyText style={styles.cardTitle}>{item.name}</BodyText>
          <BodyText muted>
            {item.providerID} · {item.enabled ? "Available" : "Not connected"}
          </BodyText>
        </View>
        <Button title="Details" compact onPress={() => onSelect(item)} />
      </Row>
    </Card>
  );
};

const ModelsStatus = ({
  hasModels,
  loaded,
  matches,
  onClear,
  search,
}: {
  hasModels: boolean;
  loaded: boolean;
  matches: number;
  onClear: () => void;
  search: string;
}) => {
  if (!loaded) {
    return null;
  }
  if (!hasModels) {
    return (
      <Empty
        title="No models available"
        detail="Your server did not publish a model catalog for this project."
      />
    );
  }
  if (!search || matches) {
    return null;
  }
  return (
    <Card>
      <Empty
        title="No matching models"
        detail="Try a model name, provider, or model ID, or clear the search to see all models."
      />
      <Button title="Clear search" onPress={onClear} />
    </Card>
  );
};

const ProvidersDisclosure = ({
  providers,
}: {
  providers?: readonly { id: string; name: string; activation: string }[];
}) => (
  <Disclosure title={`Providers (${providers?.length ?? 0})`}>
    {providers?.map((item) => (
      <View key={item.id} style={{ gap: 4 }}>
        <BodyText>{item.name}</BodyText>
        <BodyText muted>
          {item.id} · {item.activation}
        </BodyText>
      </View>
    ))}
  </Disclosure>
);

const ModelDetails = ({
  client,
  selected,
}: {
  client: boolean;
  selected: ModelInfo;
}) => {
  const details = client
    ? selected
    : {
        contextWindow: selected.limit.context,
        id: selected.id,
        name: selected.name,
        providerID: selected.providerID,
        thinkingLevels: selected.variants.map((item) => item.id),
      };
  return (
    <>
      <BodyText muted>
        {selected.providerID}/{selected.id}
      </BodyText>
      <BodyText>
        Context: {selected.limit.context.toLocaleString()} tokens
        {client
          ? ` · Output: ${selected.limit.output.toLocaleString()} tokens`
          : ""}
      </BodyText>
      <BodyText>
        Variants:{" "}
        {selected.variants.map((item) => item.id).join(", ") ||
          (client ? "Default" : "Unavailable")}
      </BodyText>
      {client ? (
        <>
          <Disclosure title="Capabilities">
            <JsonView value={selected.capabilities} />
          </Disclosure>
          <Disclosure title="Prices">
            <JsonView value={selected.cost} />
          </Disclosure>
        </>
      ) : (
        <BodyText muted>
          Output limits and prices are unavailable from this server.
        </BodyText>
      )}
      <Disclosure title="Details">
        <JsonView value={details} />
      </Disclosure>
    </>
  );
};

export const Models = ({
  catalog,
  client,
  directory,
}: {
  catalog: ModelCatalog;
  client?: Client;
  directory: string;
}) => {
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(
    client ?? catalog,
    directory,
    async (signal) => {
      const [models, providers] = await Promise.all([
        catalog.list(
          { location: { directory }, types: ["chat", "image", "decision"] },
          { signal }
        ),
        client?.provider.list({ location: { directory } }, { signal }),
      ]);
      return { models: models.data, providers: providers?.data };
    }
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ModelInfo>();
  const [limit, setLimit] = useState(40);
  const changeQuery = (next: string) => {
    if (next !== query) {
      setLimit(40);
    }
    setQuery(next);
  };
  const search = query.trim().toLowerCase();
  const models =
    data?.models.filter((item) =>
      `${item.name} ${item.providerID} ${item.id}`
        .toLowerCase()
        .includes(search)
    ) ?? [];
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <Row style={{ alignItems: "flex-end", flexWrap: "nowrap" }}>
        <Field
          label="Find a model"
          placeholder="Name or provider"
          value={query}
          onChangeText={changeQuery}
          containerStyle={{ flex: 1 }}
        />
        {!!query && (
          <Button
            title="Clear"
            accessibilityLabel="Clear model search"
            compact
            variant="ghost"
            onPress={() => changeQuery("")}
          />
        )}
      </Row>
      <BodyText muted>
        Select a model inside a chat to use it.
        {client
          ? " Edit configuration to change server defaults or custom providers."
          : ""}
      </BodyText>
      <BodyText style={styles.sectionLabel}>{models.length} MODELS</BodyText>
      {models.slice(0, limit).map((item) => (
        <ModelCard
          key={`${item.providerID}/${item.id}`}
          item={item}
          onSelect={setSelected}
        />
      ))}
      {models.length > limit && (
        <>
          <BodyText muted>
            Showing {limit} of {models.length} models.
          </BodyText>
          <Button
            title="Load more models"
            onPress={() => setLimit((value) => value + 40)}
          />
        </>
      )}
      <ModelsStatus
        hasModels={!!data?.models.length}
        loaded={!!data && !loading}
        matches={models.length}
        search={search}
        onClear={() => changeQuery("")}
      />
      {client && <ProvidersDisclosure providers={data?.providers} />}
      <Sheet
        visible={!!selected}
        title={selected?.name || "Model"}
        onClose={() => setSelected(undefined)}
      >
        {selected && <ModelDetails selected={selected} client={!!client} />}
      </Sheet>
    </Page>
  );
};
