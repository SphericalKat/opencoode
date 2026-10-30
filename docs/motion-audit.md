# Mobile motion record

I reviewed motion opportunities on October 29, 2026, before the implementation pass.
The original audit proposed a working indicator, drawer movement, press feedback, and clipboard feedback.
This record separates those proposals from the delivered source.

## Delivered effects

The app uses React Native 0.88.1, Expo SDK 58, Reanimated, and Worklets.
The source keeps touch targets fixed and animates their content.
It preserves the OpenCode charcoal surfaces and immediate readable output.

| Effect | Implemented behavior | Reduced motion |
| --- | --- | --- |
| Raised controls | Content moves down 1 px and scales to 0.97. The transform lasts 120 ms with `cubic-bezier(0.23, 1, 0.32, 1)`. | Displacement stops. Pressed content uses 0.88 opacity. |
| Working indicator | One 16 px session indicator changes opacity between 1 and 0.45 over each 600 ms half-cycle. | The indicator stays static. Hidden or inactive chats stop the pulse. |
| Phone drawer | The panel enters from the left over 220 ms and exits over 180 ms. The scrim shares its progress. | A 100 ms opacity transition replaces travel. |
| Sheets and terminal | Native page-sheet and full-screen modals use platform slide transitions. | Native fade replaces slide. |
| Clipboard feedback | Copy changes to Copied only after the clipboard promise succeeds. | The successful label stays static. |

The drawer uses `cubic-bezier(0.32, 0.72, 0, 1)` and retains its panel until the exit completes.
The tablet sidebar stays static.
The clipboard crossfade from the initial proposal did not ship.

Implementation: `src/components/motion.tsx`, `src/components/ui.tsx`, `src/components/TerminalPanel.tsx`, and `src/screens/ChatScreen.tsx`.

## Streaming stability

I updated this section from the frozen source on October 30, 2026.
The transcript uses FlashList 2.3.2 with an initial bottom anchor and automatic bottom-follow without animation.
A user drag or upward browser wheel movement pauses bottom-follow.
Jump to latest returns to the end and restores bottom-follow.

The client coalesces text deltas and tool progress into the next animation frame.
If the frame API is unavailable, that path uses a 16 ms timer.
Other session events flush pending deltas before their own update.
Reconnect, stream failure, and cleanup also flush pending events.

The batch projector builds one history index for the whole event batch and preserves unchanged message objects.
Stable message rows, assistant parts, and Markdown blocks can skip unchanged content.
Markdown still parses changed text. Block memoization limits unchanged native view work rather than eliminates parsing.
Metadata, history, inbox, and pending requests use separate refresh scopes.
Execution completion and reconnect still request a full authoritative refresh.

Implementation: `src/lib/streamBatch.ts`, `src/lib/chat.ts`, `src/screens/ChatScreen.tsx`, and `src/components/Markdown.tsx`.

The lead agent observed a real browser response of about 450 words and recorded a zero-pixel gap at the transcript end.
An upward wheel movement paused bottom-follow and exposed Jump to latest.
These observations establish those interactions. They do not establish a measured frame-rate improvement or release performance.

## Rejected motion

| Candidate | Reason |
| --- | --- |
| Per-token fade, typewriter delay, blur, or shimmer | The user reads and selects streamed text. Decoration delays or obscures that work. |
| Entrance or bounce for each tool row | Tool-heavy sessions repeat these changes too often. Movement makes historical results harder to scan. |
| Sliding between peer destinations | Frequent navigation does not need a spatial transition. |
| Animation for each history-row mount | Virtualized rows remount during ordinary scrolling. |
| Terminal fades or cursor trails | Terminal bytes and cursor position have precise meaning. |
| Staggered model-list entrances | Selection needs immediate access, including after search. |
| First-connection celebration or logo entrance | Connection success needs a clear result without decorative delay. |

## Evidence and limits

I inspected the delivered source for the timing and behavior above.
The [mobile UX record](mobile-ux.md) records browser geometry and touch areas.
The [native record](native-verification.md) records redesigned runtime launches, software keyboard behavior, and remaining device limits.
Native launch success establishes library compatibility for that runtime. It does not establish every motion preference or interruption scenario.
No signed release or physical phone frame-rate measurement forms part of this record.
The current FlashList changes await their separate native runtime record.
I ran no additional tests for this documentation update.

Sources: [Emil’s opportunity skill](https://github.com/emilkowalski/skills/tree/main/skills/find-animation-opportunities), [Expo motion skill](https://github.com/emilkowalski/skills/tree/main/skills/animate-expo).


## Final contextual motion

The final message selection header uses a 120 ms opacity change without displacement.
Reduced motion shortens that change to 80 ms and narrows its opacity range.
Explicit wizard navigation uses a 180 ms cue with 12 pixels of horizontal travel.
Reduced motion uses a 100 ms opacity change with no travel.
Typing, automatic transitions, and scan mode do not trigger the directional cue.

The lead agent verified browser right-click selection and the contextual header at a 390-pixel width.
The user supplied the native gesture observation. The agent did not repeat that gesture.
[Phone selection toolbar](screenshots/selection-toolbar-phone.png)

Web sheets inherit the root safe-area provider because the modal slide transform corrupts a new local provider's initial measurement.
Native sheets retain their local provider for the native modal frame.
The earlier streaming and frame-rate evidence retains its original limits.
I ran no further tests, type checks, builds, or UI actions for this update after the user prohibited those checks.
