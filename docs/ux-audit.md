# Mobile UX audit

I used the full review mode from Make Interfaces Feel Better.
I used realistic edge values from Break UI through an isolated OpenCode server.
I did not add mock data or a demo switch to the product.

## Scope

I inspected the React Native Web preview at 360 × 640, 390 × 844, and 1024 × 768.
The app uses React Native StyleSheet, OC-2 colors, Inter, and IBM Plex Mono.
I preserved that styling system throughout this review.

I created three temporary sessions through the real API.
Their titles covered a long task, Japanese with a long personal name, and one character.
I also entered a realistic long workstation name in the audit tab's connection profile.

The browser preview does not establish native keyboard, VoiceOver, or TalkBack behavior.
The native verification record covers the separate device checks.

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | Session titles, remote paths, model catalog, connection fields, and both responsive layouts | Long titles consume too much chat space. Long server names truncate correctly. |
| Surfaces | Connection screen, session cards, chat, settings, modal sheets, and touch geometry | Two global navigation targets are too short. Several headers repeat context. |
| Animations | Native modal transitions and ordinary state changes | No custom motion change proposed. Slow-motion native transitions remain unverified. |
| Icons | OpenCode logo, bottom navigation icons, status dots, and action menus | Icon family remains consistent. Selected navigation lacks a web accessibility state. |
| Performance | FlatList sessions, bounded account catalog, model picker, and live list updates | Catalog bounds hold. The model picker remains visually dense. No frame profile ran. |

## Findings before improvement

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `App.tsx` server and project controls | The server target measures 164 × 21 px. The project target measures 360 × 40 px. | Give each target at least 44 px of height. Preserve a distinct target for each control. | Frequent navigation needs reliable touch targets. |
| HIGH | `App.tsx` chat navigation and `ChatScreen.tsx` header | A realistic long title wraps across four lines. Headers consume 294 px at 360 × 640. | Merge Back into the title row. Clamp the title to two lines. Retain the full title in session actions. | The transcript receives only about 113 px before the keyboard appears. |
| MEDIUM | `SessionsScreen.tsx` header | The screen repeats the full remote directory below the global directory control. | Keep the directory in the global control. Place Live or Reconnecting beside the session heading. | The repeated path consumes 42 px on a small phone and three lines in the tablet sidebar. |
| MEDIUM | `SettingsScreen.tsx` section navigation | Nine sections sit in one horizontal strip without an overflow cue. A phone shows only the first five. | Use a labeled section picker on phones. Show all sections in a vertical sheet with short descriptions. | Appearance, Permissions, and Advanced require an undisclosed sideways gesture. |
| MEDIUM | `ChatScreen.tsx` model picker | Each model occupies about 165–200 px. Every variant appears beside a repeated Use model action. | Use compact selectable rows. Offer variants after model selection through a separate control. | A phone displays only two models at once. Repeated actions slow comparison. |
| MEDIUM | `ChatScreen.tsx` model search | A search without matches leaves a blank sheet below the field, although models exist. | Show No matching models and a Clear search action. | The user needs a distinct empty result and a direct recovery action. |
| MEDIUM | `App.tsx` bottom navigation | All three rendered tabs have no `aria-selected` value. | Add an explicit selected accessibility state that survives the web adapter. | A screen reader cannot identify the current section from the rendered tab state. |
| MEDIUM | `App.tsx` connection errors | A wrong password displays Authentication required in the sheet and above the healthy prior connection. | Separate connection-form errors from active-workspace errors. Explain that the password was rejected. | The error gives no clear repair action and appears to condemn the working server. |
| MEDIUM | `SessionsScreen.tsx` New session flow | New session opens a full sheet, although every input is optional. A second tap creates the session. | Create a blank session directly. Keep manual naming as an optional action. | The primary start-and-send flow contains an avoidable gate. |

The small chat screenshot appears at [ux-chat-small-before.png](screenshots/ux-chat-small-before.png).
The measurements above describe the original review state.
Later improvements require a separate verification entry below.

## What held up

- I verified that long workstation names truncate without pushing the version outside the header.
- I verified that Japanese text and diacritics remain readable in session cards.
- I verified that the session action menu remains reachable beside long titles.
- I measured 44 px shared buttons and 51 px bottom navigation targets.
- I verified that session changes from the real server appear without manual refresh.
- I verified that the tablet split layout preserves a visible session list and conversation.
- I verified that account catalogs expose Load more instead of rendering every provider immediately.
- I verified that a failed connection attempt preserves the previous valid connection.

## Considered but rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| Conversation | Stagger each new message | Frequent motion competes with reading and adds work during a stream. |
| Session cards | Add large shadows | The OpenCode theme uses neutral surfaces and structural borders. |
| Dense headers | Reduce button targets | Smaller targets recover space at the expense of reliable taps. |
| Tablet navigation | Replace the bottom bar with a navigation rail immediately | The current split layout remains usable. The phone failures have higher priority. |

## Verification boundary

I used Computer Use to connect, edit a profile, open sessions, open model selection, and traverse Settings.
I inspected screenshots at all three sizes.
I measured visible controls through their rendered DOM rectangles.
I read the rendered tab accessibility attributes.
I tested an invalid local server password and restored the valid audit connection afterward.

I did not run an automated appearance test.
I did not test a native soft keyboard, dynamic text at 200%, VoiceOver, or TalkBack during this browser pass.
The native terminal input defect remains with the separate terminal owner.

## Iteration record

The parent agent accepted the findings and assigned implementation across the existing screen owners.
The design lead supplied the current OpenCode Console material and navigation brief.
I replaced the phone Settings strip with a grouped index and detail pages.
I retained every section and the guard for unsaved configuration.
I added a 220 px section column for tablets.
I coordinated the native Back state with the root navigation handler.

| Original check | Observed result after improvement | Result |
| --- | --- | --- |
| Small global targets | I measured 44 × 44 px navigation, session actions, message tools, and Send controls at 360 × 640. | Pass in browser |
| Restricted chat space | I measured a 446 px transcript viewport below the 56 px header, versus about 113 px before. | Pass in browser |
| Repeated directory context | I verified that the drawer shows the project once. The conversation header shows its short project name. | Pass in browser |
| Hidden Settings sections | I opened Appearance and Advanced from the vertical index without a sideways gesture. Every index row measures 68 px. | Pass in browser |
| Dense model cards | I measured 66 px model rows, compared with the previous 165–200 px cards. | Pass in browser |
| Empty model search | I entered the original search. The sheet showed No models match and a working Clear search control. | Pass in browser |
| Missing selected state | I read Sessions as `aria-selected=true` and the other destinations as `false`. | Pass in browser |
| Misplaced connection error | I repeated the invalid password check. The repair message stayed in the server sheet and disappeared after dismissal. | Pass in browser |
| Gated session creation | I selected New session once. The app opened a blank conversation without the optional naming sheet. | Pass in browser |

I verified Settings at 360 × 640, 390 × 844, and 1024 × 768.
I changed light appearance to dark and returned to the index.
I opened Advanced and observed the explicit older-server notice.
I resized an Appearance detail from tablet to phone and returned to the index with Back to Settings.
The selected tablet section exposed `aria-current=page`.

I ran `npm run typecheck` after the Settings changes. It passed.
I did not add appearance tests or source-shape tests.
I removed all four audit sessions after verification and closed the separate preview tab.
I left the parent and native test sessions intact.

The screenshots record these results:

- [Small conversation after improvement](screenshots/ux-chat-small-after.png)
- [Phone Settings after improvement](screenshots/ux-settings-phone-after.png)
- [Tablet Settings after improvement](screenshots/ux-settings-tablet-after.png)
- [Model picker after improvement](screenshots/ux-model-picker-after.png)

Verdict before improvement: **Block** for the small global targets and the restricted chat reading area.
Verdict after improvement: **Approve** for the inspected browser flows and sizes.
Native Back, native keyboard behavior, text scaling, VoiceOver, and TalkBack remain outside this browser verification.
