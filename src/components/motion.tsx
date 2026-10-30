import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, cubicBezier, Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Svg, { Circle } from 'react-native-svg';

const easePress = cubicBezier(0.23, 1, 0.32, 1);
const easeDrawer = Easing.bezier(0.32, 0.72, 0, 1);
const easeContent = Easing.bezier(0.23, 1, 0.32, 1);

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

export function MotionDisclosureChevron({ open, children, style }: { open: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useMotionPreference();
  return <Animated.View aria-hidden style={[styles.indicator, style, {
    transform: [{ rotate: open ? '90deg' : '0deg' }],
    transitionProperty: reduced ? 'none' : 'transform',
    transitionDuration: 140,
    transitionTimingFunction: easePress,
  }]}>{children}</Animated.View>;
}

export function MotionDisclosureBody({ open, children, style }: { open: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useMotionPreference();
  const [presented, setPresented] = useState(open);
  const progress = useSharedValue(open ? 1 : 0);
  const initial = useRef(true);
  const alive = useRef(true);
  const requested = useRef(open);
  requested.current = open;
  const revision = useRef(0);
  const finishClose = useCallback((request: number) => {
    if (alive.current && request === revision.current && !requested.current) setPresented(false);
  }, []);
  useLayoutEffect(() => {
    if (initial.current) { initial.current = false; return; }
    const request = ++revision.current;
    cancelAnimation(progress);
    if (open) setPresented(true);
    progress.set(withTiming(open ? 1 : 0, { duration: reduced ? 80 : open ? 140 : 110, easing: easeContent, reduceMotion: ReduceMotion.Never }, finished => {
      if (finished && !open) scheduleOnRN(finishClose, request);
    }));
  }, [open, reduced, progress, finishClose]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; revision.current++; cancelAnimation(progress); };
  }, [progress]);
  const reveal = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: reduced ? 0 : -3 * (1 - progress.get()) }],
  }), Platform.OS === 'web' ? [reduced] : undefined);
  if (!presented) return null;
  return <Animated.View pointerEvents={open ? 'auto' : 'none'} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} style={[style, reveal]}>{children}</Animated.View>;
}

export function MotionScreen({ visible, children, style }: { visible: boolean; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useMotionPreference();
  const progress = useSharedValue(0);
  const previousVisible = useRef(false);

  useLayoutEffect(() => {
    const wasVisible = previousVisible.current;
    previousVisible.current = visible;
    cancelAnimation(progress);
    if (!visible) {
      progress.set(0);
    } else if (!wasVisible) {
      progress.set(0);
      progress.set(withTiming(1, { duration: reduced ? 100 : 170, easing: easeContent, reduceMotion: ReduceMotion.Never }));
    } else {
      progress.set(1);
    }
  }, [visible, reduced, progress]);
  useEffect(() => () => cancelAnimation(progress), [progress]);

  const entry = useAnimatedStyle(() => ({
    opacity: visible ? progress.get() : 0,
    transform: [{ translateX: visible && !reduced ? 8 * (1 - progress.get()) : 0 }],
  }), Platform.OS === 'web' ? [reduced, visible] : undefined);

  return <Animated.View
    accessibilityElementsHidden={!visible}
    importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    pointerEvents={visible ? 'auto' : 'none'}
    style={[styles.screen, style, entry]}
  >{children}</Animated.View>;
}

export function MotionContent({ transitionKey, variant, direction = 1, enabled = true, children, style }: {
  transitionKey: string | number | boolean;
  variant: 'context' | 'connection';
  direction?: -1 | 0 | 1;
  enabled?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useMotionPreference();
  const progress = useSharedValue(1);
  const previous = useRef(transitionKey);
  useLayoutEffect(() => {
    const changed = previous.current !== transitionKey;
    previous.current = transitionKey;
    cancelAnimation(progress);
    if (!changed || !enabled || (variant === 'connection' && direction === 0)) { progress.set(1); return; }
    progress.set(0);
    progress.set(withTiming(1, { duration: variant === 'context' ? reduced ? 80 : 120 : reduced ? 100 : 180, easing: easeContent, reduceMotion: ReduceMotion.Never }));
  }, [transitionKey, variant, direction, enabled, reduced, progress]);
  useEffect(() => () => cancelAnimation(progress), [progress]);
  const entry = useAnimatedStyle(() => ({
    opacity: reduced ? 0.9 + progress.get() * 0.1 : variant === 'context' ? 0.75 + progress.get() * 0.25 : 0.8 + progress.get() * 0.2,
    transform: [{ translateX: variant === 'connection' && !reduced ? direction * 12 * (1 - progress.get()) : 0 }],
  }), Platform.OS === 'web' ? [variant, direction, reduced] : undefined);
  return <Animated.View style={[style, entry]}>{children}</Animated.View>;
}

export function WorkingIndicator({ active, color, size = 16 }: { active: boolean; color: string; size?: number }) {
  const reduced = useMotionPreference();
  const rotation = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(rotation);
    rotation.set(0);
    if (active && !reduced) rotation.set(withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear, reduceMotion: ReduceMotion.System }), -1, false));
    return () => cancelAnimation(rotation);
  }, [active, reduced, rotation]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));
  return <Animated.View aria-hidden style={[styles.indicator, { width: size, height: size }, spin]}><Svg width={size} height={size} viewBox="0 0 16 16" fill="none"><Circle cx="8" cy="8" r="5.5" stroke={color} strokeOpacity={0.2} strokeWidth="1.5" /><Circle cx="8" cy="8" r="5.5" stroke={color} strokeWidth="1.5" strokeDasharray="12 23" strokeLinecap="round" /></Svg></Animated.View>;
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
  const panel = useAnimatedStyle(() => ({ opacity: reduced ? progress.get() : 1, transform: [{ translateX: reduced ? 0 : -width * (1 - progress.get()) }] }), Platform.OS === 'web' ? [reduced, width] : undefined);
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
  screen: { flex: 1, minWidth: 0, minHeight: 0 },
  pressContent: { alignItems: 'center', justifyContent: 'center' },
  indicator: { alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  drawerRoot: { flex: 1, flexDirection: 'row' },
});
