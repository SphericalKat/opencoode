import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { StateCreator, StoreApi } from "zustand/vanilla";

// A vanilla store behind a context.
// `useSelector` subscribes. `useApi` returns the store without subscribing,
// for `getState()` calls inside callbacks and effects. `useActions` returns
// the named actions of the store. It does not subscribe, and its result is
// stable for the life of the provider.
export const createStoreContext = <State, Actions extends object>(
  name: string,
  initializer: StateCreator<State>,
  createActions: (store: StoreApi<State>) => Actions
) => {
  const Context = createContext<StoreApi<State> | null>(null);

  const Provider = ({ children }: { children: ReactNode }) => {
    const store = useMemo(() => createStore<State>()(initializer), []);
    return <Context.Provider value={store}>{children}</Context.Provider>;
  };

  const useApi = () => {
    const store = useContext(Context);
    if (!store) {
      throw new Error(`${name} is used outside its provider`);
    }
    return store;
  };

  const useSelector = <T,>(selector: (state: State) => T) =>
    useStore(useApi(), selector);

  const useActions = () => {
    const store = useApi();
    return useMemo(() => createActions(store), [store]);
  };

  return { Provider, useActions, useApi, useSelector };
};
