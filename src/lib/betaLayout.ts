import { createContext, useContext } from 'react';

export const BetaLayoutContext = createContext(false);
export const useBetaLayout = () => useContext(BetaLayoutContext);
