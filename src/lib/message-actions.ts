import { createContext } from "react";
import type { GestureResponderEvent } from "react-native";

export const MessageActionsContext = createContext<
  ((event: GestureResponderEvent) => void) | undefined
>(undefined);

export const MessageDisclosureContext = createContext<
  | {
      isOpen: (key: string) => boolean;
      setOpen: (key: string, open: boolean) => void;
      toggle: (key: string) => boolean;
    }
  | undefined
>(undefined);
