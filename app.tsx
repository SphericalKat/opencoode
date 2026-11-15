import { useFonts } from "expo-font";
import { View } from "react-native";

import ibmPlexMonoMediumFont from "./assets/fonts/IBMPlexMono-Medium.ttf";
import ibmPlexMonoFont from "./assets/fonts/IBMPlexMono-Text.ttf";
import interFont from "./assets/fonts/Inter.ttf";
import { SheetVisibilityProvider } from "./src/lib/sheet-visibility";
import { MobileApp } from "./src/shell/mobile-app";
import { AppProviders } from "./src/shell/providers";
import { ThemedStatusBar } from "./src/shell/themed-status-bar";

const fonts = {
  IBMPlexMono: ibmPlexMonoFont,
  "IBMPlexMono-Medium": ibmPlexMonoMediumFont,
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
