import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DialogProvider } from "../components/dialog";
import { SnackbarProvider } from "../components/snackbar";
import { createQueryClient } from "../lib/query-client";
import { SheetCoordinatorProvider } from "../lib/sheets";
import { ThemeProvider } from "../lib/theme";
import { UnsavedProvider } from "../lib/unsaved";
import { AppStoresProvider } from "../stores/app-stores-provider";

interface AppProvidersProps {
  children: ReactNode;
}

const queryClient = createQueryClient();

const styles = StyleSheet.create({ root: { flex: 1 } });

export const AppProviders = ({ children }: AppProvidersProps) => (
  <QueryClientProvider client={queryClient}>
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
                <DialogProvider>
                  <SnackbarProvider>
                    <BottomSheetModalProvider>
                      <AppStoresProvider>{children}</AppStoresProvider>
                    </BottomSheetModalProvider>
                  </SnackbarProvider>
                </DialogProvider>
              </UnsavedProvider>
            </SheetCoordinatorProvider>
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  </QueryClientProvider>
);
