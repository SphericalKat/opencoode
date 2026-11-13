#!/usr/bin/env bash
# Per-task Android emulators. Every task gets its own read-only instance of
# one shared base AVD, so tasks never write to each other's disks or ports.
set -euo pipefail

sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
state_root="${OPENCOODE_EMULATOR_STATE:-/tmp/opencoode-emulators}"
base_avd="${OPENCOODE_AVD:-opencoode-base}"
image="${OPENCOODE_AVD_IMAGE:-system-images;android-36;google_apis;x86_64}"
device="${OPENCOODE_AVD_DEVICE:-pixel_7}"
gpu="${OPENCOODE_EMULATOR_GPU:-swiftshader_indirect}"
boot_timeout="${OPENCOODE_BOOT_TIMEOUT:-300}"
package="dev.opencoode.mobile"

emulator_bin="$sdk/emulator/emulator"
avdmanager="$sdk/cmdline-tools/latest/bin/avdmanager"
sdkmanager="$sdk/cmdline-tools/latest/bin/sdkmanager"
# The base boot and every instance must use the same flags, or the emulator
# rejects the shared Quickboot snapshot and cold boots.
emulator_flags=(-no-window -no-audio -no-boot-anim -gpu "$gpu")

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: emulator.sh <command> [args]

  start <task>         Boot an emulator for <task>. Prints its serial.
  stop <task>          Shut down the emulator for <task> and remove its state.
  list                 Show every task emulator and whether it is alive.
  serial <task>        Print the serial for <task>.
  metro <task> <port>  Point the debug app on <task>'s emulator at Metro <port>.
  reset-base           Delete and recreate the base AVD and its snapshot.
EOF
}

task_dir() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9-]*$ ]] ||
    die "task names use lowercase letters, digits and hyphens: '$1'"
  echo "$state_root/$1"
}

# Run "$@" while holding the state lock, so concurrent starts pick distinct
# ports and only one of them creates the base AVD.
locked() {
  mkdir -p "$state_root"
  exec 9>"$state_root/.lock"
  flock 9
  "$@"
  flock -u 9
}

pid_is_emulator() {
  local pid="$1" port="$2"
  [[ -r "/proc/$pid/cmdline" ]] &&
    tr '\0' ' ' <"/proc/$pid/cmdline" | grep -q -- "-port $port "
}

wait_for_boot() {
  local serial="$1" pid="$2" port="$3" log="$4"
  local deadline=$((SECONDS + boot_timeout))
  until [[ "$(adb -s "$serial" shell getprop sys.boot_completed 2>/dev/null |
    tr -d '\r')" == 1 ]]; do
    if ! pid_is_emulator "$pid" "$port"; then
      tail -20 "$log" >&2
      echo "error: the emulator on port $port exited before it booted" >&2
      return 1
    fi
    if ((SECONDS >= deadline)); then
      tail -20 "$log" >&2
      echo "error: the emulator on port $port did not boot in ${boot_timeout}s" >&2
      return 1
    fi
    sleep 2
  done
}

port_in_use() {
  ss -ltnH "( sport = :$1 or sport = :$(($1 + 1)) )" | grep -q .
}

claimed_ports() {
  cat "$state_root"/*/port 2>/dev/null || true
}

claim_port() {
  local dir="$1" claimed port
  claimed="$(claimed_ports)"
  # The emulator accepts even console ports from 5554 to 5682. The adb port
  # is the console port + 1.
  for ((port = 5554; port <= 5682; port += 2)); do
    if ! grep -qx "$port" <<<"$claimed" && ! port_in_use "$port"; then
      mkdir -p "$dir"
      echo "$port" >"$dir/port"
      return
    fi
  done
  die "no free emulator console port between 5554 and 5682"
}

base_exists() {
  "$emulator_bin" -list-avds | grep -qx "$base_avd"
}

create_base() {
  base_exists && return
  local image_dir="$sdk/${image//;//}"
  if [[ ! -d "$image_dir" ]]; then
    echo "Installing $image" >&2
    yes | "$sdkmanager" "$image" >/dev/null
  fi
  echo "Creating AVD $base_avd from $image" >&2
  echo no | "$avdmanager" create avd -n "$base_avd" -k "$image" -d "$device" \
    >/dev/null
  # One writable boot initializes the data partition and saves the Quickboot
  # snapshot that read-only instances load.
  local log="$state_root/base-boot.log" port pid
  port=5554
  while port_in_use "$port"; do port=$((port + 2)); done
  setsid "$emulator_bin" -avd "$base_avd" -port "$port" \
    "${emulator_flags[@]}" >"$log" 2>&1 </dev/null 9>&- &
  pid=$!
  if ! wait_for_boot "emulator-$port" "$pid" "$port" "$log"; then
    kill -KILL "$pid" 2>/dev/null || true
    "$avdmanager" delete avd -n "$base_avd" >/dev/null
    exit 1
  fi
  adb -s "emulator-$port" emu kill >/dev/null
  while kill -0 "$pid" 2>/dev/null; do sleep 1; done
}

start() {
  local task="$1" dir pid port serial log
  dir="$(task_dir "$task")"
  if [[ -f "$dir/pid" ]] && pid_is_emulator "$(cat "$dir/pid")" "$(cat "$dir/port")"; then
    echo "emulator-$(cat "$dir/port")"
    return
  fi
  rm -rf "$dir"
  locked create_base
  locked claim_port "$dir"
  port="$(cat "$dir/port")"
  serial="emulator-$port"
  log="$dir/emulator.log"
  # setsid detaches the emulator, so it outlives the shell that started it.
  setsid "$emulator_bin" -avd "$base_avd" -port "$port" -read-only \
    -no-snapshot-save "${emulator_flags[@]}" >"$log" 2>&1 </dev/null 9>&- &
  pid=$!
  echo "$pid" >"$dir/pid"
  echo "$serial" >"$dir/serial"
  if ! wait_for_boot "$serial" "$pid" "$port" "$log"; then
    stop "$task"
    exit 1
  fi
  echo "$serial"
}

stop() {
  local task="$1" dir pid port
  dir="$(task_dir "$task")"
  [[ -d "$dir" ]] || return 0
  port="$(cat "$dir/port" 2>/dev/null || true)"
  pid="$(cat "$dir/pid" 2>/dev/null || true)"
  if [[ -n "$pid" ]] && pid_is_emulator "$pid" "$port"; then
    adb -s "emulator-$port" emu kill >/dev/null 2>&1 || true
    for _ in $(seq 30); do
      pid_is_emulator "$pid" "$port" || break
      sleep 1
    done
    if pid_is_emulator "$pid" "$port"; then
      kill -KILL "$pid"
    fi
  fi
  rm -rf "$dir"
}

list() {
  local dir task port pid status
  for dir in "$state_root"/*/; do
    [[ -f "$dir/port" ]] || continue
    task="$(basename "$dir")"
    port="$(cat "$dir/port")"
    pid="$(cat "$dir/pid" 2>/dev/null || echo -)"
    status=dead
    pid_is_emulator "$pid" "$port" && status=alive
    printf '%s\temulator-%s\tpid %s\t%s\n' "$task" "$port" "$pid" "$status"
  done
}

serial() {
  local dir
  dir="$(task_dir "$1")"
  [[ -f "$dir/serial" ]] || die "no emulator for task '$1'"
  cat "$dir/serial"
}

metro() {
  local serial port="$2"
  serial="$(serial "$1")"
  [[ "$port" =~ ^[0-9]+$ ]] || die "Metro port must be a number: '$port'"
  # A debug build on an emulator loads its bundle from 10.0.2.2, the host, so
  # adb reverse has no effect. The dev settings file selects the port.
  adb -s "$serial" shell run-as "$package" sh -c \
    "'mkdir -p shared_prefs && cat > shared_prefs/${package}_preferences.xml'" \
    <<EOF
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <string name="debug_http_host">10.0.2.2:$port</string>
</map>
EOF
  adb -s "$serial" shell am force-stop "$package"
}

reset_base() {
  [[ -z "$(list | grep alive || true)" ]] ||
    die "stop every task emulator before you reset the base AVD"
  if base_exists; then
    "$avdmanager" delete avd -n "$base_avd" >/dev/null
  fi
  locked create_base
}

command="${1:-}"
case "$command" in
  start | stop | serial)
    [[ $# -eq 2 ]] || {
      usage >&2
      exit 2
    }
    "$command" "$2"
    ;;
  metro)
    [[ $# -eq 3 ]] || {
      usage >&2
      exit 2
    }
    metro "$2" "$3"
    ;;
  list) list ;;
  reset-base) reset_base ;;
  *)
    usage >&2
    exit 2
    ;;
esac
