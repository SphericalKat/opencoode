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
  // Increments when a connection change must cancel deferred actions.
  epoch: number;
  form: ConnectionForm;
  // Pairing link from a deep link. Step 6 removes it with the deep-link flow.
  pairingLink: string | null;
  recovering: RecoveryState | null;
  // Registered by the recovery hook so callers always reach the latest one.
  recoverConnection: (connection: Connection, cause: unknown) => unknown;
  unavailableID: string | null;
}

export const {
  Provider: ConnectionStoreProvider,
  useApi: useConnectionStoreApi,
  useSelector: useConnectionStore,
} = createStoreContext<ConnectionState>("Connection store", () => ({
  active: null,
  booting: true,
  connecting: false,
  connectionError: null,
  connections: [],
  epoch: 0,
  form: emptyConnectionForm(),
  pairingLink: null,
  recovering: null,
  recoverConnection: () => null,
  unavailableID: null,
}));
