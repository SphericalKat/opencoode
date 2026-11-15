import { ConnectionFlow } from "../components/connection-flow";
import { useUnsavedGuard } from "../lib/unsaved";
import { useAppLifecycleStore } from "../stores/app-lifecycle-store";
import {
  useConnectionActions,
  useConnectionStore,
} from "../stores/connection-store";
import { flowError } from "./connection-utils";
import { useSelectServer } from "./use-connection";
import { useServerRemoval } from "./use-server-removal";

export const ServerForm = () => {
  const { clearConnectionError, setForm } = useConnectionActions();
  const confirmNavigation = useUnsavedGuard();
  const { selectServer } = useSelectServer({ confirmNavigation });
  const { hiddenConnections, removeConnection } =
    useServerRemoval(confirmNavigation);
  const active = useConnectionStore((state) => state.active);
  const connecting = useConnectionStore((state) => state.connecting);
  const connectionError = useConnectionStore((state) => state.connectionError);
  const connections = useConnectionStore((state) => state.connections);
  const form = useConnectionStore((state) => state.form);
  const unavailableID = useConnectionStore((state) => state.unavailableID);
  const error = useAppLifecycleStore((state) => state.error);
  return (
    <ConnectionFlow
      form={form}
      connections={connections.filter(
        (connection) => !hiddenConnections.has(connection.id)
      )}
      activeID={active?.id}
      unavailableID={unavailableID ?? undefined}
      connecting={connecting}
      error={flowError(connectionError, active, error)}
      onChangeForm={setForm}
      onClearError={clearConnectionError}
      onConnect={(connection, alternatives) =>
        selectServer(connection, undefined, alternatives, !!form.name.trim())
      }
      onRemove={removeConnection}
    />
  );
};
