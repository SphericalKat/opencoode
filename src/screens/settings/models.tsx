import type { ModelInfo } from "@opencode/client";
import { useState } from "react";
import { View } from "react-native";

import { SheetGroup, SheetRow } from "../../components/list-sheet";
import {
  Button,
  Card,
  Disclosure,
  Empty,
  Field,
  JsonView,
  BodyText,
  Sheet,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import type { ModelCatalog } from "./sections";
import { Page, useResource } from "./shared";

const modelKey = (item: ModelInfo) => `${item.providerID}/${item.id}`;

const groupByProvider = (items: readonly ModelInfo[]) => {
  const groups = new Map<string, ModelInfo[]>();
  for (const item of items) {
    const group = groups.get(item.providerID);
    if (group) {
      group.push(item);
    } else {
      groups.set(item.providerID, [item]);
    }
  }
  return [...groups.entries()];
};

const ModelGroups = ({
  items,
  providerNames,
  onSelect,
}: {
  items: readonly ModelInfo[];
  providerNames: ReadonlyMap<string, string>;
  onSelect: (item: ModelInfo) => void;
}) => (
  <>
    {groupByProvider(items).map(([providerID, group]) => (
      <SheetGroup
        key={providerID}
        title={providerNames.get(providerID) ?? providerID}
      >
        {group.map((item) => (
          <SheetRow
            key={modelKey(item)}
            label={item.name}
            description={item.enabled ? "Available" : "Not connected"}
            trailing="chevron"
            accessibilityLabel={`${item.name}, ${item.providerID}, details`}
            onPress={() => onSelect(item)}
          />
        ))}
      </SheetGroup>
    ))}
  </>
);

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
  const providerNames = new Map(
    data?.providers?.map((item) => [item.id, item.name] as const)
  );
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <Field
        label="Find a model"
        placeholder="Name or provider"
        value={query}
        onChangeText={changeQuery}
        trailing={
          query ? (
            <Button
              title="Clear"
              accessibilityLabel="Clear model search"
              size="compact"
              variant="ghost"
              onPress={() => changeQuery("")}
            />
          ) : undefined
        }
      />
      <BodyText muted>
        Select a model inside a chat to use it.
        {client
          ? " Edit configuration to change server defaults or custom providers."
          : ""}
      </BodyText>
      <ModelGroups
        items={models.slice(0, limit)}
        providerNames={providerNames}
        onSelect={setSelected}
      />
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
