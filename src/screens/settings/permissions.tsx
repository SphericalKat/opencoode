import type { PermissionSavedInfo } from "@opencode/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SheetGroup } from "../../components/list-sheet";
import { useUndoableRemoval } from "../../components/snackbar";
import {
  BodyText,
  Button,
  Empty,
  ErrorNotice,
  Field,
  Sheet,
} from "../../components/ui";
import type { Client } from "../../lib/client";
import { savedPermissionsOptions } from "../../lib/queries/settings";
import { queryKeys } from "../../lib/query-keys";
import { useServerScope } from "../../lib/server-scope";
import { MonoRow } from "./configuration";
import {
  Page,
  resourceOf,
  useSettingsBusy,
  useSettingsMutation,
} from "./shared";

export const Permissions = ({
  client,
  directory,
}: {
  client: Client;
  directory: string;
}) => {
  const scope = useServerScope();
  const queryClient = useQueryClient();
  const { data, error, loading, refresh } = resourceOf(
    useQuery(savedPermissionsOptions(queryClient, scope, client, directory))
  );
  const { hidden, remove: removeApproval } = useUndoableRemoval("approvals");
  const visible = data?.filter((item) => !hidden.has(item.id));
  const [selected, setSelected] = useState<PermissionSavedInfo>();
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const busy = useSettingsBusy();
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const approvalKeys = () => [
    queryKeys.dir.settings(scope, directory, "permissions"),
  ];
  const saveApproval = useSettingsMutation({
    invalidate: approvalKeys,
    mutationFn: async (_input, signal) => {
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
    },
    onError: setErrorAction,
  });
  const revokeApproval = useSettingsMutation({
    invalidate: approvalKeys,
    mutationFn: async (id: string, signal) => {
      await client.permission.saved.remove({ id }, { signal });
    },
    onError: setErrorAction,
  });
  return (
    <Page error={error} loading={loading} refresh={refresh}>
      <BodyText muted>
        These are the approvals that you saved with “Always allow” in this
        project.
      </BodyText>
      <ErrorNotice error={errorAction} />
      {visible && visible.length > 0 && (
        <SheetGroup variant="grouped" title="Saved approvals">
          {visible.map((item) => (
            <MonoRow
              key={item.id}
              label={item.action}
              subtitle={item.resource}
              disabled={busy}
              onPress={() => {
                setSelected(item);
                setAction(item.action);
                setResource(item.resource);
                setErrorAction(null);
              }}
            />
          ))}
        </SheetGroup>
      )}
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
            setErrorAction(null);
            saveApproval.mutate();
          }}
        />
        <Button
          title="Revoke approval"
          variant="danger"
          disabled={busy}
          onPress={() => {
            if (!selected) {
              return;
            }
            const { id } = selected;
            setSelected(undefined);
            removeApproval(id, {
              commit: () => revokeApproval.mutateAsync(id),
              message: "Approval revoked",
            });
          }}
        />
      </Sheet>
    </Page>
  );
};
