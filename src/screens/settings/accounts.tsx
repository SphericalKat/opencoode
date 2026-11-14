import type { CredentialEntry, IntegrationInfo } from "@opencode/client";
import { useState } from "react";

import { SheetGroup, SheetRow } from "../../components/list-sheet";
import { useUndoableRemoval } from "../../components/snackbar";
import {
  Button,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  Sheet,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { withSettingsRequest } from "../../lib/settings";
import { ConnectIntegration } from "./connect-integration";
import { Page, runBusy, useResource } from "./shared";

const integrationDescription = (item: IntegrationInfo) => {
  const count = item.connections.length;
  const summary = count
    ? `${count} connection${count === 1 ? "" : "s"}`
    : "Not connected";
  const problems = item.connections.flatMap((connection) =>
    connection.status ? [connection.status.message] : []
  );
  return [summary, ...problems].join(" · ");
};

export const Accounts = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
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
  const { hidden, remove: removeAccount } = useUndoableRemoval("accounts");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<IntegrationInfo>();
  const [limit, setLimit] = useState(40);
  const changeQuery = (next: string) => {
    if (next !== query) {
      setLimit(40);
    }
    setQuery(next);
  };
  const visibleCredentials = data?.credentials.filter(
    (item) => !hidden.has(item.id)
  );
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
      <Field
        label="Find a provider or integration"
        placeholder="Search accounts"
        value={query}
        onChangeText={changeQuery}
        trailing={
          query ? (
            <Button
              title="Clear"
              accessibilityLabel="Clear provider search"
              size="compact"
              variant="ghost"
              onPress={() => changeQuery("")}
            />
          ) : undefined
        }
      />
      <ErrorNotice error={actionError} />
      {!!visibleCredentials?.length && (
        <SheetGroup title="Saved accounts">
          {visibleCredentials.map((item) => (
            <SheetRow
              key={item.id}
              label={item.label || item.integrationID}
              description={`${item.integrationID} · ${item.value.type}${item.active ? " · Active" : ""}`}
              trailing="chevron"
              accessibilityLabel={`Manage ${item.label || item.integrationID}`}
              onPress={() => {
                setCredential(item);
                setLabel(item.label);
                setActionError(null);
              }}
            />
          ))}
        </SheetGroup>
      )}
      {!!integrations.length && (
        <SheetGroup title="Connect an account">
          {integrations.slice(0, limit).map((item) => (
            <SheetRow
              key={item.id}
              label={item.name}
              description={integrationDescription(item)}
              trailing="chevron"
              accessibilityLabel={`Connect ${item.name}`}
              onPress={() => setSelected(item)}
            />
          ))}
        </SheetGroup>
      )}
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
          <>
            <Empty
              title="No matching providers"
              detail="Try a provider name or integration ID, or clear the search to see all providers."
            />
            <Button title="Clear search" onPress={() => changeQuery("")} />
          </>
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
            setCredential(undefined);
            removeAccount(credentialID, {
              commit: () =>
                withSettingsRequest(async (signal) => {
                  await client.credential.remove({ credentialID }, { signal });
                  await refresh(signal);
                }),
              message: "Account removed",
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
