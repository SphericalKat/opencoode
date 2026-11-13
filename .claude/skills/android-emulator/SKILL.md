---
name: android-emulator
description: Start, use and shut down a private Android emulator for one task or agent session in this repository. Use before Android runtime verification, when an emulator is needed, or when another session already uses a device.
---

# Android emulator per task

Each task gets its own headless emulator. Every emulator is a read-only instance of one shared base AVD, `opencoode-base`. An instance never writes to the base AVD, so each boot starts from the same clean state. Instances discard the app, data and settings when they shut down.

`scripts/emulator.sh` owns the full lifecycle. It keeps its state in `/tmp/opencoode-emulators/<task>/`.

## Start an emulator

1. Choose a task name with lowercase letters, digits and hyphens, for example `issue-71`.
2. Run the start command:

   ```sh
   .claude/skills/android-emulator/scripts/emulator.sh start issue-71
   ```

3. Use the serial that the command prints, for example `emulator-5556`. Pass it to every `adb -s` and `android --device` call.

The first start creates `opencoode-base` and boots it once to save a Quickboot snapshot. That takes about 30 seconds. Later starts load the snapshot and boot in a few seconds.

If you run `start` again for a running task, the command prints the same serial and does not boot a second emulator.

## Run the app

1. Install a debug APK that matches the branch:

   ```sh
   adb -s <serial> install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

2. Start Metro on a free port, for example `pnpm exec expo start --port 8082`.
3. Point the app at that Metro port:

   ```sh
   .claude/skills/android-emulator/scripts/emulator.sh metro issue-71 8082
   ```

4. Launch the app with `adb -s <serial> shell am start -n dev.opencoode.mobile/.MainActivity`.
5. Connect the app to an isolated OpenCode server at `http://10.0.2.2:<port>`.

A debug build on an emulator loads its bundle from `10.0.2.2`, the host computer. `adb reverse` has no effect on it. The `metro` command writes `debug_http_host` into the app's dev settings and stops the app.

## Shut down the emulator

Run the stop command before the task ends, also after a failure:

```sh
.claude/skills/android-emulator/scripts/emulator.sh stop issue-71
```

The command shuts down the emulator, kills it after 30 seconds if necessary, and removes the task state.

## Inspect emulators

- To list every task emulator and its state, run `emulator.sh list`.
- To print the serial of a task, run `emulator.sh serial <task>`.
- To read the boot log, open `/tmp/opencoode-emulators/<task>/emulator.log`.

## Configuration

These environment variables change the defaults:

| Variable                   | Default                                       |
| -------------------------- | --------------------------------------------- |
| `OPENCOODE_AVD`            | `opencoode-base`                              |
| `OPENCOODE_AVD_IMAGE`      | `system-images;android-36;google_apis;x86_64` |
| `OPENCOODE_AVD_DEVICE`     | `pixel_7`                                     |
| `OPENCOODE_EMULATOR_GPU`   | `swiftshader_indirect`                        |
| `OPENCOODE_BOOT_TIMEOUT`   | `300` seconds                                 |
| `OPENCOODE_EMULATOR_STATE` | `/tmp/opencoode-emulators`                    |

If the system image is missing, `start` installs it with `sdkmanager`.

## Rules

- Do not use an emulator or device that another task started. `adb devices` lists them, but they are not yours.
- Do not start `opencoode-base` without `emulator.sh`. A writable boot changes the base for every later task.
- To change the base image or its snapshot, stop every task emulator and run `emulator.sh reset-base`.
