import {
  isDynamicThemeSupported,
  useMaterial3Theme,
} from "@pchmn/expo-material3-theme";
import type { Material3Scheme } from "@pchmn/expo-material3-theme";
import * as SecureStore from "expo-secure-store";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform, useColorScheme } from "react-native";

import { useBetaLayout } from "./beta-layout";
import upstreamThemes from "./upstreamThemes.json";

export type Appearance = "system" | "light" | "dark";
export interface ThemeColors {
  frame: string;
  bg: string;
  panel: string;
  raised: string;
  border: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentText: string;
  primary: string;
  primaryText: string;
  selected: string;
  danger: string;
  dangerBackground: string;
  dangerBorder: string;
  blue: string;
  success: string;
  successBackground: string;
  focus: string;
  input: string;
  controlTopEdge: string;
  syntaxComment: string;
  syntaxString: string;
  syntaxKeyword: string;
  syntaxNumber: string;
  syntaxProperty: string;
  syntaxType: string;
  syntaxConstant: string;
}

export const darkColors: ThemeColors = {
  accent: "#a2bcff",
  accentText: "#ffffff",
  bg: "#171717",
  blue: "#a2bcff",
  border: "#ffffff12",
  controlTopEdge: "#ffffff16",
  danger: "#f17471",
  dangerBackground: "#461516",
  dangerBorder: "#97252b",
  faint: "#858585",
  focus: "#7698fd",
  frame: "#171717",
  input: "#1b1b1b",
  muted: "#aeaeae",
  panel: "#242424",
  primary: "#333333",
  primaryText: "#f0f0f0",
  raised: "#333333",
  selected: "#303030",
  success: "#6bd586",
  successBackground: "#14361d",
  syntaxComment: "#858585",
  syntaxConstant: "#a2bcff",
  syntaxKeyword: "#cf9cff",
  syntaxNumber: "#ffba92",
  syntaxProperty: "#93e9f6",
  syntaxString: "#6bd586",
  syntaxType: "#ecf58c",
  text: "#f0f0f0",
};

export const lightColors: ThemeColors = {
  accent: "#3b5cf6",
  accentText: "#ffffff",
  bg: "#fafafa",
  blue: "#3b5cf6",
  border: "#0000001a",
  controlTopEdge: "#ffffffcc",
  danger: "#b82d35",
  dangerBackground: "#fceceb",
  dangerBorder: "#f2bbb7",
  faint: "#808080",
  focus: "#7698fd",
  frame: "#fafafa",
  input: "#f2f2f2",
  muted: "#5c5c5c",
  panel: "#ffffff",
  primary: "#242424",
  primaryText: "#ffffff",
  raised: "#f2f2f2",
  selected: "#eeeeee",
  success: "#198b43",
  successBackground: "#e7f9ea",
  syntaxComment: "#5c5c5c",
  syntaxConstant: "#3b5cf6",
  syntaxKeyword: "#8038a8",
  syntaxNumber: "#a84b16",
  syntaxProperty: "#006e83",
  syntaxString: "#198b43",
  syntaxType: "#596600",
  text: "#161616",
};

interface Theme {
  colors: ThemeColors;
  appearance: Appearance;
  scheme: "light" | "dark";
  setAppearance: (appearance: Appearance) => Promise<void>;
  palette: string;
  setPalette: (palette: string) => Promise<void>;
}

const Context = createContext<Theme>({
  appearance: "system",
  colors: darkColors,
  palette: "default",
  scheme: "dark",
  setAppearance: () => Promise.resolve(),
  setPalette: () => Promise.resolve(),
});
const preferenceKey = "opencoode.appearance";
const paletteKey = "opencoode.palette";
export const paletteOptions = [
  { id: "default", name: "OpenCoode" },
  ...(Platform.OS === "android"
    ? [{ id: "dynamic", name: "Material You" }]
    : []),
  ...upstreamThemes.map(({ id, name }) => ({ id, name })),
];

const betaDarkColors: ThemeColors = {
  ...darkColors,
  bg: "#161616",
  border: "#ffffff1a",
  frame: "#080808",
  text: "#fafafa",
};
const betaLightColors: ThemeColors = {
  ...lightColors,
  bg: "#ffffff",
  input: "#fafafa",
  panel: "#fafafa",
  selected: "#f2f2f2",
};

const mapPreset = (
  t: Record<string, string>,
  fallback: ThemeColors
): ThemeColors => {
  const color = (key: string, otherwise: string) =>
    t[key]?.startsWith("#") ? t[key] : otherwise;
  return {
    ...fallback,
    accent: color("text-interactive-base", fallback.accent),
    accentText: color("text-on-interactive-base", fallback.accentText),
    bg: color("background-base", fallback.bg),
    blue: color("text-interactive-base", fallback.blue),
    border: color("border-base", fallback.border),
    danger: color("text-diff-delete-base", fallback.danger),
    dangerBackground: color("surface-critical-weak", fallback.dangerBackground),
    dangerBorder: color("border-critical-base", fallback.dangerBorder),
    faint: color("text-weaker", fallback.faint),
    focus: color("border-focus", fallback.focus),
    frame: color("background-base", fallback.bg),
    input: color("input-base", fallback.input),
    muted: color("text-weak", fallback.muted),
    panel: color("surface-base", fallback.panel),
    primary: color("button-primary-base", fallback.primary),
    primaryText: color("background-base", fallback.primaryText),
    raised: color("surface-raised-stronger-non-alpha", fallback.raised),
    selected: color("surface-interactive-weak", fallback.selected),
    success: color("text-diff-add-base", fallback.success),
    successBackground: color(
      "surface-success-weak",
      fallback.successBackground
    ),
    syntaxComment: color("syntax-comment", fallback.syntaxComment),
    syntaxConstant: color("syntax-constant", fallback.syntaxConstant),
    syntaxKeyword: color("syntax-keyword", fallback.syntaxKeyword),
    syntaxNumber: color("syntax-primitive", fallback.syntaxNumber),
    syntaxProperty: color("syntax-property", fallback.syntaxProperty),
    syntaxString: color("syntax-string", fallback.syntaxString),
    syntaxType: color("syntax-type", fallback.syntaxType),
    text: color("text-base", fallback.text),
  };
};

const dynamicColors = (
  t: Material3Scheme,
  fallback: ThemeColors
): ThemeColors => ({
  ...fallback,
  accent: t.primary,
  accentText: t.onPrimary,
  bg: t.background,
  blue: t.primary,
  border: t.outlineVariant,
  danger: t.error,
  dangerBackground: t.errorContainer,
  dangerBorder: t.error,
  faint: t.outline,
  focus: t.primary,
  frame: t.background,
  input: t.surfaceContainer,
  muted: t.onSurfaceVariant,
  panel: t.surface,
  primary: t.primary,
  primaryText: t.onPrimary,
  raised: t.surfaceContainerHigh,
  selected: t.secondaryContainer,
  syntaxConstant: t.tertiary,
  syntaxKeyword: t.primary,
  syntaxProperty: t.secondary,
  text: t.onBackground,
});

const resolveScheme = (
  appearance: Appearance,
  system: ReturnType<typeof useColorScheme>
): "light" | "dark" => {
  if (appearance !== "system") {
    return appearance;
  }
  return system === "light" ? "light" : "dark";
};

const fallbackColors = (
  betaLayout: boolean,
  scheme: "light" | "dark"
): ThemeColors => {
  if (betaLayout) {
    return scheme === "light" ? betaLightColors : betaDarkColors;
  }
  return scheme === "light" ? lightColors : darkColors;
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const betaLayout = useBetaLayout();
  const system = useColorScheme();
  const { theme: materialTheme } = useMaterial3Theme();
  const [appearanceState, setAppearanceState] = useState<Appearance>("system");
  const revision = useRef(0);
  const paletteRevision = useRef(0);
  const [paletteState, setPaletteState] = useState("default");
  useEffect(() => {
    let alive = true;
    const read =
      Platform.OS === "web"
        ? Promise.resolve(globalThis.sessionStorage.getItem(paletteKey))
        : SecureStore.getItemAsync(paletteKey);
    void read
      .then((value) => {
        if (
          alive &&
          paletteRevision.current === 0 &&
          value &&
          (value === "dynamic" ||
            upstreamThemes.some((theme) => theme.id === value))
        ) {
          setPaletteState(value);
        }
        return null;
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);
  const setPalette = useCallback(async (next: string) => {
    paletteRevision.current += 1;
    const request = paletteRevision.current;
    if (Platform.OS === "web") {
      globalThis.sessionStorage.setItem(paletteKey, next);
    } else {
      await SecureStore.setItemAsync(paletteKey, next);
    }
    if (request === paletteRevision.current) {
      setPaletteState(next);
    }
  }, []);
  useEffect(() => {
    let alive = true;
    const read = async () =>
      Platform.OS === "web"
        ? globalThis.sessionStorage.getItem(preferenceKey)
        : await SecureStore.getItemAsync(preferenceKey);
    void read()
      .then((value) => {
        if (
          alive &&
          revision.current === 0 &&
          (value === "system" || value === "dark" || value === "light")
        ) {
          setAppearanceState(value);
        }
        return null;
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  const setAppearance = useCallback(async (next: Appearance) => {
    revision.current += 1;
    const request = revision.current;
    if (Platform.OS === "web") {
      globalThis.sessionStorage.setItem(preferenceKey, next);
    } else {
      await SecureStore.setItemAsync(preferenceKey, next);
    }
    if (request === revision.current) {
      setAppearanceState(next);
    }
  }, []);
  const scheme = resolveScheme(appearanceState, system);
  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.style.colorScheme = scheme;
    }
  }, [scheme]);
  const fallback = fallbackColors(betaLayout, scheme);
  const colors = useMemo(() => {
    const preset = upstreamThemes.find((item) => item.id === paletteState);
    if (preset) {
      return mapPreset(preset[scheme], fallback);
    }
    if (paletteState === "dynamic" && isDynamicThemeSupported) {
      return dynamicColors(materialTheme[scheme], fallback);
    }
    return fallback;
  }, [paletteState, scheme, fallback, materialTheme]);
  const theme = useMemo(
    () => ({
      appearance: appearanceState,
      colors,
      palette: paletteState,
      scheme,
      setAppearance,
      setPalette,
    }),
    [colors, appearanceState, scheme, setAppearance, paletteState, setPalette]
  );
  return <Context.Provider value={theme}>{children}</Context.Provider>;
};

export const useTheme = () => useContext(Context);

export const useThemedStyles = <T,>(factory: (colors: ThemeColors) => T): T => {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
};
