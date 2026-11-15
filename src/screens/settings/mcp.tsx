import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { GlobalForms } from "../../components/global-forms";
import { SheetGroup, SheetRow } from "../../components/list-sheet";
import { SegmentedControl } from "../../components/segmented-control";
import { useUndoableRemoval } from "../../components/snackbar";
import {
  Button,
  Empty,
  ErrorNotice,
  Field,
  JsonView,
  BodyText,
  Row,
  Sheet,
} from "../../components/ui";
import { errorMessageOrNull } from "../../lib/client";
import type { Client } from "../../lib/client";
import { mcpResourcesOptions } from "../../lib/queries/panels";
import { mcpServersOptions } from "../../lib/queries/settings";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import { externalURL } from "../../lib/settings";
import { useTheme } from "../../lib/theme";
import {
  Page,
  resourceOf,
  useSettingsBusy,
  useSettingsMutation,
} from "./shared";

const serverKindOptions = [
  { label: "Remote", value: "remote" },
  { label: "Local", value: "local" },
] as const;

type McpServer = Awaited<ReturnType<Client["mcp"]["list"]>>["data"][number];

const SHEET_CONTENT_STYLE = { gap: 12, paddingTop: 4 } as const;

const statusLabel = (item: McpServer) => {
  const text = item.status.status.replace("_", " ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
};

const ServerRow = ({
  item,
  onPress,
}: {
  item: McpServer;
  onPress: () => void;
}) => {
  const { colors } = useTheme();
  const status = statusLabel(item);
  return (
    <View>
      <SheetRow
        label={item.title || item.name}
        description={item.title ? `${item.name} · ${status}` : status}
        trailing="chevron"
        onPress={onPress}
      />
      {"error" in item.status && (
        <BodyText
          style={{
            color: colors.danger,
            paddingBottom: 12,
            paddingHorizontal: 12,
          }}
        >
          {item.status.error}
        </BodyText>
      )}
    </View>
  );
};

const ServerSheet = ({
  busy,
  error,
  item,
  onClose,
  onRemove,
  onToggle,
}: {
  busy: boolean;
  error: string | null;
  item: McpServer | undefined;
  onClose: () => void;
  onRemove: (item: McpServer) => void;
  onToggle: (item: McpServer) => void;
}) => (
  <Sheet
    visible={item !== undefined}
    title={item ? item.title || item.name : "MCP server"}
    fitContent
    contentStyle={SHEET_CONTENT_STYLE}
    onClose={onClose}
  >
    <ErrorNotice error={error} />
    {item?.status.status === "needs_auth" && (
      <BodyText muted>
        Connect its account in the Accounts tab. The integration name is{" "}
        {item.integrationID || item.name}.
      </BodyText>
    )}
    {item && (
      <SheetGroup title={item.name}>
        <SheetRow
          label={item.status.status === "connected" ? "Disconnect" : "Connect"}
          description={statusLabel(item)}
          disabled={busy}
          onPress={() => onToggle(item)}
        />
        <SheetRow
          label="Remove"
          destructive
          disabled={busy}
          onPress={() => onRemove(item)}
        />
      </SheetGroup>
    )}
  </Sheet>
);

export const Mcp = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const scope = useServerScope();
  const { data, error, loading, refresh } = resourceOf(
    useQuery(mcpServersOptions(scope, client, directory))
  );
  const { hidden, remove: removeServer } = useUndoableRemoval("mcp");
  const visible = data?.filter((item) => !hidden.has(item.name));
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"remote" | "local">("remote");
  const [url, setUrl] = useState("");
  const [command, setCommand] = useState("");
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const resources = useQuery({
    ...mcpResourcesOptions(scope, client, directory),
    enabled: resourcesOpen,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const settingsBusy = useSettingsBusy();
  const busy = settingsBusy || resources.isFetching;
  const selectedItem = visible?.find((item) => item.name === selected);
  const mcpKeys = () => [
    queryKeys.dir.settings(scope, directory, "mcp"),
    queryKeys.dir.catalog(scope, directory),
  ];
  const toggle = useSettingsMutation({
    invalidate: mcpKeys,
    mutationFn: async (item: McpServer, signal) => {
      const input = { location: { directory }, server: item.name };
      await (item.status.status === "connected"
        ? client.experimental.mcp.disconnect(input, { signal })
        : client.experimental.mcp.connect(input, { signal }));
      signal.throwIfAborted();
      setSelected(null);
    },
    onError: setErrorAction,
  });
  const removeMcp = useSettingsMutation({
    invalidate: mcpKeys,
    mutationFn: async (serverName: string, signal) => {
      await client.experimental.mcp.remove(
        { location: { directory }, server: serverName },
        { signal }
      );
    },
    onError: setErrorAction,
  });
  const addServer = useSettingsMutation({
    invalidate: mcpKeys,
    mutationFn: async (_input, signal) => {
      const server = name.trim();
      if (kind === "remote") {
        await client.experimental.mcp.add(
          {
            config: { type: "remote", url: externalURL(url.trim()) },
            location: { directory },
            server,
          },
          { signal }
        );
      } else {
        const args: unknown = JSON.parse(command);
        if (
          !Array.isArray(args) ||
          !args.length ||
          !args.every((arg) => typeof arg === "string" && arg.length)
        ) {
          throw new Error("Enter a JSON array of command arguments");
        }
        await client.experimental.mcp.add(
          {
            config: { command: args, type: "local" },
            location: { directory },
            server,
          },
          { signal }
        );
      }
      signal.throwIfAborted();
      setAdding(false);
      setName("");
      setUrl("");
      setCommand("");
    },
    onError: setErrorAction,
  });
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <GlobalForms client={client} directory={directory} />
      <ErrorNotice
        error={
          selected ? null : (errorAction ?? errorMessageOrNull(resources.error))
        }
      />
      {visible && visible.length > 0 && (
        <SheetGroup title="MCP servers">
          {visible.map((item) => (
            <ServerRow
              key={item.name}
              item={item}
              onPress={() => {
                setErrorAction(null);
                setSelected(item.name);
              }}
            />
          ))}
        </SheetGroup>
      )}
      {visible && !visible.length && (
        <Empty
          title="No MCP servers"
          detail="Connect tools and resources from your own servers."
        />
      )}
      <SheetGroup title="Resources">
        <SheetRow
          label="MCP resources"
          description="Browse resources from connected servers."
          trailing="chevron"
          disabled={busy}
          onPress={() => {
            setErrorAction(null);
            setResourcesOpen(true);
            void resources.refetch();
          }}
        />
      </SheetGroup>
      <Button
        title="Add MCP server"
        variant="primary"
        fullWidth
        disabled={busy}
        onPress={() => {
          setAdding(true);
          setErrorAction(null);
        }}
      />
      <ServerSheet
        busy={busy}
        error={errorAction}
        item={selectedItem}
        onClose={() => setSelected(null)}
        onToggle={(item) => {
          setErrorAction(null);
          toggle.mutate(item);
        }}
        onRemove={(item) => {
          setSelected(null);
          removeServer(item.name, {
            commit: () => removeMcp.mutateAsync(item.name),
            message: "MCP server removed",
          });
        }}
      />
      <Sheet
        visible={resourcesOpen && resources.data !== undefined}
        title="MCP resources"
        onClose={() => setResourcesOpen(false)}
      >
        <JsonView value={resources.data} />
      </Sheet>
      <Sheet
        visible={adding}
        title="Add MCP server"
        onClose={() => {
          if (!busy) {
            setAdding(false);
          }
        }}
      >
        <ErrorNotice error={errorAction} />
        <Field
          label="Server name"
          value={name}
          editable={!busy}
          onChangeText={setName}
          placeholder="my-tools"
        />
        <Row>
          <SegmentedControl
            accessibilityLabel="Server type"
            disabled={busy}
            options={serverKindOptions}
            value={kind}
            onChange={setKind}
          />
        </Row>
        {kind === "remote" ? (
          <Field
            label="MCP URL"
            keyboardType="url"
            value={url}
            editable={!busy}
            onChangeText={setUrl}
            placeholder="https://example.com/mcp"
          />
        ) : (
          <>
            <Field
              label="Command arguments (JSON array)"
              multiline
              value={command}
              editable={!busy}
              onChangeText={setCommand}
              placeholder='["npx", "-y", "your-mcp-server"]'
            />
            <BodyText muted>The command runs on the OpenCode server.</BodyText>
          </>
        )}
        <Button
          title="Add server"
          variant="primary"
          busy={busy}
          disabled={!name.trim()}
          onPress={() => {
            setErrorAction(null);
            addServer.mutate();
          }}
        />
      </Sheet>
    </Page>
  );
};
