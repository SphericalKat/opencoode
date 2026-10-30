import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Label } from './ui';
import { ShellIcon } from './ShellIcon';
import { useTheme, useThemedStyles, type ThemeColors } from '../lib/theme';

export function ScreenHeader({ title, backLabel, onBack, onOpenNavigation, onRefresh, refreshing }: {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  onOpenNavigation?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return <View style={styles.header}>
    {onBack && <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${backLabel || 'Sessions'}`} onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <View style={styles.backIcon}><ShellIcon name="chevron" color={colors.text} size={16} /></View>
      <Label numberOfLines={1} style={styles.backLabel}>{backLabel || 'Sessions'}</Label>
    </Pressable>}
    <Label accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Label>
    {onRefresh && <Pressable accessibilityRole="button" accessibilityLabel="Refresh" accessibilityState={{ disabled: refreshing, busy: refreshing }} disabled={refreshing} onPress={() => onRefresh()} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}>{refreshing ? <ActivityIndicator size="small" color={colors.muted} /> : <ShellIcon name="refresh" color={colors.text} />}</Pressable>}
    {onOpenNavigation && <Pressable accessibilityRole="button" accessibilityLabel="Open navigation" onPress={onOpenNavigation} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}><ShellIcon name="menu" color={colors.text} /></Pressable>}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  header: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  back: { minHeight: Platform.OS === 'android' ? 48 : 44, flexDirection: 'row', alignItems: 'center', gap: 2, paddingRight: 4, borderRadius: 6, maxWidth: '40%' },
  backIcon: { transform: [{ rotate: '180deg' }] },
  backLabel: { fontSize: 14, flexShrink: 1 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: '600', flex: 1 },
  menu: { width: Platform.OS === 'android' ? 48 : 44, height: Platform.OS === 'android' ? 48 : 44, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  pressed: { backgroundColor: colors.selected },
});
