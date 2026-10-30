import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle, type TextProps } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { darkColors, type ThemeColors, useTheme, useThemedStyles } from '../lib/theme';
import { PressFeedback, useMotionPreference } from './motion';

export const colors = darkColors;
export const sans = 'Inter';
export const mono = 'IBMPlexMono';
export const touchTarget = Platform.OS === 'android' ? 48 : 44;

export function Label({ children, muted, style, ...props }: TextProps & { muted?: boolean }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <Text {...props} style={[styles.text, muted && { color: colors.muted }, style]}>{children}</Text>;
}
export function Heading({ children }: { children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return <Text accessibilityRole="header" style={styles.heading}>{children}</Text>;
}
export function Button({ title, onPress, variant = 'secondary', disabled, busy, compact, selected, accessibilityLabel }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; disabled?: boolean; busy?: boolean; compact?: boolean; selected?: boolean; accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy, selected }} aria-pressed={selected} disabled={disabled || busy} onPress={onPress}
    style={[styles.buttonTarget, (disabled || busy) && { opacity: 0.55 }]}>
    {({ pressed }) => <PressFeedback pressed={pressed} disabled={disabled || busy} style={[styles.button, compact && styles.compact, variant === 'primary' && styles.primary, variant === 'ghost' && styles.ghost, variant === 'danger' && styles.danger, selected && styles.selectedButton, pressed && (variant === 'ghost' ? styles.ghostPressed : styles.pressed)]}>{busy ? <ActivityIndicator size="small" color={selected ? colors.text : variant === 'primary' ? colors.primaryText : colors.muted} /> : <Text style={[styles.buttonText, variant === 'primary' && { color: colors.primaryText }, variant === 'danger' && { color: colors.danger }, selected && { color: colors.text }]}>{selected ? `✓ ${title}` : title}</Text>}</PressFeedback>}
  </Pressable>;
}
export function Field({ label, style, containerStyle, ...props }: TextInputProps & { label?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [focused, setFocused] = useState(false);
  return <View style={[{ gap: 8 }, containerStyle]}>{label && <Label muted style={styles.fieldLabel}>{label}</Label>}<TextInput accessibilityLabel={label ?? props.placeholder} placeholderTextColor={colors.faint} selectionColor={colors.focus} autoCapitalize="none" autoCorrect={false} {...props} onFocus={event => { setFocused(true); props.onFocus?.(event); }} onBlur={event => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, props.multiline && { minHeight: 100, textAlignVertical: 'top' }, focused && { borderColor: colors.focus }, style]} /></View>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const styles = useThemedStyles(createStyles);
  return <View style={[styles.row, style]}>{children}</View>;
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  const styles = useThemedStyles(createStyles);
  return <View style={styles.empty}><Label style={{ fontSize: 16, fontWeight: '500', textAlign: 'center' }}>{title}</Label>{detail && <Label muted style={{ textAlign: 'center', lineHeight: 22 }}>{detail}</Label>}</View>;
}
export function ErrorNotice({ error, onRetry }: { error: string | null | undefined; onRetry?: () => void }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  if (!error) return null;
  return <View accessibilityRole="alert" style={styles.error}><Label style={{ color: colors.danger, flex: 1 }}>{error}</Label>{onRetry && <Button title="Retry" compact onPress={onRetry} />}</View>;
}
export function Busy() { const { colors } = useTheme(); return <ActivityIndicator style={{ padding: 30 }} color={colors.muted} />; }
export function Sheet({ visible, title, children, onClose, onDismiss, scroll = true }: { visible: boolean; title: string; children: React.ReactNode; onClose: () => void; onDismiss?: () => void; scroll?: boolean }) {
  const styles = useThemedStyles(createStyles);
  const reduced = useMotionPreference();
  const SafeAreaRoot = Platform.OS === 'web' ? React.Fragment : SafeAreaProvider;
  const requested = useRef(visible);
  requested.current = visible;
  const previousVisible = useRef(visible);
  const pendingDismiss = useRef(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const notifyDismissed = useCallback(() => {
    if (requested.current || !pendingDismiss.current) return;
    pendingDismiss.current = false;
    dismissRef.current?.();
  }, []);
  useEffect(() => {
    const wasVisible = previousVisible.current;
    previousVisible.current = visible;
    if (visible) {
      pendingDismiss.current = false;
      return;
    }
    if (!wasVisible) return;
    pendingDismiss.current = true;
    if (Platform.OS !== 'android') return;
    const frame = requestAnimationFrame(notifyDismissed);
    return () => cancelAnimationFrame(frame);
  }, [visible, notifyDismissed]);
  return <Modal visible={visible} animationType={reduced ? 'fade' : 'slide'} presentationStyle="pageSheet" supportedOrientations={['portrait', 'landscape-left', 'landscape-right']} onRequestClose={onClose} onDismiss={notifyDismissed}>
    <SafeAreaRoot>
    <SafeAreaView style={styles.sheet}>
      <KeyboardAvoidingView style={styles.sheetLayout} behavior="padding" automaticOffset>
        <View style={styles.sheetInner}>
          <View style={styles.sheetHeader}><Heading>{title}</Heading><Button title="Done" compact onPress={onClose} /></View>
          {scroll ? <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={styles.sheetContent}>{children}</ScrollView> : <View style={styles.sheetBody}>{children}</View>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </SafeAreaRoot>
  </Modal>;
}
export async function confirmAction(title: string, message: string, options: { confirmLabel?: string; destructive?: boolean } = {}): Promise<boolean> {
  if (Platform.OS === 'web') return window.confirm(`${title}\n\n${message}`);
  return new Promise(resolve => Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: options.confirmLabel || 'Continue', style: options.destructive === false ? 'default' : 'destructive', onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
}
export function JsonView({ value }: { value: unknown }) {
  const { colors } = useTheme();
  return <Text selectable style={{ fontFamily: mono, fontSize: 12, lineHeight: 19, color: colors.text }}>{JSON.stringify(value, null, 2)}</Text>;
}
export function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  return <Card style={styles.disclosure}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setOpen(!open)} style={({ pressed }) => [styles.disclosureHeader, pressed && styles.ghostPressed]}><Label style={{ fontWeight: '500' }}>{open ? '−' : '+'}  {title}</Label></Pressable>{open && <View style={styles.disclosureBody}>{children}</View>}</Card>;
}
function createStyles(colors: ThemeColors) {
  const inset = Platform.OS !== 'android' || Number(Platform.Version) >= 29;
  return StyleSheet.create({
  text: { color: colors.text, fontFamily: sans, fontSize: 14, lineHeight: 21 }, heading: { color: colors.text, fontFamily: sans, fontSize: 20, fontWeight: '500', letterSpacing: -0.32, flexShrink: 1 },
  buttonTarget: { minHeight: touchTarget, minWidth: touchTarget, justifyContent: 'center', alignItems: 'stretch' },
  button: { borderRadius: 6, minHeight: 36, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.raised, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderTopColor: colors.controlTopEdge, boxShadow: [{ offsetX: 0, offsetY: 1, blurRadius: 1, color: '#00000035' }] },
  compact: { minHeight: 32, paddingVertical: 5, paddingHorizontal: 10 }, primary: { backgroundColor: colors.primary }, ghost: { backgroundColor: 'transparent', borderColor: 'transparent', borderTopColor: 'transparent', boxShadow: [] }, danger: { backgroundColor: colors.raised },
  selectedButton: { backgroundColor: colors.selected, borderColor: colors.faint, borderTopColor: colors.faint },
  pressed: { borderTopColor: colors.border, boxShadow: inset ? [{ offsetX: 0, offsetY: 1, blurRadius: 1, color: '#00000030', inset: true }] : [] }, ghostPressed: { backgroundColor: colors.raised },
  buttonText: { color: colors.text, fontFamily: sans, fontWeight: '500', fontSize: 13, lineHeight: 20, letterSpacing: -0.04, fontVariant: ['tabular-nums'] }, input: { color: colors.text, fontFamily: sans, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderBottomColor: colors.controlTopEdge, borderRadius: 8, padding: 12, fontSize: 16, minHeight: touchTarget, boxShadow: inset ? [{ offsetX: 0, offsetY: 1, blurRadius: 2, color: '#00000020', inset: true }] : [] }, fieldLabel: { fontSize: 13, fontWeight: '500', letterSpacing: 0 },
  card: { backgroundColor: colors.panel, borderRadius: 8, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.border }, row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }, empty: { padding: 28, gap: 8, alignItems: 'center', justifyContent: 'center', flex: 1 },
  error: { padding: 12, borderRadius: 8, backgroundColor: colors.dangerBackground, flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheet: { flex: 1, backgroundColor: colors.panel }, sheetLayout: { flex: 1, minHeight: 0 }, sheetInner: { flex: 1, minHeight: 0, width: '100%', maxWidth: 680, alignSelf: 'center' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 12, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border },
  sheetScroll: { flex: 1, minHeight: 0 }, sheetContent: { padding: 18, gap: 16, paddingBottom: 24 }, sheetBody: { flex: 1, minHeight: 0 },
  disclosure: { padding: 0, gap: 0 }, disclosureHeader: { minHeight: touchTarget, padding: 14, justifyContent: 'center', borderRadius: 8 }, disclosureBody: { padding: 14, paddingTop: 0, gap: 10 },
}); }
