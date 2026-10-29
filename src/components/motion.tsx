import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, cubicBezier, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const easePress = cubicBezier(0.23, 1, 0.32, 1);
const easeDrawer = Easing.bezier(0.32, 0.72, 0, 1);

export function useMotionPreference() {
  const initial = useReducedMotion();
  const [reduced, setReduced] = useState(initial);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReduced(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { live = false; subscription?.remove(); };
  }, []);
  return reduced;
}

export function PressFeedback({ pressed, disabled, children, style }: { pressed: boolean; disabled?: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useMotionPreference();
  const down = pressed && !disabled;
  const opacity = StyleSheet.flatten(style)?.opacity ?? 1;
  return <Animated.View pointerEvents="none" style={[styles.pressContent, style, {
    opacity: opacity * (reduced && down ? 0.88 : 1),
    transform: [{ translateY: !reduced && down ? 1 : 0 }, { scale: !reduced && down ? 0.97 : 1 }],
    transitionProperty: reduced ? 'none' : 'transform',
    transitionDuration: 120,
    transitionTimingFunction: easePress,
  }]}>{children}</Animated.View>;
}

export function WorkingIndicator({ active, color, size = 16 }: { active: boolean; color: string; size?: number }) {
  const reduced = useMotionPreference();
  const opacity = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(opacity);
    opacity.set(1);
    if (active && !reduced) opacity.set(withRepeat(withTiming(0.45, { duration: 600, easing: Easing.linear, reduceMotion: ReduceMotion.System }), -1, true));
    return () => cancelAnimation(opacity);
  }, [active, reduced, opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return <Animated.View aria-hidden style={[styles.indicator, { width: size, height: size }, pulse]}><Animated.View style={{ width: size / 2, height: size / 2, borderRadius: size / 4, backgroundColor: color }} /></Animated.View>;
}

export function MotionDrawer({ visible, width, onClose, onDismiss, children, panelStyle, scrimColor = '#00000070' }: {
  visible: boolean;
  width: number;
  onClose: () => void;
  onDismiss?: () => void;
  children: React.ReactNode;
  panelStyle?: StyleProp<ViewStyle>;
  scrimColor?: string;
}) {
  const reduced = useMotionPreference();
  const progress = useSharedValue(0);
  const [presented, setPresented] = useState(visible);
  const showing = useRef(false);
  const requested = useRef(visible);
  requested.current = visible;
  const revision = useRef(0);
  const pendingDismiss = useRef(false);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  const notifyDismissed = useCallback(() => {
    if (!pendingDismiss.current || requested.current) return;
    pendingDismiss.current = false;
    dismissRef.current?.();
  }, []);
  const finishClose = useCallback((request: number) => {
    if (request !== revision.current || requested.current) return;
    showing.current = false;
    pendingDismiss.current = true;
    setPresented(false);
  }, []);
  const animate = useCallback((open: boolean) => {
    const request = ++revision.current;
    progress.set(withTiming(open ? 1 : 0, { duration: reduced ? 100 : open ? 220 : 180, easing: easeDrawer, reduceMotion: ReduceMotion.Never }, finished => {
      if (finished && !open) scheduleOnRN(finishClose, request);
    }));
  }, [progress, reduced, finishClose]);

  useEffect(() => {
    if (visible) {
      pendingDismiss.current = false;
      setPresented(true);
      if (showing.current) animate(true);
    } else if (presented) animate(false);
  }, [visible, presented, animate]);
  useEffect(() => {
    if (presented || Platform.OS === 'ios' || !pendingDismiss.current) return;
    const frame = requestAnimationFrame(notifyDismissed);
    return () => cancelAnimationFrame(frame);
  }, [presented, notifyDismissed]);
  useEffect(() => () => cancelAnimation(progress), [progress]);

  const backdrop = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const panel = useAnimatedStyle(() => ({ opacity: reduced ? progress.get() : 1, transform: [{ translateX: reduced ? 0 : -width * (1 - progress.get()) }] }), [reduced, width]);
  return <Modal visible={presented} transparent animationType="none" supportedOrientations={['portrait', 'portrait-upside-down', 'landscape-left', 'landscape-right']} onRequestClose={onClose} onDismiss={notifyDismissed} onShow={() => {
    showing.current = true;
    animate(requested.current);
  }}>
    <SafeAreaProvider>
    <Animated.View style={styles.drawerRoot}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrimColor }, backdrop]}><Pressable accessibilityRole="button" accessibilityLabel="Close navigation" onPress={onClose} style={StyleSheet.absoluteFill} /></Animated.View>
      <Animated.View accessibilityViewIsModal style={[{ width, height: '100%' }, panelStyle, panel]}>{children}</Animated.View>
    </Animated.View>
    </SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  pressContent: { alignItems: 'center', justifyContent: 'center' },
  indicator: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  drawerRoot: { flex: 1, flexDirection: 'row' },
});
