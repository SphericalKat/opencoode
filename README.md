# Opencoode

Opencoode is a React Native client for OpenCode 2 on iOS and Android.
It uses the OpenCode OC-2 theme, Inter, IBM Plex Mono, and the official icon set.
The OpenCode server runs models, tools, commands, and terminals on your computer.

## Start development

Use Node 22.13+, 24.3+, or 26+. Use an Expo Go version that supports SDK 58.

1. Install dependencies.

   ```sh
   npm ci
   ```

2. Start the client.

   ```sh
   npm start
   ```

3. Open the QR code in Expo Go.

Use `npm run ios` for the iOS simulator. This command applies the committed SimSlim profile before Expo starts.
Use `SIMULATOR_UDID=<device-id> npm run ios` to select a specific device.
Use `npm run android` for the Android emulator, or `npm run web` for the browser preview.
Metro uses at most two workers. Run one simulator or emulator at a time on a computer with limited memory.

## Connect a server

1. Start OpenCode 2 on your computer.

   ```sh
   opencode serve --hostname 0.0.0.0 --port 4096
   ```

2. Enter the computer’s LAN or private VPN address in the client.
3. Enter the server password, or paste an OpenCode pairing link.
4. Select a project directory on the server.

If you use the browser preview, allow its origin on the server.

```sh
opencode serve --hostname 0.0.0.0 --port 4096 --cors http://localhost:8081
```

Use HTTPS outside a trusted network. Native builds permit HTTP for local servers.
On a physical phone, `localhost` refers to the phone.
For an Android emulator, use `10.0.2.2` to reach the host computer.
The iOS simulator can use `127.0.0.1`.

## Available controls

- Multiple servers, pairing, secure native credentials, and project selection
- Session search, history, archive, fork, move, import, and export
- Live responses, Markdown, reasoning, tool artifacts, models, favorites, recent models, agents, and variants
- Text, files, agent mentions, skills, slash commands, and shell commands
- Steering, queued prompts, queue edits, interruption, compaction, and reverts
- Child sessions, background commands, paged shell output, side questions, and session usage totals
- Permissions, conditional forms, global MCP requests, and saved rules
- Remote folders, text edits, selected text context, image previews, file sharing, Git review feedback, worktrees, and interactive terminals
- Provider connections, OAuth, credentials, MCP, plugins, and configuration
- Session instructions, schedules, usage, web search, and standalone generation
- Persistent drafts and system, light, and dark appearance

MCP resource controls attach catalog references. They do not fetch resource contents.
The latest practical controls have source evidence only unless the records below name a runtime result.

## Verification

The [API record](docs/verification.md) describes earlier checks against isolated OpenCode 2.1.4 and 2.2.1 servers.
The [native record](docs/native-verification.md) records Expo Go results on iOS and Android.
The [mobile UX record](docs/mobile-ux.md) records browser measurements and remaining device limits.
The [parity ledger](docs/parity.md) separates implemented controls from complete verification contracts and unsupported desktop capabilities.

Use `npm run terminal:bundle` after an xterm dependency update.
The committed terminal bundle contains its dependencies and licenses. It requires no CDN.

## Native builds

EAS profiles support an internal Android APK, an iOS simulator build, and production builds.
EAS requires your Expo account. Device distribution requires platform credentials.

```sh
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile simulator --platform ios
```

Use `npx expo run:android` or `npx expo run:ios` for local native builds.
These commands require the Android SDK or Xcode and consume more resources than Expo Go.

## Limits

Use OpenCode 2.2.1 or later for the newer experimental endpoints. Core controls also work with 2.1.4.
The legacy `@opencode-ai/sdk/v2` protocol is incompatible with OpenCode 2.

The editor accepts UTF-8 text up to 512 KiB. Phone attachments have a 10 MiB limit per file.
File saves refuse detected conflicts. The server lacks atomic revision checks, so a change between the final read and write remains possible.

Desktop extension panels, host application controls, voice sessions, and background push notifications lack mobile adapters.
The server continues work after the phone disconnects. The app refreshes authoritative state after reconnect or resume.

The terminal supports workspace shells and desktop persistent PTYs when the server supports them.
Desktop terminals belong to a session. The app restores their screen from a server snapshot after reconnect.
Viewers preserve desktop control until the user selects **Take control**. The server controls each terminal's lifetime.

Android terminal input uses a text field in the full-screen view. **Send line** sends text and Return.
**Send text** sends text without Return. The shortcut row includes Enter, Esc, arrows, and control keys.
**Hide text** conceals sensitive input. The full-screen view provides more terminal space on small displays.

Native credentials use SecureStore. Native drafts use the app cache and can disappear when the operating system clears that cache.
Browser credentials and drafts last for the current browser session.

This project is an independent client. OpenCode assets and font licenses appear in [assets/NOTICE.md](assets/NOTICE.md).
