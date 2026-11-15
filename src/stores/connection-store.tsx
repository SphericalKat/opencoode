import type { StoreApi } from "zustand/vanilla";

import { isConnectionUnauthorized } from "../lib/client";
import type { Connection } from "../lib/client";
import { createStoreContext } from "./create-store-context";

export interface ConnectionForm {
  id: string;
  name: string;
  token: string;
  url: string;
  username?: string;
}

export interface RecoveryState {
  connection: Connection;
  message: string;
}

export const emptyConnectionForm = (): ConnectionForm => ({
  id: "",
  name: "",
  token: "",
  url: "",
});

export interface ConnectionState {
  active: Connection | null;
  booting: boolean;
  connecting: boolean;
  connectionError: string | null;
  connections: Connection[];
  form: ConnectionForm;
  recovering: RecoveryState | null;
  unavailableID: string | null;
}

const recoveryMessage = (connection: Connection, cause: unknown) =>
  isConnectionUnauthorized(cause)
    ? `${connection.name} rejected the saved password. Pair again or update its saved connection.`
    : `${connection.name} is not responding. Retry it or connect to another server.`;

const createActions = (store: StoreApi<ConnectionState>) => ({
  // Makes `connected` the active connection and clears the recovery state.
  activate: (connected: Connection, connections: Connection[]) =>
    store.setState({
      active: connected,
      connections,
      form: emptyConnectionForm(),
      recovering: null,
      unavailableID: null,
    }),
  // Starts a connection attempt.
  beginConnecting: () =>
    store.setState({ connecting: true, connectionError: null }),
  clearActive: () => store.setState({ active: null }),
  clearForm: () => store.setState({ form: emptyConnectionForm() }),
  clearConnectionError: () => store.setState({ connectionError: null }),
  // Ends recovery after a healthy probe of `owner`. Returns false when
  // `owner` is not the connection in recovery.
  clearRecovery: (owner: Connection) => {
    const { recovering } = store.getState();
    if (recovering?.connection !== owner) {
      return false;
    }
    store.setState((state) => ({
      connectionError:
        state.connectionError === recovering.message
          ? null
          : state.connectionError,
      recovering: null,
      unavailableID:
        state.unavailableID === owner.id ? null : state.unavailableID,
    }));
    return true;
  },
  finishBoot: () => store.setState({ booting: false }),
  finishConnecting: () => store.setState({ connecting: false }),
  // Marks the active connection as failing. Returns false when `connection`
  // is not active, a connection attempt runs or recovery already started.
  markRecovering: (connection: Connection, cause: unknown) => {
    const { active, connecting, recovering } = store.getState();
    if (
      active !== connection ||
      connecting ||
      recovering?.connection === connection
    ) {
      return false;
    }
    const message = recoveryMessage(connection, cause);
    store.setState({
      connectionError: message,
      recovering: { connection, message },
      unavailableID: connection.id,
    });
    return true;
  },
  markUnavailable: (id: string) => store.setState({ unavailableID: id }),
  // Opens the server form empty, without an error.
  resetForm: () =>
    store.setState({ connectionError: null, form: emptyConnectionForm() }),
  setConnectionError: (connectionError: string | null) =>
    store.setState({ connectionError }),
  setConnections: (connections: Connection[]) =>
    store.setState({ connections }),
  setForm: (form: ConnectionForm) => store.setState({ form }),
});

export const {
  Provider: ConnectionStoreProvider,
  useActions: useConnectionActions,
  useApi: useConnectionStoreApi,
  useSelector: useConnectionStore,
} = createStoreContext<ConnectionState, ReturnType<typeof createActions>>(
  "Connection store",
  () => ({
    active: null,
    booting: true,
    connecting: false,
    connectionError: null,
    connections: [],
    form: emptyConnectionForm(),
    recovering: null,
    unavailableID: null,
  }),
  createActions
);
