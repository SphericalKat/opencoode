import type { CredentialEntry, IntegrationInfo } from "@opencode/client";
import { useState } from "react";
import { View } from "react-native";

import {
  Button,
  Card,
  confirmAction,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  Row,
  Sheet,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { withSettingsRequest } from "../../lib/settings";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { ConnectIntegration } from "./connect-integration";
import { Page, runBusy, useResource } from "./shared";
import { createStyles } from "./styles";

export const Accounts = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(
    client,
    directory,
    async (signal) => {
      const [integrations, credentials] = await Promise.all([
        client.integration.list({ location: { directory } }, { signal }),
        client.credential.list({ signal }),
      ]);
      return { credentials, integrations: integrations.data };
    }
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<IntegrationInfo>();
  const [limit, setLimit] = useState(40);
  const changeQuery = (next: string) => {
    if (next !== query) {
      setLimit(40);
    }
    setQuery(next);
  };
  const [credential, setCredential] = useState<CredentialEntry>();
  const [label, setLabel] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<unknown>) => {
    setActionError(null);
    await runBusy(setBusy, setActionError, async () => {
      await withSettingsRequest(async (signal) => {
        await action(signal);
        await refresh(signal);
      });
    });
  };
  const search = query.trim().toLowerCase();
  const integrations =
    data?.integrations.filter((item) =>
      `${item.name} ${item.id}`.toLowerCase().includes(search)
    ) ?? [];
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <Row style={{ alignItems: "flex-end", flexWrap: "nowrap" }}>
        <Field
          label="Find a provider or integration"
          placeholder="Search accounts"
          value={query}
          onChangeText={changeQuery}
          containerStyle={{ flex: 1 }}
        />
        {!!query && (
          <Button
            title="Clear"
            accessibilityLabel="Clear provider search"
            compact
            variant="ghost"
            onPress={() => changeQuery("")}
          />
        )}
      </Row>
      <ErrorNotice error={actionError} />
      {!!data?.credentials.length && (
        <BodyText style={styles.sectionLabel}>SAVED ACCOUNTS</BodyText>
      )}
      {data?.credentials.map((item) => (
        <Card key={item.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <BodyText style={styles.name}>
                {item.label || item.integrationID}
              </BodyText>
              <BodyText muted>
                {item.integrationID} · {item.value.type}
                {item.active ? " · Active" : ""}
              </BodyText>
            </View>
            <Button
              title="Manage"
              compact
              onPress={() => {
                setCredential(item);
                setLabel(item.label);
                setActionError(null);
              }}
            />
          </Row>
        </Card>
      ))}
      <BodyText style={styles.sectionLabel}>CONNECT AN ACCOUNT</BodyText>
      {integrations.slice(0, limit).map((item) => (
        <Card key={item.id}>
          <Row style={{ justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <BodyText style={styles.name}>{item.name}</BodyText>
              <BodyText muted>
                {item.connections.length
                  ? `${item.connections.length} connection${item.connections.length === 1 ? "" : "s"}`
                  : "Not connected"}
              </BodyText>
            </View>
            <Button title="Connect" compact onPress={() => setSelected(item)} />
          </Row>
          {item.connections.map(
            (connection, index) =>
              connection.status && (
                <BodyText key={index} style={{ color: colors.danger }}>
                  {connection.status.message}
                </BodyText>
              )
          )}
        </Card>
      ))}
      {integrations.length > limit && (
        <>
          <BodyText muted>
            Showing {limit} of {integrations.length} integrations. Search or
            load more.
          </BodyText>
          <Button
            title="Load more integrations"
            onPress={() => setLimit((value) => value + 40)}
          />
        </>
      )}
      {data &&
        !loading &&
        !!data.integrations.length &&
        !!search &&
        !integrations.length && (
          <Card>
            <Empty
              title="No matching providers"
              detail="Try a provider name or integration ID, or clear the search to see all providers."
            />
            <Button title="Clear search" onPress={() => changeQuery("")} />
          </Card>
        )}
      {data && !data.integrations.length && (
        <Empty
          title="No integrations"
          detail="Your server did not publish any account integrations for this project."
        />
      )}
      <Sheet
        visible={!!credential}
        title="Manage account"
        onClose={() => {
          if (!busy) {
            setCredential(undefined);
          }
        }}
      >
        <ErrorNotice error={actionError} />
        <BodyText muted>{credential?.integrationID}</BodyText>
        <Field
          label="Account name"
          value={label}
          editable={!busy}
          onChangeText={setLabel}
        />
        <Button
          title="Save name"
          busy={busy}
          onPress={() => {
            void run(async (signal) => {
              if (!credential) {
                return;
              }
              await client.credential.update(
                { credentialID: credential.id, label: label.trim() },
                { signal }
              );
              signal.throwIfAborted();
              setCredential(undefined);
            });
          }}
        />
        {!credential?.active && (
          <Button
            title="Use this account"
            variant="primary"
            busy={busy}
            onPress={() => {
              void run(async (signal) => {
                if (!credential) {
                  return;
                }
                await client.credential.activate(
                  { credentialID: credential.id },
                  { signal }
                );
                signal.throwIfAborted();
                setCredential(undefined);
              });
            }}
          />
        )}
        <Button
          title="Remove account"
          variant="danger"
          busy={busy}
          onPress={() => {
            if (!credential) {
              return;
            }
            const credentialID = credential.id;
            void confirmAction(
              "Remove account?",
              "This removes the saved credential from your OpenCode server."
            ).then((confirmed) => {
              if (confirmed) {
                void run(async (signal) => {
                  await client.credential.remove({ credentialID }, { signal });
                  signal.throwIfAborted();
                  setCredential(undefined);
                });
              }
              return confirmed;
            });
          }}
        />
      </Sheet>
      {selected && (
        <ConnectIntegration
          key={selected.id}
          client={client}
          directory={directory}
          integration={selected}
          onClose={() => {
            setSelected(undefined);
            void refresh();
          }}
        />
      )}
    </Page>
  );
};
