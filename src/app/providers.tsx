import type { ReactNode } from "react";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SheetCoordinatorProvider } from "../lib/sheets";
import { ThemeProvider } from "../lib/theme";
import { UnsavedProvider } from "../lib/unsaved";

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders = ({ children }: AppProvidersProps) => (
  <SafeAreaProvider>
    <KeyboardProvider
      statusBarTranslucent
      navigationBarTranslucent
      preserveEdgeToEdge
    >
      <ThemeProvider>
        <SheetCoordinatorProvider>
          <UnsavedProvider>{children}</UnsavedProvider>
        </SheetCoordinatorProvider>
      </ThemeProvider>
    </KeyboardProvider>
  </SafeAreaProvider>
);
