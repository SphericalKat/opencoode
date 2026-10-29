# Native verification

## Environment

I used Expo SDK 58, React Native 0.88.1, and the existing Metro server on port 8081.
I ran one mobile simulator at a time.
I did not compile a native development build.

## iOS simulator resources

I used the existing iPhone 17 Pro simulator with iOS 26.3.
I applied `scripts/simslim-dev.json` with `simslim on --no-reboot`.
The profile preserves document search, Keychain, web services, photos, the App Store, and device sharing.
I stopped 102 unrelated background services.

Before the change, SimSlim measured 236 processes and 4.26 GB of memory.
After the change, SimSlim measured 128 processes and 2.16 GB of memory.
The measurement used `phys_footprint` and represents one local observation.
SimSlim verified the profile without drift.
Its doctor passed the file picker, Keychain, universal link, photo, and App Store checks.

## Runtime installation

I downloaded both runtimes with the official downloader in the installed Expo CLI.
I installed Expo Go 58.0.7 on the iOS simulator.
The iOS archive contains 155.7 MB and expands to 442 MB.
I downloaded the 226 MB Expo Go 58.0.5 APK for Android.

## iOS checks

I confirmed that Metro returned the iOS development bundle with HTTP 200.
The first launch exposed a `jsonc-parser` UMD module resolution error.
After the ESM import fix, I launched the connection screen without a runtime error.
I connected through the native form to an isolated OpenCode 2.1.4 server.
I confirmed that SecureStore restored the connection and selected session after a full JavaScript reload.

I created a session through the native interface.
I changed its title through a separate server client and observed the live update on the simulator.
I ran a shell command through chat and opened its output.
I edited a temporary file and confirmed the exact change on the server disk.
I opened the native document picker, browsed its local location, and canceled it.

I connected the native xterm WebView to an ordinary remote shell.
I typed a command with the hardware keyboard and observed its exact output.
I reopened the terminal and observed its retained output.
I saved the terminal screenshot at `/tmp/opencoode-ios-terminal.png`.

## Android resources

The existing API 37 image required 4096 MB and selected software graphics under memory pressure.
I stopped it before the app check.
I created the separate `Opencoode_API36` AVD from an installed image.
I used a 720 × 1280 display, two CPU cores, host graphics, and no audio or cameras.
The emulator enforced a 2560 MB memory allocation.

I registered a temporary macOS launcher at `/tmp/Opencoode Android Emulator.app` for Computer Use.
The emulator executable alone was absent from its app inventory.
I installed Expo Go 58.0.5 and used the existing Metro server through an ADB port reverse.
I did not run a second simulator or Metro server.

## Android checks

I launched the app without a JavaScript or Android runtime error.
I connected through the native interface to the isolated server through `10.0.2.2`.
I created a session and observed a title update from a separate server client.
I ran a chat shell command and observed its output in the native transcript.
I opened Settings and changed the theme from the system light theme to dark.
I edited the temporary file through the native text input and confirmed the save on the server disk.
I moved the native session to another server directory through its action sheet.
I confirmed the new directory through the server API and the app project bar.

I connected the native WebView terminal and observed existing server output.
After the source freeze, I created a fresh ordinary shell and typed `echo android`.
The terminal sent `echoandroidd` and the shell rejected the command.
The failure did not affect the native text inputs for chat, authentication, or file edits.
I inspected Gboard and confirmed that physical keyboard corrections were enabled by default.
I did not change those keyboard settings.

I selected the Android session and created a persistent desktop terminal.
The real server listed the terminal and the native view restored its prompt.
The observer mode disabled shortcuts.
The Take control button enabled them and changed the status to In control.

After the native text input fix, I repeated the checks in a fresh ordinary shell.
I sent the exact command `echo android` and observed the exact output `android`.
I sent `echo staged` without a carriage return and confirmed that it waited.
I tapped Enter and observed the exact output `staged`.
I used ASCII escapes with `printf` and confirmed the Unicode output `é😀`.

I opened the persistent terminal in full-screen observer mode.
I confirmed that its native text input and shortcuts stayed disabled.
I tapped Take control, sent `echo persistent`, and observed the exact output `persistent`.
The full-screen terminal displayed 43 or 44 columns and 24 rows on the small emulator.
I saved screenshots at `/tmp/opencoode-android-terminal.png` and `/tmp/opencoode-android-persistent-terminal.png`.

## Remaining device boundaries

I used the emulator hardware keyboard with Gboard and its default correction settings.
I did not verify the on-screen keyboard geometry during the initial round.
The Computer Use injector dropped literal Unicode characters in the Android emulator.
I verified Unicode output through ASCII escape sequences instead.
I did not compile or install a standalone signed app or test a physical phone.

At the end of this round, I shut down the Android guest and its launcher process.
I confirmed that ADB listed no device and no iOS simulator was booted.

## Redesign and Android software keyboard

I reopened only the Android emulator with its hardware keyboard disabled.
I launched the redesigned app with Reanimated and Worklets without a runtime error.
I exposed the docked Gboard keyboard and observed that it covered the composer and Send button.

After the keyboard controller change, I reopened the app and focused its composer.
I confirmed that the composer and Send button stayed above the docked keyboard.
I entered `draft` through Gboard keys and observed the enabled Send button.
I dismissed the keyboard and confirmed that the draft remained.
I saved the screenshot at `/tmp/opencoode-android-keyboard-fixed.png`.

I opened the Project and Server sheets from the drawer and dismissed both with Done.
I opened Attach from device and observed the native document picker.
I stopped before its cancel check after the request to switch to iOS.
I shut down the Android guest and launcher before the iOS boot.
I confirmed that ADB listed no device and no QEMU process remained.

## Redesign and iOS software keyboard

I booted only the existing iPhone 17 Pro after the Android shutdown.
I applied the SimSlim profile and opened the redesigned app without a runtime error.
I enabled its software keyboard and entered `draft` through the visible key buttons.
I confirmed that the full composer and enabled Send button stayed above the docked keyboard.
I dismissed the keyboard and confirmed that the draft remained.
I saved the screenshot at `/tmp/opencoode-ios-keyboard-fixed.png`.

I observed that the drawer logo overlapped the status bar before the modal provider repair.
After the repair, I reopened the drawer and confirmed that its header stayed below the Dynamic Island.
I saved the drawer screenshot at `/tmp/opencoode-ios-drawer.png`.
I opened the Project and Server sheets from the drawer.
I focused the lower server-name field and confirmed that the software keyboard did not cover it.
I dismissed the Server sheet with Done while the keyboard was visible.
I opened Appearance and returned to the Settings index with Back to Settings.

I observed that the first attachment attempt dismissed its sheet without a visible native picker.
The second attempt reported `Different document picking in progress. Await other document picking first`.
I reported the native modal transition failure before the repair.
I also reported that the latest transcript paragraph disappeared below the composer when the keyboard opened from the bottom.

After the attachment transition repair, I terminated and reopened Expo Go.
I opened Attach from device and observed the native Files picker.
I canceled the picker and returned to Chat without an error.
I opened Import session JSON and canceled its native picker without an error.

After the bottom-follow repair, I scrolled to the latest assistant paragraph and opened the software keyboard.
I confirmed that its final sentence remained visible above the composer.
I saved `docs/screenshots/ios-final-chat-keyboard.png`.
I did not repeat the older-message scroll check after this repair.

I opened the remote file editor and focused its multiline input.
I confirmed that the software keyboard left Save file and Done reachable.
I saved a verification line and confirmed its exact text on the server disk.
I saved `docs/screenshots/ios-final-editor-keyboard.png`.

I opened an ordinary shell in full screen and tapped the software keys for `echo ios`.
I tapped Return and observed the exact output `ios`.
I confirmed that the terminal resized from 49 columns and 35 rows to 49 columns and 15 rows.
I confirmed that its shortcuts and useful output remained above the docked keyboard.

I created a persistent terminal for the iOS verification session.
I opened its full-screen observer and confirmed that the shortcuts stayed disabled.
I tapped `x` and Return through the software keyboard and confirmed that the server prompt stayed unchanged.
I tapped Take control, entered `echo ios`, and observed the exact output `ios`.
I closed full screen and confirmed that its observer guard returned.
I saved `docs/screenshots/ios-final-terminal-keyboard.png`.

I opened Model from Session actions and observed the model list.
I tapped Done and returned to Chat.
I opened Session statistics from Session actions and observed the session totals and status.
I tapped Done and returned to Chat.

I ran no automated tests, type checks, or doctor checks during this final round.
I did not repeat the final software keyboard flows on Android after the iOS modal repairs.
I shut down the iOS guest and closed Simulator after the final round.
I confirmed that no iOS device was booted, ADB listed no device, and no emulator GUI process remained.

## Native transcript performance observation

I reopened only the iOS simulator with the committed SimSlim profile after the transcript performance changes.
I opened the existing `Mobile coding assistant guide` session without a runtime error.
I observed that its initial transcript position showed the final paragraph.
I confirmed that its message actions appeared below the message.

I enabled the built-in Expo performance monitor without an additional profiler.
I observed 60 UI fps and 60 JS fps at rest before the second response.
I received the shared live response from the real OpenCode server.
I observed that the transcript followed the final paragraph of that response.
I sampled 56 UI fps and 58 JS fps near response arrival.
I later sampled 60 UI fps and 60 JS fps, with approximately 377 MB of app memory.
I saved `docs/screenshots/ios-transcript-performance-monitor.png`.
I did not compare these samples with the old implementation or measure a release build on physical hardware.

I could not confirm scroll-away during the response because it completed before that interaction.
I observed no position change from several injected transcript scroll gestures.
I observed the same result on the separate Settings ScrollView.
I did not classify that input limitation as a transcript defect.

Computer Use later reported external interaction with Simulator.
I observed an older transcript position with the Jump to latest button visible after that external interaction.
I stopped native control and left the single iOS simulator open for manual use.
I did not confirm Jump to latest or repeat the software keyboard check after the transcript performance changes.
I ran no automated tests, type checks, builds, or doctor checks in this round.
