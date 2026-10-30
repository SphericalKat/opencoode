import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../lib/theme';

export function UserMessageBubble({ children, withAttachments = false }: { children: React.ReactNode; withAttachments?: boolean }) {
  const { colors } = useTheme();
  return <View style={[styles.bubble, withAttachments && styles.attachments, { backgroundColor: colors.raised }]}>{children}</View>;
}

const styles = StyleSheet.create({
  bubble: { alignSelf: 'flex-end', maxWidth: '92%', minWidth: 0, padding: 12, borderRadius: 12, gap: 10 },
  attachments: { width: '92%' },
});
