# Interface font increment verification

Issue #41 increases effective interface base font sizes by one React Native unit in regular and beta layouts. Local overrides increase alongside shared controls, including Markdown headings/code/tables and workspace editors/diffs. Four standalone native `Text` views that previously used the default size 14 now specify 15. PiWorkspace inherits the updated conversation, Settings, and navigation components.

Line heights increase by one where specified. Composer minimum-height calculations follow the new regular/beta line heights (25/23) and retain native font-scale-aware geometry. The two project-letter badges use minimum dimensions so their text can grow. Native text scaling remains enabled without new caps or manual multiplication of font sizes. Embedded terminal renderer sizes and assets, and the workspace file-icon glyph size, are unchanged.

## Native red/green checks

Validation used the isolated Android AVD `opencoode-41-validation`, serial `emulator-5554`, at density 3. The physical phone and the other session's emulator were not used. The temporary fixture in `/tmp/opencoode-41-native` imports production TSX components and supplies screen data through their client/backend props. It is not a product route or configuration option.

The first check compares shared `Label` glyph metrics from its public `onTextLayout` callback with an independent native `Text` reference using Inter at the required size 15. Both use the same system font scale.

| Check at font scale 1.0 | Before | After | Expected |
| --- | --- | --- | --- |
| Shared label cap height, dp | 10.283334 | 11.016666 | 11.016666 |
| Session title row height, px | 60 | 63 | 63 (21 dp at density 3) |

The label comparison failed before the shared-control change and passed afterward. At system font scale 1.5, the label and independent reference both measured 16.646666 dp, and the comparison passed again. Native scaling therefore increased the actual rendered glyphs while the reference still matched, without applying the scale twice.

The session-title check used the actual `SessionsScreen` and Android's layout tree; it failed before its local style increment and passed afterward. This catches local overrides that a shared-control-only change would miss.

Commands used to prepare and inspect the native fixture:

```sh
node node_modules/expo/bin/cli export:embed --platform android \
  --entry-file index.tsx --bundle-output index.android.bundle \
  --dev false --max-workers 2
android run --device emulator-5554 --apks /tmp/opencoode-41-native/fixture.apk \
  --activity dev.opencoode.mobile.MainActivity
android layout --device emulator-5554 --full --output /tmp/opencoode-41-native/sessions-green-layout.json
android screen capture --device emulator-5554 --output /tmp/opencoode-41-native/sessions-green.png
adb -s emulator-5554 logcat -d -s ReactNativeJS:I
```

The fixture bundle was inserted into an existing release APK shell, aligned, and signed with the project's development key. Fixture fonts were copied to the isolated emulator because the release shell's compiled resource IDs differ from those in a freshly generated JavaScript fixture. This validates the changed native components, not a newly built release APK.

## Existing checks and coverage

`pnpm typecheck` and `git diff --check` pass. `pnpm test` reports the same 31 passing and four failing tests as the untouched baseline:

- `chat displays text and reasoning deltas with independent fragment ordinals`
- `pairing redeems the code as JSON and authenticates the next request under a server path prefix`
- `connection recovery distinguishes rejected passwords, expired links, and incompatible server responses`
- `connection recovery provides safe network and timeout guidance`

No new unit tests mirror style declarations.

Source review compared all explicit `fontSize` declarations in app/src TSX against the baseline, including conditional Markdown body sizes and every heading size. Terminal implementations/generated assets have no diff. No scaling override was added.

## Native visual coverage

[PR screenshots](https://github.com/SphericalKat/opencoode/pull/48#issuecomment-6828884846) show the session-list comparison and beta chat at font scales 1.0 and 1.5. The session “before” image was captured after the shared-control slice, with session-specific styles still unchanged; it is not a screenshot of the entirely untouched app. Its live-update notice came from incomplete fixture data, which was corrected for subsequent captures.

| Surface | System font scales inspected | Observed result |
| --- | --- | --- |
| Shared controls and Markdown | 1.0, 1.5 | Labels match the independent native reference; prose, headings, code, input, and buttons render without clipping. |
| Chat, regular and beta | 1.0, 1.5 | Prose, list markers, code, metadata, and composer remain readable. |
| Session list | Regular 1.0; beta 1.0, 1.5 | Titles, metadata, search, and project-letter badges fit; long titles retain intended ellipsis. |
| Settings index | Regular 1.0, 1.5; beta 1.5 | Heading and Appearance row remain readable and reachable. |
| Workspace file list | 1.0, 1.5 | Search, file names, and actions remain visible. At 1.5, tab labels wrap within their controls. |
| Composer with Gboard open | Regular and beta 1.5 | Two entered lines and the Send control remain visible above the keyboard. |

The large-text checks used `adb -s emulator-5554 shell settings put system font_scale 1.5`, followed by an app restart. The isolated emulator was returned to font scale 1.0 afterward. Screen navigation and keyboard input used bounds from `android layout`; screenshots were captured with `android screen capture` and visually inspected. The additional original captures remain in `/tmp/opencoode-41-native`, including `composer-large-keyboard.png` and `composer-beta-large-keyboard.png`.

The fixtures initially omitted model variants and used the wrong project-list/file-read response shapes. Those fixture errors were corrected before the final chat and beta-session checks; they did not require production changes. An emulator process interruption required relaunching the isolated AVD during validation.

## Limits

The Android emulator checks cover representative screens with fixture data, not every Settings section, editor/diff interaction, terminal workflow, window size, or live server lifecycle. Workspace editor/diff typography and embedded-terminal exclusion were verified in source. iOS Dynamic Type and physical-device validation remain unavailable. No new release build, performance measurement, or exhaustive accessibility audit was performed.
