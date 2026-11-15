import type { CredentialEntry, IntegrationInfo } from "@opencode/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { errorMessage } from "../../lib/client";
import type { Client } from "../../lib/client";
import {
  credentialsOptions,
  integrationsOptions,
} from "../../lib/queries/settings";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import { ConnectIntegration } from "./connect-integration";
import { Page, useSettingsBusy, useSettingsMutation } from "./shared";

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

const useAccountsData = (client: Client, directory: string) => {
  const scope = useServerScope();
  const integrationList = useQuery(
    integrationsOptions(scope, client, directory)
  );
  const credentialList = useQuery(credentialsOptions(scope, client));
  const data =
    integrationList.data && credentialList.data
      ? {
          credentials: credentialList.data,
          integrations: integrationList.data,
        }
      : undefined;
  const failure = integrationList.error ?? credentialList.error;
  const error = failure ? errorMessage(failure) : null;
  const loading = integrationList.isFetching || credentialList.isFetching;
  const { refetch: refetchIntegrations } = integrationList;
  const { refetch: refetchCredentials } = credentialList;
  const refresh = () => {
    void refetchIntegrations();
    void refetchCredentials();
  };
  return { data, error, loading, refresh };
};

export const Accounts = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const { data, error, loading, refresh } = useAccountsData(client, directory);
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
  const busy = useSettingsBusy();
  const accountKeys = () => [
    queryKeys.credentials(scope),
    queryKeys.dir.settings(scope, directory, "integrations"),
    queryKeys.dir.catalog(scope, directory),
  ];
  const saveName = useSettingsMutation({
    invalidate: accountKeys,
    mutationFn: async (_input, signal) => {
      if (!credential) {
        return;
      }
      await client.credential.update(
        { credentialID: credential.id, label: label.trim() },
        { signal }
      );
      signal.throwIfAborted();
      setCredential(undefined);
    },
    onError: setActionError,
  });
  const activateAccount = useSettingsMutation({
    invalidate: accountKeys,
    mutationFn: async (_input, signal) => {
      if (!credential) {
        return;
      }
      await client.credential.activate(
        { credentialID: credential.id },
        { signal }
      );
      signal.throwIfAborted();
      setCredential(undefined);
    },
    onError: setActionError,
  });
  const removeCredential = useSettingsMutation({
    invalidate: accountKeys,
    mutationFn: async (credentialID: string, signal) => {
      await client.credential.remove({ credentialID }, { signal });
    },
    onError: setActionError,
  });
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
            setActionError(null);
            saveName.mutate();
          }}
        />
        {!credential?.active && (
          <Button
            title="Use this account"
            variant="primary"
            busy={busy}
            onPress={() => {
              setActionError(null);
              activateAccount.mutate();
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
              commit: () => removeCredential.mutateAsync(credentialID),
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
            for (const queryKey of accountKeys()) {
              void queryClient.invalidateQueries({ queryKey });
            }
          }}
        />
      )}
    </Page>
  );
};
