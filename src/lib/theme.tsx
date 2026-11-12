import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { isDynamicThemeSupported, useMaterial3Theme, type Material3Scheme } from '@pchmn/expo-material3-theme';
import { useBetaLayout } from './betaLayout';
import upstreamThemes from './upstreamThemes.json';

export type Appearance = 'system' | 'light' | 'dark';
export type ThemeColors = {
  frame: string; bg: string; panel: string; raised: string; border: string; text: string; muted: string; faint: string;
  accent: string; accentText: string; primary: string; primaryText: string; selected: string;
  danger: string; dangerBackground: string; dangerBorder: string; blue: string; success: string;
  successBackground: string; focus: string;
  input: string; controlTopEdge: string;
  syntaxComment: string; syntaxString: string; syntaxKeyword: string; syntaxNumber: string; syntaxProperty: string; syntaxType: string; syntaxConstant: string;
};

export const darkColors: ThemeColors = {
  frame: '#171717', bg: '#171717', panel: '#242424', raised: '#333333', border: '#ffffff12', text: '#f0f0f0',
  muted: '#aeaeae', faint: '#858585', accent: '#a2bcff', accentText: '#ffffff', primary: '#333333',
  primaryText: '#f0f0f0', selected: '#303030', danger: '#f17471', dangerBackground: '#461516',
  dangerBorder: '#97252b', blue: '#a2bcff', success: '#6bd586', successBackground: '#14361d', focus: '#7698fd',
  input: '#1b1b1b', controlTopEdge: '#ffffff16',
  syntaxComment: '#858585', syntaxString: '#6bd586', syntaxKeyword: '#cf9cff', syntaxNumber: '#ffba92', syntaxProperty: '#93e9f6', syntaxType: '#ecf58c', syntaxConstant: '#a2bcff',
};

export const lightColors: ThemeColors = {
  frame: '#fafafa', bg: '#fafafa', panel: '#ffffff', raised: '#f2f2f2', border: '#0000001a', text: '#161616',
  muted: '#5c5c5c', faint: '#808080', accent: '#3b5cf6', accentText: '#ffffff', primary: '#242424',
  primaryText: '#ffffff', selected: '#eeeeee', danger: '#b82d35', dangerBackground: '#fceceb',
  dangerBorder: '#f2bbb7', blue: '#3b5cf6', success: '#198b43', successBackground: '#e7f9ea', focus: '#7698fd',
  input: '#f2f2f2', controlTopEdge: '#ffffffcc',
  syntaxComment: '#5c5c5c', syntaxString: '#198b43', syntaxKeyword: '#8038a8', syntaxNumber: '#a84b16', syntaxProperty: '#006e83', syntaxType: '#596600', syntaxConstant: '#3b5cf6',
};

type Theme = {
  colors: ThemeColors;
  appearance: Appearance;
  scheme: 'light' | 'dark';
  setAppearance: (appearance: Appearance) => Promise<void>;
  palette: string; setPalette: (palette: string) => Promise<void>;
};

const Context = createContext<Theme>({ colors: darkColors, appearance: 'system', scheme: 'dark', setAppearance: async () => {}, palette: 'default', setPalette: async () => {} });
const preferenceKey = 'opencoode.appearance';
const paletteKey = 'opencoode.palette';
export const paletteOptions = [{ id: 'default', name: 'OpenCoode' }, ...(Platform.OS === 'android' ? [{ id: 'dynamic', name: 'Material You' }] : []), ...upstreamThemes.map(({ id, name }) => ({ id, name }))];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const betaLayout = useBetaLayout();
  const system = useColorScheme();
  const { theme: materialTheme } = useMaterial3Theme();
  const [appearance, updateAppearance] = useState<Appearance>('system');
  const revision = useRef(0);
  const paletteRevision = useRef(0);
  const [palette, updatePalette] = useState('default');
  useEffect(() => {
    let alive = true;
    const read = Platform.OS === 'web' ? Promise.resolve(globalThis.sessionStorage.getItem(paletteKey)) : SecureStore.getItemAsync(paletteKey);
    void read.then(value => { if (alive && paletteRevision.current === 0 && value && (value === 'dynamic' || upstreamThemes.some(theme => theme.id === value))) updatePalette(value); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const setPalette = useCallback(async (next: string) => {
    const request = ++paletteRevision.current;
    if (Platform.OS === 'web') globalThis.sessionStorage.setItem(paletteKey, next);
    else await SecureStore.setItemAsync(paletteKey, next);
    if (request === paletteRevision.current) updatePalette(next);
  }, []);
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
  const fallback = betaLayout ? scheme === 'light' ? betaLightColors : betaDarkColors : scheme === 'light' ? lightColors : darkColors;
  const colors = useMemo(() => {
    const preset = upstreamThemes.find(item => item.id === palette);
    if (preset) return mapPreset(preset[scheme], fallback);
    if (palette === 'dynamic' && isDynamicThemeSupported) return dynamicColors(materialTheme[scheme], fallback);
    return fallback;
  }, [palette, scheme, fallback, materialTheme]);
  const theme = useMemo(() => ({ colors, appearance, scheme, setAppearance, palette, setPalette }), [colors, appearance, scheme, setAppearance, palette, setPalette]);
  return <Context.Provider value={theme}>{children}</Context.Provider>;
}

const betaDarkColors: ThemeColors = { ...darkColors, frame: '#080808', bg: '#161616', text: '#fafafa', border: '#ffffff1a' };
const betaLightColors: ThemeColors = { ...lightColors, bg: '#ffffff', panel: '#fafafa', input: '#fafafa', selected: '#f2f2f2' };

export function useTheme() { return useContext(Context); }

export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}

function mapPreset(t: Record<string, string>, fallback: ThemeColors): ThemeColors {
  const color = (key: string, otherwise: string) => t[key]?.startsWith('#') ? t[key] : otherwise;
  return { ...fallback,
    frame: color('background-base', fallback.bg), bg: color('background-base', fallback.bg), panel: color('surface-base', fallback.panel), raised: color('surface-raised-stronger-non-alpha', fallback.raised), border: color('border-base', fallback.border),
    text: color('text-base', fallback.text), muted: color('text-weak', fallback.muted), faint: color('text-weaker', fallback.faint),
    accent: color('text-interactive-base', fallback.accent), accentText: color('text-on-interactive-base', fallback.accentText), primary: color('button-primary-base', fallback.primary), primaryText: color('background-base', fallback.primaryText), selected: color('surface-interactive-weak', fallback.selected),
    danger: color('text-diff-delete-base', fallback.danger), dangerBackground: color('surface-critical-weak', fallback.dangerBackground), dangerBorder: color('border-critical-base', fallback.dangerBorder), blue: color('text-interactive-base', fallback.blue), success: color('text-diff-add-base', fallback.success), successBackground: color('surface-success-weak', fallback.successBackground), focus: color('border-focus', fallback.focus), input: color('input-base', fallback.input),
    syntaxComment: color('syntax-comment', fallback.syntaxComment), syntaxString: color('syntax-string', fallback.syntaxString), syntaxKeyword: color('syntax-keyword', fallback.syntaxKeyword), syntaxNumber: color('syntax-primitive', fallback.syntaxNumber), syntaxProperty: color('syntax-property', fallback.syntaxProperty), syntaxType: color('syntax-type', fallback.syntaxType), syntaxConstant: color('syntax-constant', fallback.syntaxConstant),
  };
}

function dynamicColors(t: Material3Scheme, fallback: ThemeColors): ThemeColors {
  return { ...fallback, frame: t.background, bg: t.background, panel: t.surface, raised: t.surfaceContainerHigh, border: t.outlineVariant, text: t.onBackground, muted: t.onSurfaceVariant, faint: t.outline, accent: t.primary, accentText: t.onPrimary, blue: t.primary, focus: t.primary, primary: t.primary, primaryText: t.onPrimary, selected: t.secondaryContainer, input: t.surfaceContainer, danger: t.error, dangerBackground: t.errorContainer, dangerBorder: t.error, syntaxKeyword: t.primary, syntaxProperty: t.secondary, syntaxConstant: t.tertiary };
}
