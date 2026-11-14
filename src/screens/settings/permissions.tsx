import type { PermissionSavedInfo } from "@opencode/client";
import { useState } from "react";

import { useUndoableRemoval } from "../../components/snackbar";
import {
  Button,
  Card,
  Empty,
  ErrorNotice,
  Field,
  BodyText,
  mono,
  Row,
  Sheet,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { withSettingsRequest } from "../../lib/settings";
import { useThemedStyles } from "../../lib/theme";
import { Page, runBusy, useResource } from "./shared";
import { createStyles } from "./styles";

export const Permissions = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(
    client,
    directory,
    async (signal) => {
      const location = await client.location.get(
        { location: { directory } },
        { signal }
      );
      return client.permission.saved.list(
        { projectID: location.project.id },
        { signal }
      );
    }
  );
  const { hidden, remove: removeApproval } = useUndoableRemoval("approvals");
  const visible = data?.filter((item) => !hidden.has(item.id));
  const [selected, setSelected] = useState<PermissionSavedInfo>();
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const run = async (task: (signal: AbortSignal) => Promise<void>) => {
    setErrorAction(null);
    await runBusy(setBusy, setErrorAction, async () => {
      await withSettingsRequest(async (signal) => {
        await task(signal);
        await refresh(signal);
      });
    });
  };
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <BodyText muted>
        These are the approvals that you saved with “Always allow” in this
        project.
      </BodyText>
      <ErrorNotice error={errorAction} />
      {visible?.map((item) => (
        <Card key={item.id}>
          <BodyText style={styles.name}>{item.action}</BodyText>
          <BodyText style={{ fontFamily: mono }}>{item.resource}</BodyText>
          <Row>
            <Button
              title="Edit"
              size="compact"
              disabled={busy}
              onPress={() => {
                setSelected(item);
                setAction(item.action);
                setResource(item.resource);
                setErrorAction(null);
              }}
            />
            <Button
              title="Revoke"
              variant="danger"
              size="compact"
              busy={busy}
              onPress={() => {
                removeApproval(item.id, {
                  commit: () =>
                    withSettingsRequest(async (signal) => {
                      await client.permission.saved.remove(
                        { id: item.id },
                        { signal }
                      );
                      await refresh(signal);
                    }),
                  message: "Approval revoked",
                });
              }}
            />
          </Row>
        </Card>
      ))}
      {visible && !visible.length && (
        <Empty
          title="No saved approvals"
          detail="OpenCode will ask you before protected actions."
        />
      )}
      <Sheet
        visible={!!selected}
        title="Edit saved approval"
        onClose={() => {
          if (!busy) {
            setSelected(undefined);
          }
        }}
      >
        <ErrorNotice error={errorAction} />
        <Field
          label="Action"
          value={action}
          editable={!busy}
          onChangeText={setAction}
        />
        <Field
          label="Resource pattern"
          value={resource}
          editable={!busy}
          onChangeText={setResource}
        />
        <Button
          title="Save approval"
          variant="primary"
          busy={busy}
          disabled={!action.trim() || !resource.trim()}
          onPress={() => {
            void run(async (signal) => {
              if (!selected) {
                return;
              }
              await client.permission.saved.update(
                {
                  action: action.trim(),
                  id: selected.id,
                  resource: resource.trim(),
                },
                { signal }
              );
              signal.throwIfAborted();
              setSelected(undefined);
            });
          }}
        />
      </Sheet>
    </Page>
  );
};
