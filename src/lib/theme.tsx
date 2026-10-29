import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type Appearance = 'system' | 'light' | 'dark';
export type ThemeColors = {
  bg: string; panel: string; raised: string; border: string; text: string; muted: string; faint: string;
  accent: string; accentText: string; primary: string; primaryText: string; selected: string;
  danger: string; dangerBackground: string; dangerBorder: string; blue: string; success: string;
  successBackground: string; focus: string;
  input: string; controlTopEdge: string;
};

export const darkColors: ThemeColors = {
  bg: '#171717', panel: '#242424', raised: '#333333', border: '#ffffff12', text: '#f0f0f0',
  muted: '#aeaeae', faint: '#858585', accent: '#a2bcff', accentText: '#ffffff', primary: '#333333',
  primaryText: '#f0f0f0', selected: '#303030', danger: '#f17471', dangerBackground: '#461516',
  dangerBorder: '#97252b', blue: '#a2bcff', success: '#6bd586', successBackground: '#14361d', focus: '#7698fd',
  input: '#1b1b1b', controlTopEdge: '#ffffff16',
};

export const lightColors: ThemeColors = {
  bg: '#fafafa', panel: '#ffffff', raised: '#f2f2f2', border: '#0000001a', text: '#161616',
  muted: '#5c5c5c', faint: '#808080', accent: '#3b5cf6', accentText: '#ffffff', primary: '#242424',
  primaryText: '#ffffff', selected: '#eeeeee', danger: '#b82d35', dangerBackground: '#fceceb',
  dangerBorder: '#f2bbb7', blue: '#3b5cf6', success: '#198b43', successBackground: '#e7f9ea', focus: '#7698fd',
  input: '#f2f2f2', controlTopEdge: '#ffffffcc',
};

type Theme = {
  colors: ThemeColors;
  appearance: Appearance;
  scheme: 'light' | 'dark';
  setAppearance: (appearance: Appearance) => Promise<void>;
};

const Context = createContext<Theme>({ colors: darkColors, appearance: 'system', scheme: 'dark', setAppearance: async () => {} });
const preferenceKey = 'opencoode.appearance';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [appearance, updateAppearance] = useState<Appearance>('system');
  const revision = useRef(0);
  useEffect(() => {
    let alive = true;
    const read = async () => Platform.OS === 'web'
      ? globalThis.sessionStorage.getItem(preferenceKey)
      : SecureStore.getItemAsync(preferenceKey);
    void read().then(value => {
      if (alive && revision.current === 0 && (value === 'system' || value === 'dark' || value === 'light')) updateAppearance(value);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const setAppearance = useCallback(async (next: Appearance) => {
    const request = ++revision.current;
    if (Platform.OS === 'web') globalThis.sessionStorage.setItem(preferenceKey, next);
    else await SecureStore.setItemAsync(preferenceKey, next);
    if (request === revision.current) updateAppearance(next);
  }, []);
  const scheme = appearance === 'system' ? system === 'light' ? 'light' : 'dark' : appearance;
  useEffect(() => {
    if (Platform.OS === 'web') document.documentElement.style.colorScheme = scheme;
  }, [scheme]);
  const colors = scheme === 'light' ? lightColors : darkColors;
  const theme = useMemo(() => ({ colors, appearance, scheme, setAppearance }), [colors, appearance, scheme, setAppearance]);
  return <Context.Provider value={theme}>{children}</Context.Provider>;
}

export function useTheme() { return useContext(Context); }

export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
