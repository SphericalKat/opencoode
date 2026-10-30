import { createContext } from 'react';

export const MessageActionsContext = createContext<(() => void) | undefined>(undefined);

export const MessageDisclosureContext = createContext<{
  isOpen: (key: string) => boolean;
  toggle: (key: string) => boolean;
} | undefined>(undefined);
