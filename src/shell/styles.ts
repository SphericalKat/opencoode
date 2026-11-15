import { StyleSheet } from "react-native";

import type { ThemeColors } from "../lib/theme";

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    banner: { paddingBottom: 8, paddingHorizontal: 12 },
    betaOnboarding: { justifyContent: "center", paddingVertical: 32 },
    body: { flex: 1, flexDirection: "row", minHeight: 0 },
    boot: { alignItems: "center", flex: 1, justifyContent: "center" },
    flex: { flex: 1 },
    full: { flex: 1, minHeight: 0, minWidth: 0 },
    hidden: { display: "none" },
    main: { flex: 1, minHeight: 0, minWidth: 0 },
    onboarding: {
      alignSelf: "center",
      flexGrow: 1,
      gap: 16,
      maxWidth: 520,
      padding: 24,
      paddingVertical: 40,
      width: "100%",
    },
    pressed: { backgroundColor: colors.selected },
    projectName: { fontSize: 14, fontWeight: "500" },
    row: { flexDirection: "row" },
    safe: { backgroundColor: colors.bg, flex: 1 },
    serverName: { fontSize: 13, fontWeight: "500" },
    shell: { flex: 1, flexDirection: "row", minHeight: 0 },
    welcome: {
      alignItems: "center",
      flex: 1,
      gap: 20,
      justifyContent: "center",
      padding: 32,
    },
    welcomeDetail: { lineHeight: 24, maxWidth: 320, textAlign: "center" },
  });
