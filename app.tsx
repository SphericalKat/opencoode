import { useFonts } from "expo-font";
import { Platform, useWindowDimensions, View } from "react-native";

import ibmPlexMonoFont from "./assets/fonts/IBMPlexMono-Text.ttf";
import interFont from "./assets/fonts/Inter.ttf";
import { MobileApp } from "./src/app/mobile-app";
import { AppProviders } from "./src/app/providers";
import { ThemedStatusBar } from "./src/app/themed-status-bar";

const fonts = {
  IBMPlexMono: ibmPlexMonoFont,
  Inter: interFont,
};

const App = () => {
  const { width } = useWindowDimensions();
  const betaLayout = Platform.OS === "android" && width < 920;
  const [fontsReady, fontError] = useFonts(fonts);
  if (!fontsReady && !fontError) {
    return <View style={{ backgroundColor: "#080808", flex: 1 }} />;
  }
  return (
    <AppProviders betaLayout={betaLayout}>
      <ThemedStatusBar />
      <MobileApp />
    </AppProviders>
  );
};

export default App;
