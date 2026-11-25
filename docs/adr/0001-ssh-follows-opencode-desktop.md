# SSH connections follow the OpenCode desktop design, on Android only

SSH Servers copy the SSH plugin of the OpenCode desktop app (`packages/gui-plugins/src/ssh/` in `anomalyco/opencode`). The app logs in to the SSH target and reads the OpenCode service registration file to get the server address and password. If OpenCode is not running, the app installs and starts it. The app then reaches the server through a tunnel. There is no SSH pairing payload or pairing code. A shared design keeps the phone and the desktop on one installation in `~/.opencode/desktop-ssh/<version>/` and needs no new command on the computer.

The SSH layer is a project-owned Expo module for Android only, built on `mwiede/jsch`. No published React Native SSH package supports local port forwarding. JSch provides command execution, local forwarding, host key checks, key generation, encrypted key import, and password login in one library.

## Considered options

- An SSH pairing payload from the computer, which upstream `opencode pair` cannot produce.
- A fork of `@speedshield/react-native-ssh-sftp`, which turns off host key checks and has no forwarding.
- A Rust core (russh) through uniffi, which adds a Rust toolchain to every native build.
- iOS support with Citadel, which needs a custom local listener. iOS is out of scope.

## Consequences

- Pi servers cannot use SSH until the Pi companion writes a comparable registration file.
- The SSH option is hidden on iOS and web.
