import { ConnectionFlow } from "../components/connection-flow";
import type { Connection } from "../lib/client";
import { useAppLifecycleStore } from "../stores/app-lifecycle-store";
import {
  useConnectionStore,
  useConnectionStoreApi,
} from "../stores/connection-store";
import { flowError } from "./connection-utils";
import type { useConnection } from "./use-connection";

interface ServerFormProps {
  flowRevision: number;
  hiddenConnections: ReadonlySet<string>;
  onPairingLinkConsumed: () => void;
  onRemove: (connection: Connection) => Promise<void>;
  pairingLink: string | null;
  selectServer: ReturnType<typeof useConnection>["selectServer"];
}

export const ServerForm = ({
  flowRevision,
  hiddenConnections,
  onPairingLinkConsumed,
  onRemove,
  pairingLink,
  selectServer,
}: ServerFormProps) => {
  const connectionApi = useConnectionStoreApi();
  const active = useConnectionStore((state) => state.active);
  const connecting = useConnectionStore((state) => state.connecting);
  const connectionError = useConnectionStore((state) => state.connectionError);
  const connections = useConnectionStore((state) => state.connections);
  const form = useConnectionStore((state) => state.form);
  const unavailableID = useConnectionStore((state) => state.unavailableID);
  const error = useAppLifecycleStore((state) => state.error);
  return (
    <ConnectionFlow
      key={flowRevision}
      form={form}
      connections={connections.filter(
        (connection) => !hiddenConnections.has(connection.id)
      )}
      activeID={active?.id}
      unavailableID={unavailableID ?? undefined}
      connecting={connecting}
      error={flowError(connectionError, active, error)}
      pairingLink={pairingLink}
      onPairingLinkConsumed={onPairingLinkConsumed}
      onChangeForm={(next) => connectionApi.setState({ form: next })}
      onClearError={() => connectionApi.setState({ connectionError: null })}
      onConnect={(connection, alternatives) =>
        selectServer(connection, undefined, alternatives, !!form.name.trim())
      }
      onRemove={onRemove}
    />
  );
};
