# Design

## Spacing & layout

- **Put a chevron or other disclosure icon directly after the label that it controls, with a 4 px gap. Never push it to the far edge of the row.** A long label shrinks and truncates, and the icon stays visible after the ellipsis. `BetaTabStrip` in `src/components/beta-navigation.tsx` shows the pattern.
  <!-- 2026-11-13: "wouldn't it be better if the up-down chevron was like right beside the session name?" -->

## Motion

- **Run every frame-by-frame animation on the UI thread with Reanimated shared values (`withTiming`, `useAnimatedStyle`). Never step an animation through React state on a timer.** React may render only when content changes, never for each frame of an animation. To animate part of a text block, use a nested `Animated.Text` that animates the alpha of its color, because a nested `Text` has no reliable opacity on native. `FadeSpan` in `src/components/fade-span.tsx` shows the pattern. Why: an animation that React renders about 30 times a second runs on the JavaScript thread, which can cause problems. Worklets move the animation off that thread.
  <!-- 2026-11-13: "you said we are rendering this on the main thread which can cause problems because it's 30 times a second. So we can fix that with worklets and use our own fade" -->

- **Bottom sheets slide up from the bottom edge, and the scrim fades. Never fade the sheet panel.** Use `Sheet` from `src/components/ui.tsx`. Its `fitContent` mode animates the panel and the scrim through `useSheetTransition` in `src/components/motion.tsx`.
  <!-- 2026-11-13: "the animation of the bottom sheet is like a fade-in instead of you know a sliding one" -->

## Interaction

- **A trigger icon must match the surface that it opens. Use a down chevron only for a menu that drops below the trigger. A control that opens a selection bottom sheet uses the `chevron-up-down` icon.** Why: a down chevron tells the user that a menu will appear below the trigger, but a bottom sheet appears at the bottom of the screen.
  <!-- 2026-11-13: "I'm wondering if like a downward pointing chevron is the best representation for this since what appears is actually a bottom sheet?" -->
- **Full-width pressable rows and bars use the native press feedback of the platform. On Android, use `android_ripple` with `{ alpha: 0.12, color: colors.text, foreground: true }`. On iOS and web, dim the content. Never scale a full-width row or bar on press.** Buttons keep the scale feedback of `PressFeedback`. Why: native feedback makes a control feel native and good to tap. A full-width bar that scales looks wrong.
  <!-- 2026-11-13: "Try and use like native elements. Like it should feel really native and good to type all of that stuff" -->

## Copy

- **Never show a bare number in a navigation bar, header, or tab strip. Label a count with a word or an icon that names what it counts, or remove the count.** Why: a user who sees the number for the first time cannot tell what it means.
  <!-- 2026-11-13: "there's like a session name and then there's a weird number to the right. Like the number makes no sense to someone who's just looking at it for the first time" -->
