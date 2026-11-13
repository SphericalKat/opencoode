import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { StoreApi } from "zustand/vanilla";

interface SheetVisibility {
  moreOpen: boolean;
  navigationOpen: boolean;
  setMoreOpen: (open: boolean) => void;
  setNavigationOpen: (open: boolean) => void;
}

type SheetVisibilityStore = StoreApi<SheetVisibility>;

const createSheetVisibilityStore = (): SheetVisibilityStore =>
  createStore<SheetVisibility>()((set) => ({
    moreOpen: false,
    navigationOpen: false,
    setMoreOpen: (moreOpen) => set({ moreOpen }),
    setNavigationOpen: (navigationOpen) => set({ navigationOpen }),
  }));

const SheetVisibilityContext = createContext<SheetVisibilityStore | null>(null);

// Each screen that owns sheets mounts its own provider, so visibility resets
// with the screen and the main app and Pi never share flags.
export const SheetVisibilityProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const store = useMemo(() => createSheetVisibilityStore(), []);
  return (
    <SheetVisibilityContext.Provider value={store}>
      {children}
    </SheetVisibilityContext.Provider>
  );
};

const useSheetVisibilityStore = () => {
  const store = useContext(SheetVisibilityContext);
  if (!store) {
    throw new Error("Sheet visibility is used outside SheetVisibilityProvider");
  }
  return store;
};

// Returns the store's actions and getState without subscribing, so the caller
// does not re-render when a sheet opens or closes.
export const useSheetVisibilityActions = () => {
  const store = useSheetVisibilityStore();
  const { setMoreOpen, setNavigationOpen } = store.getState();
  return { getState: store.getState, setMoreOpen, setNavigationOpen };
};

export const useSheetVisibility = <T,>(
  selector: (state: SheetVisibility) => T
) => useStore(useSheetVisibilityStore(), selector);
