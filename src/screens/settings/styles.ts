import { StyleSheet } from "react-native";

import { sans } from "../../components/ui";
import { pageInset } from "../../lib/layout";
import type { ThemeColors } from "../../lib/theme";

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    body: { flex: 1, minHeight: 0 },
    card: { gap: 16, padding: 16, paddingHorizontal: 16 },
    cardHeader: {
      flexWrap: "nowrap",
      gap: 12,
      justifyContent: "space-between",
    },
    cardText: { flex: 1, gap: 4, minWidth: 0 },
    cardTitle: {
      fontFamily: sans,
      fontSize: 17,
      fontWeight: "600",
      lineHeight: 24,
    },
    name: { fontFamily: sans, fontSize: 17, fontWeight: "600" },
    page: {
      gap: 16,
      paddingBottom: 80,
      paddingHorizontal: pageInset,
      paddingTop: 24,
    },
    pageDescription: { fontSize: 11, fontWeight: "400", lineHeight: 16 },
    pageHeader: {
      gap: 4,
      paddingHorizontal: pageInset,
      paddingTop: 12,
    },
    pageTitle: {
      fontFamily: sans,
      fontSize: 15,
      fontWeight: "600",
      lineHeight: 20,
    },
    screen: { backgroundColor: colors.bg, flex: 1, minHeight: 0 },
    topBar: {
      alignItems: "center",
      backgroundColor: colors.bg,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      flexDirection: "row",
      gap: 16,
      height: 48,
      justifyContent: "space-between",
      paddingHorizontal: 10,
    },
    topBarLeft: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 1,
      minWidth: 0,
    },
    topBarRight: {
      alignItems: "center",
      flexDirection: "row",
      flexShrink: 0,
      gap: 8,
    },
    sectionLabel: {
      color: colors.muted,
      fontFamily: sans,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginTop: 8,
    },
  });
