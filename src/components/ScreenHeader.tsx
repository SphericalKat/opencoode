import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Label } from './ui';
import { ShellIcon } from './ShellIcon';
import { useTheme, useThemedStyles, type ThemeColors } from '../lib/theme';
import { pageInset } from '../lib/layout';

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
      <ShellIcon name="back" color={colors.text} size={22} />
    </Pressable>}
    <Label accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Label>
    {onRefresh && <Pressable accessibilityRole="button" accessibilityLabel="Refresh" accessibilityState={{ disabled: refreshing, busy: refreshing }} disabled={refreshing} onPress={() => onRefresh()} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}>{refreshing ? <ActivityIndicator size="small" color={colors.muted} /> : <ShellIcon name="refresh" color={colors.text} />}</Pressable>}
    {onOpenNavigation && <Pressable accessibilityRole="button" accessibilityLabel="Open navigation" onPress={onOpenNavigation} style={({ pressed }) => [styles.menu, pressed && styles.pressed]}><ShellIcon name="menu" color={colors.text} /></Pressable>}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  header: { minHeight: 56, paddingHorizontal: pageInset, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  back: { width: Platform.OS === 'android' ? 48 : 44, height: Platform.OS === 'android' ? 48 : 44, marginStart: -16, marginEnd: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: '600', flex: 1 },
  menu: { width: Platform.OS === 'android' ? 48 : 44, height: Platform.OS === 'android' ? 48 : 44, marginEnd: -16, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  pressed: { backgroundColor: colors.selected },
});
