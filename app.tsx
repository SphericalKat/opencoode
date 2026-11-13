import { useFonts } from "expo-font";
import { View } from "react-native";

import ibmPlexMonoFont from "./assets/fonts/IBMPlexMono-Text.ttf";
import interFont from "./assets/fonts/Inter.ttf";
import { MobileApp } from "./src/app/mobile-app";
import { AppProviders } from "./src/app/providers";
import { ThemedStatusBar } from "./src/app/themed-status-bar";
import { SheetVisibilityProvider } from "./src/lib/sheet-visibility";

const fonts = {
  IBMPlexMono: ibmPlexMonoFont,
  Inter: interFont,
};

const App = () => {
  const [fontsReady, fontError] = useFonts(fonts);
  if (!fontsReady && !fontError) {
    return <View style={{ backgroundColor: "#080808", flex: 1 }} />;
  }
  return (
    <AppProviders>
      <ThemedStatusBar />
      <SheetVisibilityProvider>
        <MobileApp />
      </SheetVisibilityProvider>
    </AppProviders>
  );
};

export default App;
