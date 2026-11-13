import type { ReactNode } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BetaLayoutContext } from "../lib/beta-layout";
import { SheetCoordinatorProvider } from "../lib/sheets";
import { ThemeProvider } from "../lib/theme";
import { UnsavedProvider } from "../lib/unsaved";

interface AppProvidersProps {
  betaLayout: boolean;
  children: ReactNode;
}

export const AppProviders = ({ betaLayout, children }: AppProvidersProps) => (
  <SafeAreaProvider>
    <KeyboardProvider
      statusBarTranslucent
      navigationBarTranslucent
      preserveEdgeToEdge
    >
      <BetaLayoutContext.Provider value={betaLayout}>
        <ThemeProvider>
          <SheetCoordinatorProvider>
            <UnsavedProvider>{children}</UnsavedProvider>
          </SheetCoordinatorProvider>
        </ThemeProvider>
      </BetaLayoutContext.Provider>
    </KeyboardProvider>
  </SafeAreaProvider>
);
