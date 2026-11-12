# Android message-bubble layout regression

This fixture mounts the production bubble and Markdown components in a FlashList on Android. For each width and layout mode, it measures the initial message, appends a message, then scrolls away and back. The disposable instrumentation requests fresh native window coordinates for the bubble and every Markdown text node. `check.py` requires at least 11 dp of padding on all sides, checks the following row does not overlap, and verifies the scroll offset changed. It also measures a short message and an attachment-sized child.

Run from a **disposable copy** of the repository; instrumentation modifies two source files. Start a dedicated Android emulator, build a release APK from the same revision, and set `ANDROID_SERIAL` to the emulator serial. The commands below reuse that APK's native runtime with the fixture's JavaScript bundle. The APK must be signed with a key accepted by the installed app; the example uses the development key. This installs and launches the app on the selected emulator.

```sh
python tests/native-message-layout/instrument.py
./node_modules/.bin/expo export:embed --platform android --dev false --entry-file tests/native-message-layout/index.tsx --bundle-output /tmp/message-layout.bundle --assets-dest /tmp/message-layout-assets
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
adb install --no-incremental -r /tmp/message-layout.apk
adb logcat -c
adb shell am force-stop dev.opencoode.mobile
adb shell am start -n dev.opencoode.mobile/.MainActivity
sleep 65
adb logcat -d -s ReactNativeJS:I > /tmp/message-layout.log
python tests/native-message-layout/check.py /tmp/message-layout.log
```

The transcribed three-item message is checked at 320, 360, and 393 dp in both layout modes. The attachment case exercises the production bubble’s attachment sizing with a representative child, rather than loading an image. Run `python -m unittest discover -s tests/native-message-layout -p "test_*.py"` to check that the log validator rejects missing or overflowing measurements, overlap, and a missing scroll.
