# Android message-bubble layout regression

This fixture mounts the production bubble and Markdown components on Android, then changes the container width and layout mode. `check.py` checks native window coordinates and requires the final rendered text to have at least 11 dp of bottom padding. The first case is rendered before any updates. This catches a native list measurement defect that did not reproduce in a web harness.

Run from a **disposable copy** of the repository; instrumentation modifies two source files. Start a dedicated Android emulator, build a release APK from the same revision, and set `ANDROID_SERIAL` to the emulator serial. The commands below reuse that APK's native runtime with the fixture's JavaScript bundle. The APK must be signed with a key accepted by the installed app; the example uses the development key. This installs and launches the app on the selected emulator.

```sh
cp tests/native-message-layout/index.tsx index.tsx
python tests/native-message-layout/instrument.py
./node_modules/.bin/expo export:embed --platform android --dev false --entry-file index.tsx --bundle-output /tmp/message-layout.bundle --assets-dest /tmp/message-layout-assets
export SOURCE_APK="$PWD/android/app/build/outputs/apk/release/app-release.apk"
python - <<'PY'
import os, zipfile
with zipfile.ZipFile(os.environ['SOURCE_APK']) as source, zipfile.ZipFile('/tmp/message-layout-unsigned.apk', 'w') as output:
    for entry in source.infolist():
        if not entry.filename.startswith('META-INF/') and entry.filename != 'assets/index.android.bundle':
            output.writestr(entry, source.read(entry.filename))
    output.write('/tmp/message-layout.bundle', 'assets/index.android.bundle')
PY
"$ANDROID_HOME/build-tools/36.0.0/zipalign" -f 4 /tmp/message-layout-unsigned.apk /tmp/message-layout-aligned.apk
"$ANDROID_HOME/build-tools/36.0.0/apksigner" sign --ks android/app/debug.keystore --ks-pass pass:android --key-pass pass:android --out /tmp/message-layout.apk /tmp/message-layout-aligned.apk
adb install -r /tmp/message-layout.apk
adb logcat -c
adb shell am force-stop dev.opencoode.mobile
adb shell am start -n dev.opencoode.mobile/.MainActivity
sleep 13
adb logcat -d -s ReactNativeJS:I > /tmp/message-layout.log
python tests/native-message-layout/check.py /tmp/message-layout.log
```

The fixture checks the transcribed three-item message at 320, 360, and 393 dp in both layout modes. Before the fix, the first case measured a bubble bottom of 281 dp and text bottom of 577 dp. After the fix, all six cases measured 12 dp bottom padding. This fixture does not automate list recycling, scrolling, or attachments; those need separate native verification.
