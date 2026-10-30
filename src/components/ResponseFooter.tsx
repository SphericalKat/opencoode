import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Rect } from 'react-native-svg';
import { errorMessage } from '../lib/client';
import { useTheme } from '../lib/theme';
import { Label } from './ui';

export function ResponseFooter({ text, elapsedSeconds }: { text: string; elapsedSeconds?: number }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <View>
    <View style={styles.footer}><Pressable accessibilityRole="button" accessibilityLabel={copied ? 'Response copied' : 'Copy response'} onPress={event => {
      event.stopPropagation();
      setError(null);
      void Clipboard.setStringAsync(text).then(() => setCopied(true)).catch(reason => { setCopied(false); setError(errorMessage(reason)); });
    }} style={({ pressed }) => [styles.copy, pressed && { opacity: 0.6 }]}><Svg width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden>{copied ? <Path d="m3 8 3 3 7-7" stroke={colors.muted} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" /> : <><Rect x={2} y={5} width={9} height={9} rx={1.5} stroke={colors.muted} /><Path d="M5 5V3a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-2" stroke={colors.muted} /></>}</Svg></Pressable>{(copied || elapsedSeconds !== undefined) && <Label muted accessibilityLiveRegion="polite" style={styles.detail}>{copied ? 'Copied' : ''}{copied && elapsedSeconds !== undefined ? ' · ' : ''}{elapsedSeconds !== undefined ? `${elapsedSeconds}s` : ''}</Label>}</View>
    {error && <Text accessibilityRole="alert" style={[styles.detail, { color: colors.danger }]}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', marginStart: -16 },
  copy: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  detail: { fontSize: 11, lineHeight: 16 },
});
