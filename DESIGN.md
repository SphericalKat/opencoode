# Design

## Motion

- **Run every frame-by-frame animation on the UI thread with Reanimated shared values (`withTiming`, `useAnimatedStyle`). Never step an animation through React state on a timer.** React may render only when content changes, never for each frame of an animation. To animate part of a text block, use a nested `Animated.Text` that animates the alpha of its color, because a nested `Text` has no reliable opacity on native. `FadeSpan` in `src/components/fade-span.tsx` shows the pattern. Why: an animation that React renders about 30 times a second runs on the JavaScript thread, which can cause problems. Worklets move the animation off that thread.
  <!-- 2026-11-13: "you said we are rendering this on the main thread which can cause problems because it's 30 times a second. So we can fix that with worklets and use our own fade" -->
