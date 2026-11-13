import { useState } from "react";
import { View } from "react-native";

import { GlobalForms } from "../../components/global-forms";
import {
  Button,
  Card,
  confirmAction,
  Empty,
  ErrorNotice,
  Field,
  JsonView,
  BodyText,
  Row,
  Sheet,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { externalURL, withSettingsRequest } from "../../lib/settings";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { Page, runBusy, useResource } from "./shared";
import { createStyles } from "./styles";

export const Mcp = ({
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
      const response = await client.mcp.list(
        { location: { directory } },
        { signal }
      );
      return response.data;
    }
  );
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"remote" | "local">("remote");
  const [url, setUrl] = useState("");
  const [command, setCommand] = useState("");
  const [resources, setResources] = useState<unknown>();
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => {
    setErrorAction(null);
    await runBusy(setBusy, setErrorAction, async () => {
      await withSettingsRequest(async (signal) => {
        await action(signal);
        await refresh(signal);
      });
    });
  };
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <GlobalForms client={client} directory={directory} />
      <Row>
        <Button
          title="Add MCP server"
          variant="primary"
          disabled={busy}
          onPress={() => {
            setAdding(true);
            setErrorAction(null);
          }}
        />
        <Button
          title="Resources"
          disabled={busy}
          onPress={() => {
            void run(async (signal) => {
              const result = await client.mcp.resource.catalog(
                { location: { directory } },
                { signal }
              );
              signal.throwIfAborted();
              setResources(result.data);
            });
          }}
        />
      </Row>
      <ErrorNotice error={errorAction} />
      {data?.map((item) => (
        <Card key={item.name} style={styles.card}>
          <Row style={styles.cardHeader}>
            <View style={styles.cardText}>
              <BodyText style={styles.cardTitle}>
                {item.title || item.name}
              </BodyText>
              <BodyText muted>
                {item.name} · {item.status.status.replace("_", " ")}
              </BodyText>
            </View>
            <Button
              title={
                item.status.status === "connected" ? "Disconnect" : "Connect"
              }
              busy={busy}
              compact
              onPress={() => {
                void run(async (signal) => {
                  const input = { location: { directory }, server: item.name };
                  await (item.status.status === "connected"
                    ? client.experimental.mcp.disconnect(input, { signal })
                    : client.experimental.mcp.connect(input, { signal }));
                });
              }}
            />
          </Row>
          {"error" in item.status && (
            <BodyText style={{ color: colors.danger }}>
              {item.status.error}
            </BodyText>
          )}
          {item.status.status === "needs_auth" && (
            <BodyText muted>
              Connect its account in the Accounts tab. The integration name is{" "}
              {item.integrationID || item.name}.
            </BodyText>
          )}
          <Row>
            <Button
              title="Remove"
              variant="danger"
              compact
              busy={busy}
              onPress={() => {
                void confirmAction(
                  "Remove MCP server?",
                  `This removes ${item.name} from the project configuration.`
                ).then((confirmed) => {
                  if (confirmed) {
                    void run(async (signal) => {
                      await client.experimental.mcp.remove(
                        { location: { directory }, server: item.name },
                        { signal }
                      );
                    });
                  }
                  return confirmed;
                });
              }}
            />
          </Row>
        </Card>
      ))}
      {data && !data.length && (
        <Empty
          title="No MCP servers"
          detail="Connect tools and resources from your own servers."
        />
      )}
      <Sheet
        visible={resources !== undefined}
        title="MCP resources"
        onClose={() => setResources(undefined)}
      >
        <JsonView value={resources} />
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
          <Button
            title="Remote URL"
            disabled={busy}
            variant={kind === "remote" ? "primary" : "secondary"}
            onPress={() => setKind("remote")}
          />
          <Button
            title="Server command"
            disabled={busy}
            variant={kind === "local" ? "primary" : "secondary"}
            onPress={() => setKind("local")}
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
            void run(async (signal) => {
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
            });
          }}
        />
      </Sheet>
    </Page>
  );
};
