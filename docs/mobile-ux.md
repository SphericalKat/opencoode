# Mobile UX evaluation

Initial evaluation: October 29, 2026. Source follow-up: October 30, 2026.

Review mode: full.
This review covers the React Native interface, its shared controls, and its browser layout at phone and tablet sizes.
The OpenCode OC-2 colors, fonts, icons, and visual hierarchy remain the design baseline.
The evaluation uses actual sessions from the isolated OpenCode server.
It adds no demonstration data or test toggle to the product.

## Selected guidance

Apple recommends comfortable controls, larger text support, and cues beyond color.
Its default iOS target is 44 by 44 points.
[Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility)

Android recommends a 48 by 48 dp touch target and meaningful descriptions for controls.
Its accessibility guidance specifies contrast targets for text.
[Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps)

Primary navigation represents stable destinations.
The revised interface places Sessions, Workspace, and Settings in a drawer on phones and a sidebar on wider windows.
That arrangement keeps the conversation visible and preserves the same destinations.
[Apple tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars), [Android navigation patterns](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns)

Adaptive interfaces change their content arrangement as window size changes.
They preserve state across those changes and support external input.
The app already uses a list and detail pane on wider windows.
[Android adaptive guidance](https://developer.android.com/develop/ui/compose/layouts/adaptive/get-started-with-adaptive-apps)

Text fields need persistent purpose, clear focus, logical focus order, and a keyboard that matches their input.
[Apple text fields](https://developer.apple.com/design/human-interface-guidelines/text-fields)

## Skill selection

| Skill | Decision | Reason |
| --- | --- | --- |
| `react-native-design` | Apply native layout and state guidance. | Safe areas, virtual lists, keyboard behavior, and platform controls match this app. |
| `make-interfaces-feel-better` | Apply its review method in StyleSheet. | Touch areas, typography, feedback, and restrained motion fit the existing visual system. |
| `break-ui` | Use real boundary cases without its mock toggle. | The isolated server supplies realistic long titles and non-Latin text through the actual API. |
| `apple-design` | Retain its predictability and feedback principles. | Its web spring and pointer recipes do not fit this native implementation. |

The later motion pass uses the existing native animation stack.
Shared buttons animate only their content, while their touch areas stay fixed.
Reduced motion replaces displacement with opacity feedback.
Disclosures and text input retain immediate feedback.

## Evaluation loop

1. Select one frequent task and one difficult input.
2. Open the actual app at the smallest supported window.
3. Record the visible result, control sizes, and available work area.
4. Change the smallest shared rule that removes the problem.
5. Repeat the same task and record the result.
6. Repeat at the normal phone size and the tablet size.

## Device and state matrix

| Window or state | Purpose | Evidence boundary |
| --- | --- | --- |
| 360 by 640 | Check short phones and narrow windows. | Final browser review covers dark chat, drawer, model search, and grouped Settings. |
| 390 by 844 | Check a normal phone. | Final browser review covers actual tool messages and pending inputs. |
| 1024 by 768 | Check the list and detail arrangement. | Final browser review confirms the sidebar and conversation share one window. |
| Native keyboard open | Check visible input and reachable actions. | Android docked Gboard kept the composer and Send button visible after the keyboard fix. |
| External keyboard | Check literal terminal input. | Native ordinary input passed on iOS and Android. Android buffered input also passed for persistent terminals. |
| Large system text | Check wrapping and work area. | Native Dynamic Type and Android font-scale checks remain unverified. |
| Light and dark | Check text, errors, focus, and selection. | Browser review covers both themes. The final screenshot set uses dark mode. |
| Disconnect and resume | Check continuity and recovery. | API and native records cover reconnect behavior separately. |

## Baseline measurements

These measurements come from the actual browser layout at 360 by 640 logical pixels.
They do not establish native keyboard behavior.

| Control or region | Baseline | Consequence |
| --- | --- | --- |
| Switch server | 164 by 21 | The target is too short for comfortable touch. |
| Switch project | 360 by 40 | The target misses both platform defaults. |
| Attach files | 37 by 44 | The visible button is narrower than its touch target needs. |
| Mention | 37 by 44 | The visible button is narrower than its touch target needs. |
| Commands | 29 by 44 | The smallest composer control is hard to select. |
| Long-title chat header | Ends at y=294 | Repeated context and a four-line title consume the work area. |
| Long-title transcript | y=294 to y=407 | Only 113 pixels remain before the composer. |
| Session list | Starts at y=357 | About 218 pixels remain before the bottom tabs. |

The long title describes a realistic payment reconciliation task with 120 characters.
The list also contains a one-letter title and a title with Japanese, Polish, and punctuation.
Those sessions entered through the actual server API.

Baseline screenshots:

- [Small phone conversation](screenshots/ux-before-small-chat.png)

## Initial changes and repeated checks

I increased shared button targets to 44 points on iOS and 48 dp on Android.
I expanded each disclosure target to its full header.
I added native safe areas and keyboard avoidance to sheets.
I added a bounded sheet body for virtual model lists and the file editor.
I preserved OpenCode fonts and applied its raised controls and recessed fields.

The other screen owners consolidated the conversation header, drawer, session controls, settings list, and file editor.
The design lead reviewed the actual dark screenshots and accepted the hierarchy and materials.

| Region or action | October 29 browser evidence | Result |
| --- | --- | --- |
| Chat at 360 by 640 | Header ends at y=56. Composer starts near y=505. | About 449 pixels remain for messages, versus 113 pixels before. |
| Long session title | One visible line with the full accessibility label. | The title cannot consume four lines of work area. |
| Chat actions | Menu, session actions, message tools, and send targets measure 44 by 44. | Their actual targets meet the web/iOS layout default. |
| Model selector | The main trigger measures at least 222 by 44. | An outer-edge tap opens the sheet. |
| Model sheet | Radio rows measure 321 by 66 at 360 pixels. Done measures 56 by 44. | Search and the list share a bounded body. An outer-edge tap closes the sheet. |
| Model search | An unknown query exposes No models match and Clear search. | Clear search restores the catalog. |
| Tool disclosure | A wrapped shell header measures 311 by 70. | A tap two pixels from the outer corner collapses its actual output. |
| Settings | A grouped list exposes Appearance first and includes all nine destinations. | The hidden horizontal category strip is gone. |
| Drawer | The server, project, session list, and three destinations fit one phone panel. | Context remains available outside the conversation. |
| Tablet | The sidebar stays visible beside the conversation. | No redundant conversation back row consumes the main pane. |

October 29 screenshots:

- [Small phone conversation in dark mode](screenshots/ux-after-small-chat.png)
- [Small phone drawer in dark mode](screenshots/ux-after-small-drawer.png)
- [Regular phone with actual tool messages](screenshots/ux-after-phone-tool.png)
- [Tablet conversation and sidebar](screenshots/ux-after-tablet-chat.png)

## Streaming and message controls follow-up

I read the frozen source after the streaming and message-control changes on October 30.
I did not repeat browser or device actions for this documentation update.

The transcript now uses FlashList 2.3.2 with a bottom anchor.
It follows new output until the user scrolls upward or starts a drag.
Jump to latest restores the live end without a smooth-scroll animation.
The lead agent observed a real response of about 450 words with a zero-pixel gap at the transcript end.
The lead agent also observed that an upward wheel movement paused bottom-follow and exposed Jump to latest.

The source coalesces streaming updates by animation frame and limits unrelated snapshot requests.
Stable message rows, assistant parts, and Markdown blocks avoid repeated work for unchanged content.
These source optimizations do not establish a measured frame rate.
The [motion record](motion-audit.md) describes the update path and its remaining performance boundary.

The message menu now appears below each user bubble and assistant response.
The user menu aligns right. The assistant menu aligns left.
The menu no longer occupies a separate column beside the message content.

Shared button faces have a minimum height of 36 points, or 32 points for compact controls.
Their surrounding touch frames retain minimum dimensions of 44 points on iOS and 48 dp on Android.
Chat action faces follow the same 36/32 sizing within fixed platform touch frames.
The earlier screenshots and measurements precede these visual-face and message-menu changes.

## Remaining boundaries

| Priority | Area | Current limit |
| --- | --- | --- |
| High | Remaining native keyboard and sheet states | Android Gboard composition and Project/Server sheet dismissal passed. The native record states the remaining iOS and picker coverage. |
| Medium | Large system text | Native Dynamic Type and Android font-scale remain unverified in this review. |
| Medium | Empty model catalog | The sheet offers Refresh models and Open navigation. Account connection still requires a separate Settings selection. |
| Medium | Recovery and persistence | API terminal recovery and iOS credential restoration passed. The records do not prove every draft or background lifecycle scenario. |
| Medium | Current streaming performance | Browser bottom-follow and scroll intent passed. Native FlashList behavior and release frame rate need their own evidence. |

## Coverage accounting

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | Shared font tokens, long titles, non-Latin titles, code text, and phone screenshots. | Title growth is bounded. Large native text remains unverified. |
| Surfaces | OpenCode controls, cards, separators, error notices, header geometry, and modal source. | Tactile neutral materials and larger targets pass the browser review. |
| Animation | Shared press content, reduced motion support, activity indicator, drawer, and native modal declarations. | The motion record describes implemented timing. Native runtime evidence remains separate from browser layout evidence. |
| Icons | Official navigation paths and measured composer controls. | Shared controls and compact chat actions expose full touch areas. |
| Performance | FlashList transcript, frame-coalesced updates, scoped refreshes, memoized content, bounded catalogs, and conditional terminal mount. | Source review establishes these changes. It does not establish measured frame-rate improvement. |

## Considered and rejected

| Candidate | Reason |
| --- | --- |
| Add decorative springs to each chat response. | Repeated motion distracts from reading and adds work during streaming. |
| Replace OpenCode controls with a new component library. | The existing tokens and native primitives can address the measured issues. |
| Reduce touch targets to recover transcript space. | Smaller visual faces retain full touch frames. Redundant chrome can disappear without reduced touch accuracy. |
| Hide difficult data in the product. | Real titles and paths need clear truncation, with their full value available in a detail view. |

## Verification status

I repeated the measured phone tasks after implementation.
I checked the final drawer, long-title chat, model search recovery, sheet close action, and real shell disclosure.
I checked the regular phone and tablet arrangements with actual server content.
I added no appearance tests or dependencies for this pass.

October 29 browser verdict: **Pass with the remaining boundaries above**.
The October 30 follow-up records source changes and the lead agent’s narrower browser observations.
The [native record](native-verification.md) covers secure restoration, native sessions, files, terminal input, and exact remaining device limits.
The [motion record](motion-audit.md) distinguishes delivered effects from the initial proposal.


## Final connection and selection pass

I reviewed the final connection, message selection, and motion source on October 30.
The connection flow offers a native camera scan from one action, with permission and unavailable-camera recovery.
It accepts the official JSON payload with a code and multiple server URLs.
It retains a redeemed token in memory for five minutes for a retry.
Saved profiles preserve the existing workspace and avoid duplicate server entries.
These source paths do not establish a physical camera scan result.

The lead agent entered fresh SDK `server.pair` JSON in the wizard address field and observed a successful connection.
The existing Local development workspace remained selected.
This record contains no pairing codes, tokens, or server credentials.

A long press now selects a message and replaces the normal top bar with contextual actions.
This replaces the earlier persistent menus below messages.
The lead agent verified browser right-click selection and the contextual header at a 390-pixel width.
Native gesture evidence came from the user, rather than an automated agent action.
[Phone selection toolbar](screenshots/selection-toolbar-phone.png)

The selection header fades over 120 ms, or 80 ms with reduced motion.
Explicit wizard navigation uses a 180 ms directional cue, or a 100 ms fade with reduced motion.
Typing, automatic connection changes, and scan mode do not receive that directional cue.

The lead agent diagnosed a browser sheet failure after the local safe-area provider measured the slide transform as a full-window inset.
I made web sheets inherit the root provider and retained modal-local providers on native platforms.
This preserves the native status-bar repair without a second web inset measurement inside the slide transition.

The earlier streaming evidence remains valid within its stated scope.
I ran no tests, type checks, builds, or UI actions for this documentation update after the user prohibited those checks.

## Automatic connection recovery

I added foreground server checks with a five-second deadline and a second check after an ordinary network failure.
I added immediate recovery for a rejected server login.
I bounded connection setup and location resolution to fifteen seconds each.

I kept the active workspace mounted during recovery.
I preserved its screen instances, selected session, attachments, and current tab after reconnection to the same server and directory.
I retained the unsaved-change confirmation for a different workspace.

I delayed the wizard while a native panel remains open, because a hidden native modal can unmount its child form.
I added a notice that asks the user to close that panel through its normal controls.
I kept its existing close guards and local values until that explicit close.
I opened recovery after the last panel and the navigation drawer finish dismissal.
I deferred queued picker handoffs until the recovery wizard closes.

This section records source behavior.
It does not establish native lifecycle, camera, or offline draft validation.
