import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { SheetCoordinatorProvider } from "../lib/sheets";
import { ThemeProvider } from "../lib/theme";
import { UnsavedProvider } from "../lib/unsaved";

interface AppProvidersProps {
  children: ReactNode;
}

const styles = StyleSheet.create({ root: { flex: 1 } });

export const AppProviders = ({ children }: AppProvidersProps) => (
  <GestureHandlerRootView style={styles.root}>
    <SafeAreaProvider>
      <KeyboardProvider
        statusBarTranslucent
        navigationBarTranslucent
        preserveEdgeToEdge
      >
        <ThemeProvider>
          <SheetCoordinatorProvider>
            <UnsavedProvider>
              <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
            </UnsavedProvider>
          </SheetCoordinatorProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);
