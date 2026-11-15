import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";

import { confirmAction } from "../../components/dialog";
import { SheetGroup, SheetRow } from "../../components/list-sheet";
import { BodyText, ErrorNotice } from "../../components/ui";
import type { Client } from "../../lib/client";
import { pluginsOptions } from "../../lib/queries/settings";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import { useTheme } from "../../lib/theme";
import {
  Page,
  resourceOf,
  useSettingsBusy,
  useSettingsMutation,
} from "./shared";

type PluginInfo = Awaited<ReturnType<Client["plugin"]["list"]>>["data"][number];

const NOTE_STYLE = {
  gap: 4,
  paddingBottom: 12,
  paddingHorizontal: 12,
} as const;

const SOURCE_LABELS: Record<string, string> = {
  builtin: "Built-in",
  local: "Local",
  package: "Package",
  sdk: "SDK",
};

const FEATURE_LABELS: Record<string, string> = {
  gui: "GUI",
  rpc: "RPC",
  server: "Server",
  tui: "TUI",
};

const capitalize = (value: string) =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const pluginName = (item: PluginInfo) => {
  if (item.id) {
    return item.id;
  }
  return item.source.type === "package" ? item.source.target : "Plugin";
};

const pluginSummary = (item: PluginInfo) => {
  const parts = [
    SOURCE_LABELS[item.source.type] ?? capitalize(item.source.type),
  ];
  if (item.source.type === "package") {
    if (item.id) {
      parts.push(item.source.target);
    }
    if (item.source.version) {
      parts.push(item.source.version);
    }
  }
  parts.push(capitalize(item.state.status));
  for (const [feature, enabled] of Object.entries(item.features)) {
    if (enabled) {
      parts.push(FEATURE_LABELS[feature] ?? capitalize(feature));
    }
  }
  return parts.join(" · ");
};

const PluginRow = ({
  busy,
  item,
  onUpdate,
}: {
  busy: boolean;
  item: PluginInfo;
  onUpdate: (target: string) => void;
}) => {
  const { colors } = useTheme();
  const { source } = item;
  const failed = item.state.status === "failed";
  return (
    <>
      {source.type === "package" ? (
        <SheetRow
          label={pluginName(item)}
          description={pluginSummary(item)}
          value={source.outdated ? "Update" : "Reinstall"}
          trailing="chevron"
          disabled={busy}
          onPress={() => onUpdate(source.target)}
        />
      ) : (
        <SheetRow label={pluginName(item)} description={pluginSummary(item)} />
      )}
      {(failed || item.features.gui) && (
        <View style={NOTE_STYLE}>
          {item.state.status === "failed" && (
            <BodyText style={{ color: colors.danger }}>
              {item.state.error}
            </BodyText>
          )}
          {item.features.gui && (
            <BodyText muted>
              This plugin includes a desktop web interface. Its tools and
              commands remain available through the server.
            </BodyText>
          )}
        </View>
      )}
    </>
  );
};

export const Plugins = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const scope = useServerScope();
  const { data, error, loading, refresh } = resourceOf(
    useQuery(pluginsOptions(scope, client, directory))
  );
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useSettingsBusy();
  const pluginKeys = () => [
    queryKeys.dir.settings(scope, directory, "plugins"),
  ];
  const updatePlugin = useSettingsMutation({
    invalidate: pluginKeys,
    mutationFn: async (target: string) => {
      if (
        await confirmAction(
          "Update plugin?",
          "This installs the latest package version on your server.",
          { confirmLabel: "Update", destructive: false }
        )
      ) {
        await client.plugin.update({
          location: { directory },
          targets: [target],
        });
      }
    },
    onError: setErrorAction,
  });
  const checkPlugins = useSettingsMutation({
    invalidate: pluginKeys,
    mutationFn: async () => {
      const result = await client.plugin.check({ location: { directory } });
      setNotice(
        `${result.data.filter((item) => item.source.type === "package" && item.source.outdated).length} package updates available.`
      );
    },
    onError: setErrorAction,
  });
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <BodyText muted>
        Edit the plugins list in your configuration to add or disable a plugin.
      </BodyText>
      <ErrorNotice error={errorAction} />
      {data && data.length > 0 && (
        <SheetGroup title="Plugins">
          {data.map((item, index) => (
            <PluginRow
              key={`${item.id}:${index}`}
              busy={busy}
              item={item}
              onUpdate={(target) => {
                setErrorAction(null);
                updatePlugin.mutate(target);
              }}
            />
          ))}
        </SheetGroup>
      )}
      <SheetGroup title="Updates">
        <SheetRow
          label="Check package updates"
          description={notice ?? "Look for newer versions of package plugins."}
          trailing="chevron"
          disabled={busy}
          onPress={() => {
            setErrorAction(null);
            checkPlugins.mutate();
          }}
        />
      </SheetGroup>
    </Page>
  );
};
