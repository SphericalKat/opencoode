import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { BaseNavigationContainer, DefaultTheme, usePreventRemove, useNavigationContainerRef, type NavigationAction } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { HeaderBackButton } from '@react-navigation/elements';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import type { CredentialEntry, IntegrationAttempt, IntegrationCommandAttempt, IntegrationInfo, IntegrationMethod, ModelInfo, PermissionSavedInfo } from '@opencode/client';
import { isFileNotFoundError } from '@opencode/client';
import { type Client, errorMessage } from '../lib/client';
import { externalURL, saveConfigFile, withSettingsRequest } from '../lib/settings';
import { Button, Busy, Card, confirmAction, Disclosure, Empty, ErrorNotice, Field, Heading, JsonView, Label, mono, sans, Row, Sheet } from '../components/ui';
import { DynamicFields } from '../components/SessionForms';
import { initialFormValues, prepareFormAnswer, type FormValues } from '../lib/forms';
import { AdvancedSettings } from '../components/AdvancedSettings';
import { GlobalForms } from '../components/GlobalForms';
import { ScreenHeader } from '../components/ScreenHeader';
import { ShellIcon } from '../components/ShellIcon';
import { useMotionPreference } from '../components/motion';
import { useTheme, useThemedStyles, type ThemeColors } from '../lib/theme';
import { useHasUnsavedChanges, useUnsavedChanges, useUnsavedGuard } from '../lib/unsaved';
import { pageInset } from '../lib/layout';

type Section = 'Accounts' | 'Models' | 'MCP' | 'Config' | 'Skills' | 'Plugins' | 'Permissions' | 'Advanced' | 'Appearance';
const sectionDescriptions: Record<Section, string> = {
  Accounts: 'Provider connections and credentials',
  Models: 'Available models and capabilities',
  MCP: 'Tool servers and pending requests',
  Config: 'Server configuration and shell',
  Skills: 'Skills in this workspace',
  Plugins: 'Server plugins and updates',
  Permissions: 'Saved approvals for this project',
  Advanced: 'Usage, web search, and generation',
  Appearance: 'System, light, or dark theme',
};
const sectionGroups: { title: string; items: Section[] }[] = [
  { title: 'General', items: ['Appearance', 'Config'] },
  { title: 'Connections', items: ['Accounts', 'Models', 'MCP'] },
  { title: 'Agent', items: ['Skills', 'Plugins', 'Permissions'] },
  { title: 'Advanced', items: ['Advanced'] },
];

type HeaderRefresh = { refresh?: () => void; loading?: boolean } | null;
const HeaderRefreshContext = createContext<React.Dispatch<React.SetStateAction<HeaderRefresh>> | null>(null);
const BetaLayoutContext = createContext(false);
type SettingsStackParams = { Index: undefined; Section: { section: Section } };
const SettingsStack = createNativeStackNavigator<SettingsStackParams>();
const zeroInsets = { top: 0, bottom: 0, left: 0, right: 0 };
// The native toolbar supplies its inset before the shared back control applies its own margins.
const nativeBackInsets = Platform.select<ViewStyle>({ android: { marginStart: -7, marginEnd: 33 }, ios: { minWidth: 44, height: 44, justifyContent: 'center' } });

export function SettingsScreen({ client, directory, visible = true, onBackStateChange, onBack, backLabel, onOpenNavigation, betaLayout = false, onManageServers, serverLabel }: { client: Client; directory: string; visible?: boolean; onBackStateChange?: (canGoBack: boolean) => void; onBack?: () => void; backLabel?: string; onOpenNavigation?: () => void; betaLayout?: boolean; onManageServers?: () => void; serverLabel?: string }) {
  const { colors, scheme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const reducedMotion = useMotionPreference();
  // A resize must not replace the navigator and discard an open editor.
  const [nativeStackEnabled] = useState(() => !betaLayout && Platform.OS !== 'web' && width < 920);
  const wide = !betaLayout && !nativeStackEnabled && width >= 920;
  const [section, setSection] = useState<Section | null>(betaLayout ? 'Appearance' : null);
  const [headerRefresh, setHeaderRefresh] = useState<HeaderRefresh>(null);
  const confirmNavigation = useUnsavedGuard(`configuration:${directory}`);
  const mounted = useRef(true);
  const navigationRef = useNavigationContainerRef<SettingsStackParams>();
  const selected = section ?? (wide ? 'Accounts' : null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const changeSection = useCallback(async (next: Section | null) => {
    if (next === section) return true;
    if (section !== null && !await confirmNavigation()) return false;
    if (!mounted.current) return false;
    setSection(next);
    return true;
  }, [section, confirmNavigation]);
  useEffect(() => {
    if (nativeStackEnabled) return;
    onBackStateChange?.(!betaLayout && visible && !wide && section !== null);
    return () => onBackStateChange?.(false);
  }, [betaLayout, nativeStackEnabled, onBackStateChange, visible, wide, section]);
  useEffect(() => {
    if (betaLayout || nativeStackEnabled || !visible || wide || section === null) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { void changeSection(null); return true; });
    return () => subscription.remove();
  }, [betaLayout, nativeStackEnabled, visible, wide, section, changeSection]);
  const updateNativeBackState = useCallback(() => {
    if (!nativeStackEnabled) return;
    const canGoBack = navigationRef.current?.canGoBack() ?? false;
    onBackStateChange?.(visible && !wide && canGoBack);
  }, [nativeStackEnabled, navigationRef, onBackStateChange, visible, wide]);
  useEffect(() => {
    updateNativeBackState();
    return () => onBackStateChange?.(false);
  }, [updateNativeBackState, onBackStateChange]);
  useEffect(() => {
    if (!nativeStackEnabled || !visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!navigationRef.current?.canGoBack()) return false;
      navigationRef.current.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [nativeStackEnabled, navigationRef, visible]);

  const renderIndex = () => <SettingsIndex onSelect={next => {
    if (!nativeStackEnabled) { void changeSection(next); return; }
    navigationRef.navigate('Section', { section: next });
  }} selected={selected} wide={wide} />;
  const renderSection = (value: Section) => <SettingsSection client={client} directory={directory} section={value} />;

  const navigationTheme = useMemo(() => ({ ...DefaultTheme, dark: scheme === 'dark', colors: { ...DefaultTheme.colors, primary: colors.accent, background: colors.bg, card: colors.panel, text: colors.text, border: colors.border, notification: colors.danger } }), [colors, scheme]);
  const navigation = <BaseNavigationContainer ref={navigationRef} theme={navigationTheme} onReady={updateNativeBackState} onStateChange={updateNativeBackState}>
    <SettingsStack.Navigator screenOptions={{
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.text,
      headerTitleStyle: { color: colors.text, fontFamily: 'Inter', fontSize: 17, fontWeight: '600' },
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.bg },
      animation: reducedMotion ? 'fade' : 'default',
    }}>
      <SettingsStack.Screen name="Index" options={{
        title: 'Settings',
        headerLeft: onBack ? () => <SettingsBackButton label={backLabel || 'Sessions'} onPress={onBack} /> : undefined,
        headerRight: onOpenNavigation ? () => <Pressable accessibilityRole="button" accessibilityLabel="Open navigation" onPress={onOpenNavigation} style={{ width: 44, height: 44, marginEnd: Platform.OS === 'android' ? -16 : 0, alignItems: 'center', justifyContent: 'center' }}><ShellIcon name="menu" color={colors.text} /></Pressable> : undefined,
      }}>
        {renderIndex}
      </SettingsStack.Screen>
      <SettingsStack.Screen name="Section" options={({ route, navigation: screenNavigation }) => ({ title: route.params.section, headerBackButtonDisplayMode: 'minimal', ...(Platform.OS === 'android' ? { headerBackVisible: false, headerLeft: () => <SettingsBackButton label="Settings" onPress={() => screenNavigation.goBack()} /> } : {}) })}>
        {({ route, navigation: screenNavigation }) => <NativeSettingsSection client={client} directory={directory} section={route.params.section} navigation={screenNavigation} />}
      </SettingsStack.Screen>
    </SettingsStack.Navigator>
  </BaseNavigationContainer>;

  if (betaLayout) return <BetaSettingsContent section={section ?? 'Appearance'} onSelect={changeSection} onBack={onBack} onManageServers={onManageServers} serverLabel={serverLabel} headerRefresh={headerRefresh}>
    <HeaderRefreshContext.Provider value={setHeaderRefresh}>{renderSection(section ?? 'Appearance')}</HeaderRefreshContext.Provider>
  </BetaSettingsContent>;

  return <View style={[styles.screen, !wide && styles.narrowScreen]}>
    {!nativeStackEnabled ? <>
      {!wide && <ScreenHeader title={selected ?? 'Settings'} backLabel={section !== null ? 'Settings' : backLabel} onBack={section !== null ? () => { void changeSection(null); } : onBack} onOpenNavigation={section === null ? onOpenNavigation : undefined} onRefresh={section !== null ? headerRefresh?.refresh : undefined} refreshing={headerRefresh?.loading} />}
      <HeaderRefreshContext.Provider value={wide ? null : setHeaderRefresh}><View style={[styles.content, !wide && styles.narrowContent]}>
        {(wide || section === null) && renderIndex()}
        {selected && (wide || section !== null) && <View style={styles.detail}>{wide && <Row style={styles.detailHeader}><Label accessibilityRole="header" style={styles.detailTitle}>{selected}</Label></Row>}{renderSection(selected)}</View>}
      </View></HeaderRefreshContext.Provider>
    </> : <SafeAreaInsetsContext.Provider value={zeroInsets}><View style={styles.nativeNavigation}>{navigation}</View></SafeAreaInsetsContext.Provider>}
  </View>;
}

function BetaSettingsContent({ section, onSelect, onBack, onManageServers, serverLabel, headerRefresh, children }: { section: Section; onSelect: (section: Section) => Promise<boolean>; onBack?: () => void; onManageServers?: () => void; serverLabel?: string; headerRefresh: HeaderRefresh; children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [query, setQuery] = useState('');
  const [choosing, setChoosing] = useState(false);
  const [chooserQuery, setChooserQuery] = useState('');
  const pendingServer = useRef(false);
  const sections = sectionGroups.flatMap(group => group.items);
  const matches = (item: Section, value: string) => `${item} ${sectionDescriptions[item]}`.toLowerCase().includes(value.trim().toLowerCase());
  const select = async (item: Section) => {
    if (!await onSelect(item)) return;
    setQuery('');
    setChoosing(false);
  };
  const sectionRow = (item: Section) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Open ${item}. ${sectionDescriptions[item]}`} accessibilityState={{ selected: section === item }} onPress={() => { void select(item); }} style={({ pressed }) => [styles.betaCategoryRow, pressed && { backgroundColor: colors.raised }]}>
    <View style={styles.detail}><Label style={styles.betaTitle}>{item}</Label><Label muted style={styles.betaDescription}>{sectionDescriptions[item]}</Label></View>
    {section === item && <Label accessibilityElementsHidden>✓</Label>}
  </Pressable>;
  return <View style={styles.betaScreen}>
    <View style={styles.betaTopRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to app" onPress={onBack} disabled={!onBack} style={styles.betaBack}><ShellIcon name="back" size={14} color={colors.muted} /><Label style={styles.betaBackLabel}>Back to app</Label></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Settings category: ${section}`} accessibilityState={{ expanded: choosing }} onPress={() => { setChooserQuery(''); setChoosing(true); }} style={styles.betaChooserTarget}>
        <View style={styles.betaChooser}><Label style={styles.betaBackLabel}>{section}</Label><View style={{ transform: [{ rotate: '90deg' }] }}><ShellIcon name="chevron" size={12} color={colors.text} /></View></View>
      </Pressable>
    </View>
    <View style={styles.betaSearch}><ShellIcon name="search" size={16} color={colors.muted} /><Field placeholder="Search" accessibilityLabel="Search settings categories" value={query} onChangeText={setQuery} containerStyle={styles.detail} style={styles.betaSearchInput} />{!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear settings search" onPress={() => setQuery('')} style={styles.betaClear}><ShellIcon name="close" size={16} color={colors.muted} /></Pressable>}</View>
    {!!query.trim() && <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.betaResults}>
      {sections.filter(item => matches(item, query)).map(sectionRow)}
      {!sections.some(item => matches(item, query)) && <Empty title="No matching settings" detail="Try a category name or description." />}
    </ScrollView>}
    <View style={[styles.detail, !!query.trim() && styles.betaHidden]}>
      <View style={styles.betaSectionHeader}>
        <View style={styles.betaSectionHeading}><Label accessibilityRole="header" style={styles.betaTitle}>{section}</Label><Label muted style={styles.betaDescription}>{sectionDescriptions[section]}</Label></View>
        {headerRefresh?.refresh && <Pressable accessibilityRole="button" accessibilityLabel="Refresh" accessibilityState={{ disabled: headerRefresh.loading, busy: headerRefresh.loading }} disabled={headerRefresh.loading} onPress={() => headerRefresh.refresh?.()} style={styles.betaClear}>{headerRefresh.loading ? <ActivityIndicator size="small" color={colors.muted} /> : <ShellIcon name="refresh" size={18} color={colors.text} />}</Pressable>}
      </View>
      <BetaLayoutContext.Provider value>{children}</BetaLayoutContext.Provider>
    </View>
    <Sheet visible={choosing} title="Settings" fitContent contentStyle={{ gap: 0 }} onClose={() => setChoosing(false)} onDismiss={() => {
      if (!pendingServer.current) return;
      pendingServer.current = false;
      onManageServers?.();
    }}>
      <Field placeholder="Search categories" value={chooserQuery} onChangeText={setChooserQuery} />
      {sections.filter(item => matches(item, chooserQuery)).map(sectionRow)}
      {onManageServers && `server ${serverLabel ?? ''}`.toLowerCase().includes(chooserQuery.trim().toLowerCase()) && <Pressable accessibilityRole="button" accessibilityLabel="Manage servers" onPress={() => { pendingServer.current = true; setChoosing(false); }} style={({ pressed }) => [styles.betaCategoryRow, pressed && { backgroundColor: colors.raised }]}><View style={styles.detail}><Label style={styles.betaTitle}>Server</Label><Label muted style={styles.betaDescription}>{serverLabel || 'Manage server connections'}</Label></View><ShellIcon name="chevron" size={16} color={colors.muted} /></Pressable>}
    </Sheet>
  </View>;
}

function SettingsBackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  // The stock iOS image reserves label space even in icon-only mode.
  return <HeaderBackButton displayMode="minimal" accessibilityLabel={`Back to ${label}`} onPress={onPress} tintColor={colors.text} style={nativeBackInsets} backImage={Platform.OS === 'ios' ? ({ tintColor }) => <ShellIcon name="back" color={tintColor} size={22} /> : undefined} />;
}

function SettingsIndex({ onSelect, selected, wide }: { onSelect: (section: Section) => void; selected: Section | null; wide: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <ScrollView style={wide ? styles.sidebar : undefined} contentContainerStyle={styles.index}>
    {wide && <View style={styles.indexHeader}><Heading>Settings</Heading><Label muted>Preferences, connections, and tools</Label></View>}
    {sectionGroups.map(group => <View key={group.title} style={styles.group}>
      {!(group.items.length === 1 && group.items[0] === group.title) && <Label muted style={styles.groupTitle}>{group.title.toUpperCase()}</Label>}
      <View style={styles.groupPanel}>{group.items.map((item, index) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Open ${item}. ${sectionDescriptions[item]}`} accessibilityState={{ selected: selected === item }} aria-current={selected === item ? 'page' : undefined} onPress={() => onSelect(item)} style={({ pressed }) => [styles.sectionRow, index > 0 && styles.sectionDivider, wide && selected === item && styles.currentSection, pressed && { backgroundColor: colors.raised }]}>
        <View style={{ flex: 1, minWidth: 0 }}><Label style={styles.sectionName}>{item}</Label><Label muted numberOfLines={1} style={styles.sectionDescription}>{sectionDescriptions[item]}</Label></View>
        <Label muted accessibilityElementsHidden style={styles.chevron}>›</Label>
      </Pressable>)}</View>
    </View>)}
  </ScrollView>;
}

function SettingsSection({ client, directory, section }: { client: Client; directory: string; section: Section }) {
  return <View key={`${directory}:${section}`} style={{ flex: 1 }}>
      {section === 'Accounts' && <Accounts client={client} directory={directory} />}
      {section === 'Models' && <Models client={client} directory={directory} />}
      {section === 'MCP' && <Mcp client={client} directory={directory} />}
      {section === 'Config' && <Configuration client={client} directory={directory} />}
      {section === 'Skills' && <Skills client={client} directory={directory} />}
      {section === 'Plugins' && <Plugins client={client} directory={directory} />}
      {section === 'Permissions' && <Permissions client={client} directory={directory} />}
      {section === 'Advanced' && <AdvancedSettings client={client} directory={directory} />}
      {section === 'Appearance' && <AppearanceSettings />}
  </View>;
}

function NativeSettingsSection({ client, directory, section, navigation }: { client: Client; directory: string; section: Section; navigation: NativeStackScreenProps<SettingsStackParams, 'Section'>['navigation'] }) {
  const { colors } = useTheme();
  const [headerRefresh, setHeaderRefresh] = useState<HeaderRefresh>(null);
  const confirmNavigation = useUnsavedGuard(`configuration:${directory}`);
  const hasUnsavedConfiguration = useHasUnsavedChanges(`configuration:${directory}`);
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(null);
  const prompting = useRef(false);
  usePreventRemove(section === 'Config' && hasUnsavedConfiguration && !pendingAction, ({ data }) => {
    if (prompting.current) return;
    prompting.current = true;
    void confirmNavigation().then(leave => {
      prompting.current = false;
      if (leave) setPendingAction(data.action);
    });
  });
  useEffect(() => {
    if (pendingAction) navigation.dispatch(pendingAction);
  }, [navigation, pendingAction]);
  useEffect(() => {
    navigation.setOptions({ headerRight: headerRefresh?.refresh ? () => <Pressable accessibilityRole="button" accessibilityLabel="Refresh" accessibilityState={{ disabled: headerRefresh.loading, busy: headerRefresh.loading }} disabled={headerRefresh.loading} onPress={() => headerRefresh.refresh?.()} style={{ width: 44, height: 44, marginEnd: Platform.OS === 'android' ? -16 : 0, alignItems: 'center', justifyContent: 'center' }}>{headerRefresh.loading ? <ActivityIndicator size="small" color={colors.muted} /> : <ShellIcon name="refresh" color={colors.text} />}</Pressable> : undefined });
  }, [colors, headerRefresh, navigation]);
  return <HeaderRefreshContext.Provider value={setHeaderRefresh}><SettingsSection client={client} directory={directory} section={section} /></HeaderRefreshContext.Provider>;
}

function useResource<T>(client: Client, directory: string, load: (signal: AbortSignal) => Promise<T>) {
  const scope = useMemo(() => ({ client, directory }), [client, directory]);
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resourceScope, setResourceScope] = useState(scope);
  const active = useRef(true);
  const latest = useRef({ scope, load });
  latest.current = { scope, load };
  const sequence = useRef(0);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const { scope: owner, load: read } = latest.current;
    const current = ++sequence.current;
    const isCurrent = () => active.current && current === sequence.current && latest.current.scope === owner;
    setResourceScope(owner);
    setLoading(true);
    setError(null);
    try { const result = await withSettingsRequest(read, signal); if (isCurrent()) setData(result); }
    catch (e) { if (isCurrent()) setError(errorMessage(e)); }
    finally { if (isCurrent()) setLoading(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    active.current = true;
    setData(undefined);
    void refresh(AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]));
    return () => { active.current = false; sequence.current++; controller.abort(); };
  }, [scope, refresh]);
  return { data: resourceScope === scope ? data : undefined, error: resourceScope === scope ? error : null, loading: resourceScope !== scope || loading, refresh };
}

function Page({ children, error, loading, refresh }: { children: React.ReactNode; error?: string | null; loading?: boolean; refresh?: () => void }) {
  const styles = useThemedStyles(createStyles);
  const setHeaderRefresh = useContext(HeaderRefreshContext);
  useEffect(() => {
    setHeaderRefresh?.({ refresh, loading });
    return () => setHeaderRefresh?.(null);
  }, [setHeaderRefresh, refresh, loading]);
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
    {!setHeaderRefresh && refresh && <Row style={{ justifyContent: 'flex-end' }}><Button title="Refresh" compact variant="ghost" onPress={() => refresh()} /></Row>}
    <ErrorNotice error={error} onRetry={refresh ? () => refresh() : undefined} />{loading && <Busy />}{children}
  </ScrollView>;
}

function AppearanceSettings() {
  const { appearance, scheme, setAppearance, colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const betaLayout = useContext(BetaLayoutContext);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const choiceLabel = appearance === 'system' ? 'System' : appearance === 'light' ? 'Light' : 'Dark';
  if (betaLayout) return <Page error={error}>
    <View style={styles.betaAppearanceCard}>
      <View style={styles.detail}><Label style={styles.betaSettingTitle}>Color scheme</Label><Label muted style={styles.betaDescription}>Choose the color scheme for the app.</Label></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Color scheme: ${choiceLabel}`} accessibilityState={{ disabled: busy, expanded: choosing }} disabled={busy} onPress={() => setChoosing(true)} style={styles.betaChooserTarget}>
        <View style={styles.betaSettingChooser}>{busy ? <ActivityIndicator size="small" color={colors.muted} /> : <Label style={styles.betaBackLabel}>{choiceLabel}</Label>}<View style={{ transform: [{ rotate: '90deg' }] }}><ShellIcon name="chevron" size={12} color={colors.text} /></View></View>
      </Pressable>
    </View>
    <Sheet visible={choosing} title="Color scheme" fitContent contentStyle={{ gap: 0 }} onClose={() => { if (!busy) setChoosing(false); }}>
      <ErrorNotice error={error} />
      {(['system', 'light', 'dark'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityLabel={value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'} accessibilityState={{ selected: appearance === value, disabled: busy }} disabled={busy} style={({ pressed }) => [styles.betaCategoryRow, pressed && { backgroundColor: colors.raised }]} onPress={() => {
        setBusy(true); setError(null);
        void setAppearance(value).then(() => setChoosing(false)).catch(e => setError(errorMessage(e))).finally(() => setBusy(false));
      }}><Label style={[styles.betaBackLabel, styles.detail]}>{value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'}</Label>{appearance === value && <Label accessibilityElementsHidden>✓</Label>}</Pressable>)}
    </Sheet>
  </Page>;
  return <Page error={error}>
    <Label muted>Use your device theme or choose a fixed color scheme.</Label>
    {(['system', 'light', 'dark'] as const).map(value => <Button key={value} title={value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'} selected={appearance === value} variant={appearance === value ? 'primary' : 'secondary'} disabled={busy} onPress={() => {
      setBusy(true); setError(null);
      void setAppearance(value).catch(e => setError(errorMessage(e))).finally(() => setBusy(false));
    }} />)}
    <Label muted>Current theme: {scheme}</Label>
  </Page>;
}

function Accounts({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => {
    const [integrations, credentials] = await Promise.all([client.integration.list({ location: { directory } }, { signal }), client.credential.list({ signal })]);
    return { integrations: integrations.data, credentials };
  });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<IntegrationInfo>();
  const [limit, setLimit] = useState(40);
  useEffect(() => setLimit(40), [query]);
  const [credential, setCredential] = useState<CredentialEntry>();
  const [label, setLabel] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<unknown>) => {
    setBusy(true); setActionError(null);
    try { await withSettingsRequest(async signal => { await action(signal); await refresh(signal); }); } catch (e) { setActionError(errorMessage(e)); } finally { setBusy(false); }
  };
  const search = query.trim().toLowerCase();
  const integrations = data?.integrations.filter(item => `${item.name} ${item.id}`.toLowerCase().includes(search)) ?? [];
  return <Page error={error} loading={loading} refresh={refresh}>
    <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}><Field label="Find a provider or integration" placeholder="Search accounts" value={query} onChangeText={setQuery} containerStyle={{ flex: 1 }} />{!!query && <Button title="Clear" accessibilityLabel="Clear provider search" compact variant="ghost" onPress={() => setQuery('')} />}</Row>
    <ErrorNotice error={actionError} />
    {!!data?.credentials.length && <Label style={styles.sectionLabel}>SAVED ACCOUNTS</Label>}
    {data?.credentials.map(item => <Card key={item.id}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Label style={styles.name}>{item.label || item.integrationID}</Label><Label muted>{item.integrationID} · {item.value.type}{item.active ? ' · Active' : ''}</Label></View><Button title="Manage" compact onPress={() => { setCredential(item); setLabel(item.label); setActionError(null); }} /></Row></Card>)}
    <Label style={styles.sectionLabel}>CONNECT AN ACCOUNT</Label>
    {integrations.slice(0, limit).map(item => <Card key={item.id}>
      <Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Label style={styles.name}>{item.name}</Label><Label muted>{item.connections.length ? `${item.connections.length} connection${item.connections.length === 1 ? '' : 's'}` : 'Not connected'}</Label></View><Button title="Connect" compact onPress={() => setSelected(item)} /></Row>
      {item.connections.map((connection, index) => connection.status && <Label key={index} style={{ color: colors.danger }}>{connection.status.message}</Label>)}
    </Card>)}
    {integrations.length > limit && <><Label muted>Showing {limit} of {integrations.length} integrations. Search or load more.</Label><Button title="Load more integrations" onPress={() => setLimit(value => value + 40)} /></>}
    {data && !loading && !!data.integrations.length && !!search && !integrations.length && <Card><Empty title="No matching providers" detail="Try a provider name or integration ID, or clear the search to see all providers." /><Button title="Clear search" onPress={() => setQuery('')} /></Card>}
    {data && !data.integrations.length && <Empty title="No integrations" detail="Your server did not publish any account integrations for this project." />}
    <Sheet visible={!!credential} title="Manage account" onClose={() => { if (!busy) setCredential(undefined); }}>
      <ErrorNotice error={actionError} /><Label muted>{credential?.integrationID}</Label><Field label="Account name" value={label} editable={!busy} onChangeText={setLabel} />
      <Button title="Save name" busy={busy} onPress={() => void run(async signal => { if (!credential) return; await client.credential.update({ credentialID: credential.id, label: label.trim() }, { signal }); signal.throwIfAborted(); setCredential(undefined); })} />
      {!credential?.active && <Button title="Use this account" variant="primary" busy={busy} onPress={() => void run(async signal => { if (!credential) return; await client.credential.activate({ credentialID: credential.id }, { signal }); signal.throwIfAborted(); setCredential(undefined); })} />}
      <Button title="Remove account" variant="danger" busy={busy} onPress={() => { if (!credential) return; const credentialID = credential.id; void confirmAction('Remove account?', 'This removes the saved credential from your OpenCode server.').then(confirmed => { if (confirmed) void run(async signal => { await client.credential.remove({ credentialID }, { signal }); signal.throwIfAborted(); setCredential(undefined); }); }); }} />
    </Sheet>
    {selected && <ConnectIntegration key={selected.id} client={client} directory={directory} integration={selected} onClose={() => { setSelected(undefined); void refresh(); }} />}
  </Page>;
}

type Attempt = { kind: 'oauth'; data: IntegrationAttempt } | { kind: 'command'; data: IntegrationCommandAttempt };
function ConnectIntegration({ client, directory, integration, onClose }: { client: Client; directory: string; integration: IntegrationInfo; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [method, setMethod] = useState<IntegrationMethod>();
  const [values, setValues] = useState<FormValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');
  const [code, setCode] = useState('');
  const [attempt, setAttempt] = useState<Attempt>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const active = useRef(true);
  const statusRequest = useRef(false);
  useEffect(() => () => { active.current = false; }, []);
  const check = useCallback(async () => {
    if (!attempt || statusRequest.current) return;
    statusRequest.current = true;
    try {
      const input = { integrationID: integration.id, attemptID: attempt.data.attemptID, location: { directory } };
      const result = attempt.kind === 'oauth' ? await client.integration.oauth.status(input) : await client.integration.command.status(input);
      if (!active.current) return;
      setStatus(result.data.status);
      if (result.data.status === 'failed') setError(result.data.message);
      if (result.data.status === 'complete') onClose();
    } catch (e) { if (active.current) setError(errorMessage(e)); }
    finally { statusRequest.current = false; }
  }, [attempt, client, directory, integration.id, onClose]);
  useEffect(() => {
    if (!attempt || ['complete', 'expired', 'failed'].includes(status)) return;
    void check(); const timer = setInterval(() => void check(), 3000); return () => clearInterval(timer);
  }, [attempt, status, check]);
  const open = async (url: string) => { try { await Linking.openURL(externalURL(url)); } catch (e) { setError(errorMessage(e)); } };
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(null); try { await action(); } catch (e) { if (active.current) setError(errorMessage(e)); } finally { if (active.current) setBusy(false); } };
  const start = async () => {
    if (!method || method.type === 'env') return;
    const prepared = prepareFormAnswer('form' in method ? method.form ?? [] : [], values);
    setFieldErrors(prepared.errors);
    if (Object.keys(prepared.errors).length) return;
    const input = { integrationID: integration.id, location: { directory }, label: label.trim() || undefined, answer: prepared.answer };
    await run(async () => {
      if (method.type === 'key') {
        if (!key.trim()) throw new Error('Enter an API key');
        await client.integration.connect.key({ ...input, key: key.trim() }); setKey(''); onClose();
      } else if (method.type === 'external') { await client.integration.connect.external({ ...input, methodID: method.id }); onClose(); }
      else if (method.type === 'oauth') { const result = await client.integration.oauth.connect({ ...input, methodID: method.id }); setAttempt({ kind: 'oauth', data: result.data }); setStatus('pending'); await open(result.data.url); }
      else { const result = await client.integration.command.connect({ ...input, methodID: method.id }); setAttempt({ kind: 'command', data: result.data }); setStatus('pending'); }
    });
  };
  return <Sheet visible title={`Connect ${integration.name}`} onClose={onClose}>
    <ErrorNotice error={error} />
    {!attempt && <>
      <Label muted>Choose a connection method. Credentials stay on your OpenCode server.</Label>
      {integration.methods.map((item, index) => <Button key={index} title={item.type === 'env' ? `Server environment: ${item.names.join(', ')}` : item.label || (item.type === 'key' ? 'API key' : item.type)} selected={method === item} variant={method === item ? 'primary' : 'secondary'} onPress={() => { setMethod(item); setError(null); setFieldErrors({}); setValues(initialFormValues('form' in item ? item.form ?? [] : [])); }} />)}
      {method?.type === 'env' && <Label muted>Set these environment variables on the server, then restart OpenCode.</Label>}
      {method && method.type !== 'env' && <><Field label="Account name (optional)" value={label} onChangeText={setLabel} />
        {method.type === 'key' && <Field label="API key" secureTextEntry value={key} onChangeText={setKey} />}
        {'form' in method && <DynamicFields fields={method.form ?? []} values={values} onChange={setValues} errors={fieldErrors} />}
        {method.type === 'command' && <Card><Label muted>This starts the sign-in command on your server.</Label><Label style={{ fontFamily: mono }}>{method.command.join(' ')}</Label></Card>}
        <Button title="Continue" variant="primary" busy={busy} onPress={() => void start()} /></>}
      {!integration.methods.length && <Empty title="No connection methods" />}
    </>}
    {attempt && <>
      <Label style={styles.name}>{status === 'pending' ? 'Complete the sign-in' : status}</Label>
      {attempt.kind === 'oauth' && <><Label>{attempt.data.instructions}</Label><Button title="Open sign-in page" onPress={() => void open(attempt.data.url)} />
        {attempt.data.mode === 'code' && <><Field label="Authorization code" value={code} onChangeText={setCode} /><Button title="Submit code" variant="primary" busy={busy} disabled={!code.trim()} onPress={() => void run(async () => { await client.integration.oauth.complete({ integrationID: integration.id, attemptID: attempt.data.attemptID, location: { directory }, code: code.trim() }); await check(); })} /></>}
      </>}
      {attempt.kind === 'command' && <Label muted>Complete any browser or terminal steps on the server. This page checks the result automatically.</Label>}
      <Button title="Check status" compact onPress={() => void check()} />
      <Button title="Cancel sign-in" variant="danger" busy={busy} onPress={() => void run(async () => { const input = { integrationID: integration.id, attemptID: attempt.data.attemptID, location: { directory } }; if (attempt.kind === 'oauth') await client.integration.oauth.cancel(input); else await client.integration.command.cancel(input); setAttempt(undefined); setStatus(''); })} />
    </>}
  </Sheet>;
}

function Models({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => {
    const [models, providers] = await Promise.all([client.model.list({ location: { directory }, types: ['chat', 'image', 'decision'] }, { signal }), client.provider.list({ location: { directory } }, { signal })]);
    return { models: models.data, providers: providers.data };
  });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ModelInfo>();
  const [limit, setLimit] = useState(40);
  useEffect(() => setLimit(40), [query]);
  const search = query.trim().toLowerCase();
  const models = data?.models.filter(item => `${item.name} ${item.providerID} ${item.id}`.toLowerCase().includes(search)) ?? [];
  return <Page error={error} loading={loading} refresh={refresh}>
    <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}><Field label="Find a model" placeholder="Name or provider" value={query} onChangeText={setQuery} containerStyle={{ flex: 1 }} />{!!query && <Button title="Clear" accessibilityLabel="Clear model search" compact variant="ghost" onPress={() => setQuery('')} />}</Row>
    <Label muted>Select a model inside a chat to use it. Edit configuration to change server defaults or custom providers.</Label>
    <Label style={styles.sectionLabel}>{models.length} MODELS</Label>
    {models.slice(0, limit).map(item => <Card key={`${item.providerID}/${item.id}`}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Label style={styles.name}>{item.name}</Label><Label muted>{item.providerID} · {item.enabled ? 'Available' : 'Not connected'}</Label></View><Button title="Details" compact onPress={() => setSelected(item)} /></Row></Card>)}
    {models.length > limit && <><Label muted>Showing {limit} of {models.length} models.</Label><Button title="Load more models" onPress={() => setLimit(value => value + 40)} /></>}
    {data && !loading && !!data.models.length && !!search && !models.length && <Card><Empty title="No matching models" detail="Try a model name, provider, or model ID, or clear the search to see all models." /><Button title="Clear search" onPress={() => setQuery('')} /></Card>}
    {data && !loading && !data.models.length && <Empty title="No models available" detail="Your server did not publish a model catalog for this project." />}
    <Disclosure title={`Providers (${data?.providers.length ?? 0})`}>{data?.providers.map(item => <View key={item.id} style={{ gap: 4 }}><Label>{item.name}</Label><Label muted>{item.id} · {item.activation}</Label></View>)}</Disclosure>
    <Sheet visible={!!selected} title={selected?.name || 'Model'} onClose={() => setSelected(undefined)}>{selected && <><Label muted>{selected.providerID}/{selected.id}</Label><Label>Context: {selected.limit.context.toLocaleString()} tokens · Output: {selected.limit.output.toLocaleString()} tokens</Label><Label>Variants: {selected.variants.map(item => item.id).join(', ') || 'Default'}</Label><Disclosure title="Capabilities"><JsonView value={selected.capabilities} /></Disclosure><Disclosure title="Prices"><JsonView value={selected.cost} /></Disclosure><Disclosure title="Details"><JsonView value={selected} /></Disclosure></>}</Sheet>
  </Page>;
}

function Mcp({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => (await client.mcp.list({ location: { directory } }, { signal })).data);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'remote' | 'local'>('remote');
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [resources, setResources] = useState<unknown>();
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => { setBusy(true); setErrorAction(null); try { await withSettingsRequest(async signal => { await action(signal); await refresh(signal); }); } catch (e) { setErrorAction(errorMessage(e)); } finally { setBusy(false); } };
  return <Page error={error} loading={loading} refresh={refresh}>
    <GlobalForms client={client} directory={directory} />
    <Row><Button title="Add MCP server" variant="primary" disabled={busy} onPress={() => { setAdding(true); setErrorAction(null); }} /><Button title="Resources" disabled={busy} onPress={() => void run(async signal => { const result = await client.mcp.resource.catalog({ location: { directory } }, { signal }); signal.throwIfAborted(); setResources(result.data); })} /></Row>
    <ErrorNotice error={errorAction} />
    {data?.map(item => <Card key={item.name}><Row style={{ justifyContent: 'space-between' }}><View style={{ flex: 1 }}><Label style={styles.name}>{item.title || item.name}</Label><Label muted>{item.name} · {item.status.status.replace('_', ' ')}</Label></View><Button title={item.status.status === 'connected' ? 'Disconnect' : 'Connect'} busy={busy} compact onPress={() => void run(async signal => { const input = { server: item.name, location: { directory } }; if (item.status.status === 'connected') await client.experimental.mcp.disconnect(input, { signal }); else await client.experimental.mcp.connect(input, { signal }); })} /></Row>
      {'error' in item.status && <Label style={{ color: colors.danger }}>{item.status.error}</Label>}
      {item.status.status === 'needs_auth' && <Label muted>Connect its account in the Accounts tab. The integration name is {item.integrationID || item.name}.</Label>}
      <Button title="Remove" variant="danger" compact busy={busy} onPress={() => { void confirmAction('Remove MCP server?', `This removes ${item.name} from the project configuration.`).then(confirmed => { if (confirmed) void run(async signal => { await client.experimental.mcp.remove({ server: item.name, location: { directory } }, { signal }); }); }); }} />
    </Card>)}
    {data && !data.length && <Empty title="No MCP servers" detail="Connect tools and resources from your own servers." />}
    <Sheet visible={resources !== undefined} title="MCP resources" onClose={() => setResources(undefined)}><JsonView value={resources} /></Sheet>
    <Sheet visible={adding} title="Add MCP server" onClose={() => { if (!busy) setAdding(false); }}>
      <ErrorNotice error={errorAction} /><Field label="Server name" value={name} editable={!busy} onChangeText={setName} placeholder="my-tools" />
      <Row><Button title="Remote URL" disabled={busy} variant={kind === 'remote' ? 'primary' : 'secondary'} onPress={() => setKind('remote')} /><Button title="Server command" disabled={busy} variant={kind === 'local' ? 'primary' : 'secondary'} onPress={() => setKind('local')} /></Row>
      {kind === 'remote' ? <Field label="MCP URL" keyboardType="url" value={url} editable={!busy} onChangeText={setUrl} placeholder="https://example.com/mcp" /> : <><Field label="Command arguments (JSON array)" multiline value={command} editable={!busy} onChangeText={setCommand} placeholder={'["npx", "-y", "your-mcp-server"]'} /><Label muted>The command runs on the OpenCode server.</Label></>}
      <Button title="Add server" variant="primary" busy={busy} disabled={!name.trim()} onPress={() => void run(async signal => {
        const server = name.trim();
        if (kind === 'remote') await client.experimental.mcp.add({ server, location: { directory }, config: { type: 'remote', url: externalURL(url.trim()) } }, { signal });
        else { const args: unknown = JSON.parse(command); if (!Array.isArray(args) || !args.length || !args.every(arg => typeof arg === 'string' && arg.length)) throw new Error('Enter a JSON array of command arguments'); await client.experimental.mcp.add({ server, location: { directory }, config: { type: 'local', command: args } }, { signal }); }
        signal.throwIfAborted();
        setAdding(false); setName(''); setUrl(''); setCommand('');
      })} />
    </Sheet>
  </Page>;
}

function Configuration({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => {
    const [entries, shells] = await Promise.all([client.config.get({ location: { directory } }, { signal }), client.config.shells({ signal })]);
    return { entries, shells };
  });
  const [editing, setEditing] = useState<{ path: string; original: string | null }>();
  const [text, setText] = useState('');
  useUnsavedChanges(`configuration:${directory}`, 'Configuration editor', Boolean(editing && text !== editing.original));
  const [notice, setNotice] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: (signal: AbortSignal) => Promise<void>) => { setBusy(true); setErrorAction(null); setNotice(null); try { await withSettingsRequest(action); } catch (e) { setErrorAction(errorMessage(e)); } finally { setBusy(false); } };
  return <Page error={error} loading={loading} refresh={refresh}>
    <Label muted>These files define agents, models, providers, permissions, tools, and other server options.</Label>
    <ErrorNotice error={errorAction} />{notice && <Label style={{ color: colors.success }}>{notice}</Label>}
    <Button title="Reload server configuration" busy={busy} onPress={() => void run(async signal => { await client.location.reload({ signal }); await refresh(signal); signal.throwIfAborted(); setNotice('I reloaded the server configuration.'); })} />
    <Button title="Open project configuration" busy={busy} onPress={() => void run(async signal => {
      const path = `${directory.replace(/[\\/]+$/, '')}/opencode.jsonc`;
      try { const source = new TextDecoder().decode(await client.file.read({ location: { directory }, path }, { signal })); signal.throwIfAborted(); setEditing({ path, original: source }); setText(source); }
      catch (e) { if (!isFileNotFoundError(e)) throw e; signal.throwIfAborted(); setEditing({ path, original: null }); setText('{\n  "$schema": "https://opencode.ai/config.json"\n}\n'); }
    })} />
    {data?.entries.map((entry, index) => <Card key={index}><Label style={{ fontFamily: mono, fontSize: 12 }}>{entry.path || 'Runtime configuration'}</Label><Label muted>{entry.type === 'directory' ? 'Configuration directory' : 'Configuration document'}</Label>
      {entry.type === 'document' && <><Disclosure title="Read effective values"><JsonView value={entry.info} /></Disclosure>{entry.path && <Button title="Edit source file" compact busy={busy} onPress={() => void run(async signal => { if (!entry.path) return; const source = new TextDecoder().decode(await client.file.read({ location: { directory }, path: entry.path }, { signal })); signal.throwIfAborted(); setEditing({ path: entry.path, original: source }); setText(source); })} />}</>}
    </Card>)}
    <Disclosure title="Default shell"><Label muted>This sets the shell for commands on your OpenCode server.</Label><Button title="Use system default" busy={busy} onPress={() => void run(async signal => { await client.experimental.config.update({ shell: null }, { signal }); await refresh(signal); signal.throwIfAborted(); setNotice('I set the shell to the system default.'); })} />{data?.shells.map(shell => <Button key={shell.path} title={`${shell.name} · ${shell.path}`} disabled={!shell.acceptable} busy={busy} onPress={() => void run(async signal => { await client.experimental.config.update({ shell: shell.path }, { signal }); await refresh(signal); signal.throwIfAborted(); setNotice(`I selected ${shell.name}.`); })} />)}</Disclosure>
    <Sheet visible={!!editing} title="Edit configuration" onClose={() => { if (busy) return; if (text === editing?.original) setEditing(undefined); else void confirmAction('Discard changes?', 'Your unsaved changes will be lost.').then(ok => { if (ok) setEditing(undefined); }); }}>
      <Label style={{ fontFamily: mono, fontSize: 12 }}>{editing?.path}</Label><ErrorNotice error={errorAction} /><Field label="JSON or JSONC" multiline editable={!busy} value={text} onChangeText={setText} style={{ minHeight: 360, fontFamily: mono, fontSize: 12, lineHeight: 20 }} />
      <Button title="Save and reload" busy={busy} variant="primary" disabled={text === editing?.original} onPress={() => void run(async signal => { if (!editing) return; await saveConfigFile(client, directory, editing.path, editing.original, text, signal); setEditing({ ...editing, original: text }); await client.location.reload({ signal }); await refresh(signal); signal.throwIfAborted(); setEditing(undefined); setNotice('I saved and reloaded the configuration.'); })} />
    </Sheet>
  </Page>;
}

function Skills({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => {
    const [skills, commands] = await Promise.all([client.skill.list({ location: { directory } }, { signal }), client.command.list({ location: { directory } }, { signal })]); return { skills: skills.data, commands: commands.data };
  });
  const [query, setQuery] = useState('');
  const search = query.trim().toLowerCase();
  const skills = data?.skills.filter(item => `${item.name} ${item.description}`.toLowerCase().includes(search)) ?? [];
  const commands = data?.commands.filter(item => item.name.toLowerCase().includes(search)) ?? [];
  return <Page error={error} loading={loading} refresh={refresh}>
    <Row style={{ flexWrap: 'nowrap', alignItems: 'flex-end' }}><Field label="Find a skill or command" value={query} onChangeText={setQuery} containerStyle={{ flex: 1 }} />{!!query && <Button title="Clear" accessibilityLabel="Clear skill and command search" compact variant="ghost" onPress={() => setQuery('')} />}</Row>
    <Label muted>Use slash commands and skills from the chat composer.</Label>
    <Label style={styles.sectionLabel}>SKILLS · {skills.length}</Label>{skills.map(item => <Disclosure key={item.id} title={item.name}><Label muted>{item.description}</Label><Label style={{ fontFamily: mono, fontSize: 12 }}>{item.path}</Label><Text selectable style={{ color: colors.text, lineHeight: 21 }}>{item.content}</Text></Disclosure>)}
    <Label style={styles.sectionLabel}>COMMANDS · {commands.length}</Label>{commands.map(item => <Card key={item.name}><Label style={styles.name}>/{item.name}</Label><Label muted>{item.description}</Label></Card>)}
    {data && !loading && !!(data.skills.length || data.commands.length) && !skills.length && !commands.length && <Empty title="No matching skills or commands" detail="Try a skill name, description, or command name." />}
    {data && !data.skills.length && !data.commands.length && <Empty title="No custom skills or commands" />}
  </Page>;
}

function Plugins({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => (await client.plugin.list({ location: { directory } }, { signal })).data);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => { setBusy(true); setErrorAction(null); try { await action(); await refresh(); } catch (e) { setErrorAction(errorMessage(e)); } finally { setBusy(false); } };
  return <Page error={error} loading={loading} refresh={refresh}>
    <Label muted>Edit the plugins list in your configuration to add or disable a plugin.</Label><ErrorNotice error={errorAction} />{notice && <Label style={{ color: colors.success }}>{notice}</Label>}
    <Button title="Check package updates" busy={busy} onPress={() => void run(async () => { const result = await client.plugin.check({ location: { directory } }); setNotice(`${result.data.filter(item => item.source.type === 'package' && item.source.outdated).length} package updates available.`); })} />
    {data?.map((item, index) => <Card key={`${item.id}:${index}`}><Label style={styles.name}>{item.id || (item.source.type === 'package' ? item.source.target : 'Plugin')}</Label><Label muted>{item.source.type} · {item.state.status}</Label>{item.state.status === 'failed' && <Label style={{ color: colors.danger }}>{item.state.error}</Label>}
      {item.source.type === 'package' && <><Label muted>{item.source.target}{item.source.version ? ` · ${item.source.version}` : ''}</Label><Button title={item.source.outdated ? 'Update package' : 'Reinstall latest package'} compact busy={busy} onPress={() => void run(async () => { if (item.source.type === 'package' && await confirmAction('Update plugin?', 'This installs the latest package version on your server.')) await client.plugin.update({ location: { directory }, targets: [item.source.target] }); })} /></>}
      <Label muted>{Object.entries(item.features).filter(([, enabled]) => enabled).map(([feature]) => feature).join(' · ')}</Label>
      {item.features.gui && <Label muted>This plugin includes a desktop web interface. Its tools and commands remain available through the server.</Label>}
    </Card>)}
  </Page>;
}

function Permissions({ client, directory }: { client: Client; directory: string }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { data, error, loading, refresh } = useResource(client, directory, async signal => { const location = await client.location.get({ location: { directory } }, { signal }); return client.permission.saved.list({ projectID: location.project.id }, { signal }); });
  const [selected, setSelected] = useState<PermissionSavedInfo>();
  const [action, setAction] = useState('');
  const [resource, setResource] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorAction, setErrorAction] = useState<string | null>(null);
  const run = async (task: (signal: AbortSignal) => Promise<void>) => { setBusy(true); setErrorAction(null); try { await withSettingsRequest(async signal => { await task(signal); await refresh(signal); }); } catch (e) { setErrorAction(errorMessage(e)); } finally { setBusy(false); } };
  return <Page error={error} loading={loading} refresh={refresh}>
    <Label muted>These are the approvals that you saved with “Always allow” in this project.</Label><ErrorNotice error={errorAction} />
    {data?.map(item => <Card key={item.id}><Label style={styles.name}>{item.action}</Label><Label style={{ fontFamily: mono }}>{item.resource}</Label><Row><Button title="Edit" compact disabled={busy} onPress={() => { setSelected(item); setAction(item.action); setResource(item.resource); setErrorAction(null); }} /><Button title="Revoke" variant="danger" compact busy={busy} onPress={() => { void confirmAction('Revoke saved approval?', 'OpenCode will ask again when this action requires permission.').then(confirmed => { if (confirmed) void run(async signal => { await client.permission.saved.remove({ id: item.id }, { signal }); }); }); }} /></Row></Card>)}
    {data && !data.length && <Empty title="No saved approvals" detail="OpenCode will ask you before protected actions." />}
    <Sheet visible={!!selected} title="Edit saved approval" onClose={() => { if (!busy) setSelected(undefined); }}><ErrorNotice error={errorAction} /><Field label="Action" value={action} editable={!busy} onChangeText={setAction} /><Field label="Resource pattern" value={resource} editable={!busy} onChangeText={setResource} /><Button title="Save approval" variant="primary" busy={busy} disabled={!action.trim() || !resource.trim()} onPress={() => void run(async signal => { if (!selected) return; await client.permission.saved.update({ id: selected.id, action: action.trim(), resource: resource.trim() }, { signal }); signal.throwIfAborted(); setSelected(undefined); })} /></Sheet>
  </Page>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  betaScreen: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  betaAppearanceCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.panel },
  betaSettingTitle: { fontFamily: sans, fontSize: 13, lineHeight: 20, fontWeight: '500' },
  betaSettingChooser: { minHeight: 28, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  betaTopRow: { minHeight: 48, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  betaBack: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6 }, betaBackLabel: { fontSize: 13, lineHeight: 18 },
  betaChooserTarget: { minHeight: 48, justifyContent: 'center' }, betaChooser: { borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 10 },
  betaSearch: { minHeight: 48, marginHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  betaSearchInput: { minHeight: 48, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0, fontSize: 14 }, betaClear: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  betaSectionHeader: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }, betaSectionHeading: { flex: 1, gap: 6 }, betaTitle: { fontFamily: sans, fontSize: 14, lineHeight: 20, fontWeight: '500' }, betaDescription: { fontSize: 13, lineHeight: 20 },
  betaCategoryRow: { minHeight: 48, paddingVertical: 6, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 12 }, betaResults: { paddingHorizontal: 14, paddingBottom: 24 }, betaHidden: { display: 'none' },
  screen: { flex: 1, flexDirection: 'row', minHeight: 0, backgroundColor: colors.bg }, nativeNavigation: { flex: 1, minHeight: 0 },
  narrowScreen: { flexDirection: 'column' }, content: { flex: 1, flexDirection: 'row', minHeight: 0 }, narrowContent: { flexDirection: 'column' },
  sidebar: { width: 220, flexGrow: 0, borderRightWidth: 1, borderRightColor: colors.border },
  index: { padding: 16, paddingHorizontal: pageInset, paddingBottom: 32, gap: 24 },
  indexHeader: { gap: 5 }, group: { gap: 8 }, groupTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, paddingHorizontal: 16 },
  groupPanel: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  sectionRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, paddingVertical: 12 },
  sectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }, currentSection: { backgroundColor: colors.selected },
  sectionName: { fontFamily: sans, fontSize: 16, fontWeight: '500' }, sectionDescription: { fontSize: 12, lineHeight: 18 }, chevron: { fontSize: 24 },
  detail: { flex: 1, minWidth: 0 }, detailHeader: { minHeight: 64, paddingHorizontal: 12, paddingVertical: 6, flexWrap: 'nowrap', borderBottomWidth: 1, borderBottomColor: colors.border },
  detailTitle: { fontFamily: sans, fontSize: 24, lineHeight: 30, fontWeight: '500', flex: 1, flexShrink: 1 },
  page: { padding: 16, paddingHorizontal: pageInset, paddingBottom: 32, gap: 16 },
  name: { fontFamily: sans, fontSize: 16, fontWeight: '600' }, sectionLabel: { fontFamily: sans, color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 8 },
});
