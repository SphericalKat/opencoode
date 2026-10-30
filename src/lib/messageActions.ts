import { createContext } from 'react';

export const MessageActionsContext = createContext<(() => void) | undefined>(undefined);
