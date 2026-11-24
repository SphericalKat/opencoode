import { createContext, useContext } from "react";
import type { ReactNode } from "react";

import type { Scope } from "./query-keys";

const ServerScopeContext = createContext<Scope | null>(null);

export const ServerScopeProvider = ({
  children,
  scope,
}: {
  children: ReactNode;
  scope: Scope | null;
}) => (
  <ServerScopeContext.Provider value={scope}>
    {children}
  </ServerScopeContext.Provider>
);

// The scope is `Connection.id`. Every query key starts with it, so
// `invalidateQueries({ queryKey: [scope] })` reaches one server's data.
export const useServerScope = (): Scope => {
  const scope = useContext(ServerScopeContext);
  if (!scope) {
    throw new Error("Server data is used outside a server connection");
  }
  return scope;
};
