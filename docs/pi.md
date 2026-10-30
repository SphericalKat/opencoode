# Connect an active Pi session

Opencoode connects to the Pi process in your terminal through the companion extension in `packages/pi-mobile`.
The phone and terminal share the active session, models, tools, and installed Pi extensions.
The companion starts no second agent process and makes no separate model requests.

## Install the extension

Use Pi 1.4 or later within version 1.x.
Keep the local Opencoode checkout after installation. Pi loads the extension from that checkout.

1. Open the Opencoode directory.

   ```sh
   cd /absolute/path/to/opencoode
   ```

2. Install the companion dependencies without duplicate Pi host packages.

   ```sh
   pnpm --dir packages/pi-mobile install --config.auto-install-peers=false
   ```

3. Install the companion into Pi.

   ```sh
   pi install /absolute/path/to/opencoode/packages/pi-mobile
   ```

4. Enter `/reload` in your active Pi terminal.
5. Enter `/mobile` in that terminal.
6. Select **Scan QR code** in the native app.
7. Scan the QR code from Pi.

If the app already connects to another server, open **Settings → Servers** from the top menu.
If the camera is unavailable, paste Pi's URL into **Pairing link**, then select **Connect**.

The app detects Pi through the same connection flow as OpenCode. There is no separate backend selector.
The pairing code expires after five minutes and permits one use. `/mobile` creates a new code.

Pi supports [local package installation](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/packages.md).
Pi does not install dependencies for local packages, so the separate dependency step is required.

## Available controls

| Control | Behavior |
| --- | --- |
| Conversation | Shows the active branch, live responses, model reasoning, tool input, and tool output |
| Send | Submits a message to the active terminal session |
| Images | Adds PNG, JPEG, WebP, or GIF images, with draft previews and removal |
| Steer | Adds a message at Pi's next interruption point |
| Queue | Adds a follow-up after the current work |
| Stop | Aborts the current work |
| Model | Selects an available model from Pi's authenticated model registry |
| Thinking level | Selects a level that the current model supports |
| Sessions | Lists saved sessions for the current project |
| New session | Creates a session and changes the active terminal session |
| Open session | Changes the active session on both devices |
| Fork | Creates a branch from a selected user message and changes the active terminal session |
| Rename | Changes the active session name |
| Compact context | Asks Pi to summarize the active context |

Model changes and session controls require an idle session without a terminal dialog.
The app displays a notice when Pi needs input in the terminal.
The companion cannot submit answers to arbitrary extension dialogs or custom terminal screens.

## Connection lifetime

The listener starts only after `/mobile`. It binds to an available port and advertises private IPv4 addresses from the computer.
The connection uses HTTP and long polling. The native app refreshes the session snapshot after reconnect or resume.
The browser preview cannot connect to this listener.

The phone can disconnect while Pi continues work in the terminal.
Session changes preserve the listener and device token.
Pi exit, `/reload`, and `/mobile stop` close the listener and revoke the token.

If you change sessions in the terminal, enter `/mobile` before you use the phone's New, Open, or Fork controls.

To disconnect the phone and revoke access, enter this command in Pi:

```text
/mobile stop
```

## Network limits

Use a trusted LAN or private VPN. The listener accepts private IPv4 clients and rejects browser requests.
Do not expose its HTTP port to the public internet. The device token grants control of Pi and its tools.
This companion does not create tunnels or provide HTTPS.
The phone must reach an address that appears in Pi's pairing output.

## Why this uses normal Pi

[Pi Durable](https://earendil.com/posts/pi-durable/) is a separate framework for applications that own agent conversations and recover work after process failure.
It does not attach to an active normal Pi process.
Its harness owns separate task checkpoints, tools, storage, and extension definitions.
Its [API remains experimental](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md).

[Pi Pocket](https://github.com/TannerMidd/pi-pocket) demonstrates a mobile application around Durable with shared sessions and its own HTTP protocol.
Its [normal Pi import](https://github.com/TannerMidd/pi-pocket/blob/main/src/server/pi-sessions.ts) copies a transcript into a separate conversation.
The original system prompt and extension state stay behind. Pi Pocket does not support normal Pi extensions.

[Durable Pi](https://github.com/disler/durable-pi) demonstrates device servers with a shared HTTP API, SQLite storage, and web and terminal clients.
Its servers own Durable agents. They do not attach to existing normal Pi terminal sessions.

[Pi Remote iOS](https://github.com/tornikegomareli/pi-remote-ios) demonstrates an extension inside the active terminal process with a native phone client.
It provides a closer architecture reference for this companion.
These projects are research references. This companion does not copy their source code.

Durable does not require one process per conversation.
Its SQLite backend keeps active work in memory and older history on disk.
Its JSONL backend keeps the full history in memory.
The inspected sources provide no comparable measurements of CPU or RAM use between normal Pi and Durable.
The [storage reference](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md#storage) describes those limits.

The active-process extension fits remote control of an existing Pi terminal session.
Durable fits a separate server that owns conversations and must recover interrupted work after process failure.

## Verification boundary

I paired Android Expo Go with Pi 1.4 through the shared connection screen.
I sent a prompt from Android, opened its real bash output, and read the response.
I created a session from Android and reopened the original without another pair step.
I opened the long-press action bar on a message.
I received a terminal prompt and its live tool status on Android, then used Jump to latest after the response.
I restored the saved OpenCode connection and stopped the separate Pi review process.

I did not run automated tests, typechecks, linters, or builds.
I did not verify image uploads or iOS on a device.
