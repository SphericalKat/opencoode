import { useState } from "react";

import {
  Button,
  Card,
  confirmAction,
  ErrorNotice,
  BodyText,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { useTheme, useThemedStyles } from "../../lib/theme";
import { Page, runBusy, useResource } from "./shared";
import { createStyles } from "./styles";

export const Plugins = ({
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
      const response = await client.plugin.list(
        { location: { directory } },
        { signal }
      );
      return response.data;
    }
  );
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setErrorAction(null);
    await runBusy(setBusy, setErrorAction, async () => {
      await action();
      await refresh();
    });
  };
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <BodyText muted>
        Edit the plugins list in your configuration to add or disable a plugin.
      </BodyText>
      <ErrorNotice error={errorAction} />
      {notice && (
        <BodyText style={{ color: colors.success }}>{notice}</BodyText>
      )}
      <Button
        title="Check package updates"
        busy={busy}
        onPress={() => {
          void run(async () => {
            const result = await client.plugin.check({
              location: { directory },
            });
            setNotice(
              `${result.data.filter((item) => item.source.type === "package" && item.source.outdated).length} package updates available.`
            );
          });
        }}
      />
      {data?.map((item, index) => (
        <Card key={`${item.id}:${index}`}>
          <BodyText style={styles.name}>
            {item.id ||
              (item.source.type === "package" ? item.source.target : "Plugin")}
          </BodyText>
          <BodyText muted>
            {item.source.type} · {item.state.status}
          </BodyText>
          {item.state.status === "failed" && (
            <BodyText style={{ color: colors.danger }}>
              {item.state.error}
            </BodyText>
          )}
          {item.source.type === "package" && (
            <>
              <BodyText muted>
                {item.source.target}
                {item.source.version ? ` · ${item.source.version}` : ""}
              </BodyText>
              <Button
                title={
                  item.source.outdated
                    ? "Update package"
                    : "Reinstall latest package"
                }
                compact
                busy={busy}
                onPress={() => {
                  void run(async () => {
                    if (
                      item.source.type === "package" &&
                      (await confirmAction(
                        "Update plugin?",
                        "This installs the latest package version on your server."
                      ))
                    ) {
                      await client.plugin.update({
                        location: { directory },
                        targets: [item.source.target],
                      });
                    }
                  });
                }}
              />
            </>
          )}
          <BodyText muted>
            {Object.entries(item.features)
              .filter(([, enabled]) => enabled)
              .map(([feature]) => feature)
              .join(" · ")}
          </BodyText>
          {item.features.gui && (
            <BodyText muted>
              This plugin includes a desktop web interface. Its tools and
              commands remain available through the server.
            </BodyText>
          )}
        </Card>
      ))}
    </Page>
  );
};
