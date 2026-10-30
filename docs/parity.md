# OpenCode 2 mobile parity

Research date: October 29, 2026. Research baseline: OpenCode `v2.2.1`.

This document describes practical parity for an iOS and Android client of a remote OpenCode 2 server.
The server owns tools, files, sessions, providers, and model execution.
The phone owns its interface, drafts, credentials for the server, and attachment selection.

The checkboxes record full verification contracts. An unchecked item means that the complete contract lacks recorded end-to-end evidence.
The code availability table records implementation separately.
Source research alone does not establish implementation, device support, or feature parity.

## Version boundary

OpenCode 2 uses the `@opencode` packages and the `/api` protocol.
The legacy `@opencode-ai/sdk/v2` namespace does not establish OpenCode 2 compatibility.
The GitHub latest-release endpoint still reports the 1.x maintenance line. The `v2.2.1` source tag and V2 changelog establish this baseline.
The installed server can precede this baseline. Capability checks and honest unavailable states are necessary.

Sources: [V2 documentation](https://opencode.ai/v2/docs/), [V2 changelog](https://github.com/anomalyco/opencode/blob/v2.2.1/CHANGELOG.md), [protocol groups](https://github.com/anomalyco/opencode/tree/v2.2.1/packages/protocol/src/groups).

## Implementation and evidence

Source inspection establishes implemented controls. The linked records establish narrower API, browser, or native results.
Neither establishes every compound contract in the checklists below.

| Area | Implementation | Evidence and boundary |
| --- | --- | --- |
| Server connections | Pairing, version checks, multiple servers, secure credentials, and workspace persistence. | API pairing passed. iOS restored credentials and the selected session after a full JavaScript reload. |
| Projects | Remote folder browser, recent projects, manual paths, and Git initialization. | Native Android session movement passed. The later folder browser has source evidence only. |
| Session management | Search, pagination, lifecycle refresh, create, rename, archive, restore, fork, move, delete, and JSON transfer. | API lifecycle checks passed. Both native platforms displayed external title updates. |
| Conversation | Live transcript, models, favorites, recent models, agents, commands, skills, context, inbox actions, and session actions. | Real inference and browser tool output passed. Native shell output passed on iOS and Android. Later model preferences have source evidence only. |
| Session detail | Child navigation and interruption, background command output with byte cursors, side questions, and token/cost totals. | These later panels have source evidence only. Token totals do not supply the separate experimental reliability statistics. |
| Requests | Session and global forms, permission decisions, validation, and saved rules. | API form and permission checks passed. Actual provider OAuth and MCP elicitation remain unverified. |
| Files and artifacts | Search, text edits, selected text with line context, image previews, and native sharing or browser downloads. | Native text saves matched server disk. Later media, selection, and sharing controls have source evidence only. |
| Changes and worktrees | VCS status, working/branch/committed comparisons, review comments with patch context, and worktree actions. | API Git diff passed. Later review feedback controls have source evidence only. |
| Terminal | Native WebView and browser renderers, ordinary shells, persistent PTYs, control ownership, snapshots, resize, and full-screen input. | Native ordinary input passed on both platforms. Android persistent observer/control and buffered input passed. |
| Accounts and settings | Providers, OAuth controls, credentials, models, MCP, plugins, configuration, saved permissions, and grouped phone navigation. | Settings API reads and browser navigation passed. Android theme changes passed. Provider connection completion remains unverified. |
| MCP resources | Resource and template catalog search, manual template URI entry, and prompt references. | References contain catalog metadata only. Resource contents require compatible server tools. The later panel has source evidence only. |
| Schedules and instructions | Schedule lifecycle controls and text or JSON instruction entries through experimental APIs. | API schedule CRUD passed on 2.2.1. Instruction save/read/remove passed. Scheduled execution remains unverified. |
| Motion | Shared press feedback, activity pulse, drawer transitions, reduced motion, and batched chat updates. | Source evidence and browser layout evidence are separate from native runtime evidence. See the motion and native records. |
| Desktop extensions | Server plugin tools remain accessible through sessions. | Desktop panels, browser control, Office, WSL, and host editor actions lack mobile adapters. |
| Background alerts | No push service. | The app cannot promise alerts after the operating system suspends its connection. |

Evidence: [API record](verification.md), [native record](native-verification.md), [mobile UX record](mobile-ux.md), and [motion record](motion-audit.md).
The final practical additions have source evidence only unless a linked record explicitly names their runtime result.

## Core parity

| Verification | Feature | Server contract and observable result |
| --- | --- | --- |
| [ ] | Server connections | Save multiple server addresses, switch between them, remove them, and display connection errors. Check `/api/info` before use. |
| [ ] | Authentication and pairing | Accept server credentials or redeem a pairing link with JSON acceptance. Store the returned token securely. Report expired or reused codes. |
| [ ] | Server identity | Display server name, version, address, and connection state. Scope all cached data and drafts to that server. |
| [ ] | Projects and directories | List projects and resolve locations. Browse remote directories before session creation. Keep the selected directory visible. |
| [ ] | Session creation | Create sessions with the selected location, model, and agent. Show server errors without a fabricated session. |
| [ ] | Session history | List, search, paginate, and reopen sessions. Filter by project, directory, parent, and archive state when relevant. |
| [ ] | Session management | Rename, archive, restore, and delete sessions. Explain that deletion also deletes child sessions. |
| [ ] | Read state | Display active and unread sessions. Mark the observed idle transition as viewed through `session.view`. |
| [ ] | Transcript | Display user text, assistant Markdown, code, links, attachments, tool arguments, outputs, failures, and execution state. |
| [ ] | Transcript detail | Expand tool output and available reasoning. Keep reasoning visibility separate from the model variant. |
| [ ] | Live updates | Receive native and plugin events. Refresh authoritative state after every reconnect or app resume. |
| [ ] | Prompt composition | Support multiline text, persistent drafts, attachment removal, prompt history, keyboard avoidance, and explicit send errors. |
| [ ] | Prompt delivery | Offer steering and queued delivery while work runs. Show the admitted inbox item before the assistant response exists. |
| [ ] | Queued input | List queued prompts, send one now, cancel one, and edit one through cancellation and resubmission when necessary. |
| [ ] | Stop and resume | Interrupt active execution. Reflect the returned result and server state. Preserve queued input after interruption. |
| [ ] | Model selection | List server models, choose model variants, and switch the session model. Retain favorites and recent selections locally. |
| [ ] | Agent selection | List agents and switch the session agent. Support agent mentions and links to child sessions. |
| [ ] | File context | Find remote files, attach file references, and preserve selected line ranges. Include configured reference roots. |
| [ ] | Phone attachments | Select real photos and documents. Send attachment bytes or supported URIs. Never send a phone file path as a remote path. |
| [ ] | Commands | List and execute server commands with their actual arguments. Expose local interface actions separately. |
| [ ] | Skills | Discover server skills and attach or activate them through the supported contract. |
| [ ] | Permission requests | Display action, resources, scope, and explanation. Send the selected decision and handle requests settled by another client. |
| [ ] | Forms and questions | Render string, number, integer, boolean, multiselect, and external fields. Respect defaults, validation, and conditional visibility. |
| [ ] | Pending requests | Restore pending permissions and forms after reconnect. Include location forms for MCP elicitation outside one session. |
| [ ] | Child sessions | Navigate parent and child sessions. Display background subagent progress and preserve the selected session identity. |
| [ ] | Compaction | Request session compaction and reflect completion or failure. Show active context separately from full history. |
| [ ] | Undo and redo | Stage a revert, restore it, or commit it through the V2 revert API. Reflect optional file changes and server busy errors. |
| [ ] | Fork | Fork before a selected message or copy full history. Display the resulting child session and its location. |
| [ ] | Session movement | Move a session to another location at the requested delivery boundary. Recover from a missing directory. |

Sources: [session protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/session.ts), [session schema](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/schema/src/session.ts), [prompt schema](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/schema/src/prompt-input.ts), [form schema](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/schema/src/form.ts), [permission protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/permission.ts), [TUI workflows](https://github.com/anomalyco/opencode/blob/v2.2.1/services/www/src/docs/content/cli/tui.mdx).

## Files, review, and execution

| Verification | Feature | Server contract and observable result |
| --- | --- | --- |
| [ ] | File browser | Browse remote folders, find filenames, read actual content, and distinguish text, image, document, and binary content. |
| [ ] | File selection | Copy content and add a selected range to the prompt. Preserve its remote location and file identity. |
| [ ] | File refresh | Refresh changed files through supported watches or explicit refresh. Display read failures and missing files. |
| [ ] | Artifact preview | Open supported files and media from real server responses. Offer native sharing or download for other formats. |
| [ ] | File writes | Use the experimental write endpoint only when supported. Display the real save result and refresh the file. |
| [ ] | VCS state | Show current branch and changed files. Report absent repositories and unavailable snapshot data. |
| [ ] | Review changes | Display turn, working-copy, and branch diffs. Support explicit review bases and readable unified diffs on phones. |
| [ ] | Review feedback | Attach comments or selected diff lines to the next prompt with their actual context. |
| [ ] | Worktrees | List, create, refresh, and remove remote worktrees. Select a worktree before session creation or movement. |
| [ ] | Repository initialization | Initialize supported VCS providers through the actual endpoint. Display unsupported-provider errors. |
| [ ] | Session shell | Execute a shell command in the session directory and retain its output in the conversation. |
| [ ] | Background work | Move blocking tools into the background when supported. Show running subagents and shell commands. |
| [ ] | Shell output | List actual commands, page captured output by byte cursor, show exit codes, and stop commands through the server. |
| [ ] | Interactive terminal | Create, list, rename, resize, connect to, and remove PTYs. Provide real terminal input and ANSI output. |
| [ ] | Persistent terminals | Respect the server capability flag. Restore terminal connections and output through the supported persistent PTY contract. |

Sources: [filesystem protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/fs.ts), [VCS protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/vcs.ts), [worktree protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/worktree.ts), [shell protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/shell.ts), [PTY protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/pty.ts), [review interface](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/gui-plugins/src/review/index.ts).

## Settings and integrations

| Verification | Feature | Server contract and observable result |
| --- | --- | --- |
| [ ] | Provider catalog | List actual providers, available models, connected accounts, and authentication methods. |
| [ ] | Provider connection | Connect with keys, external credentials, OAuth, or supported command flows. Report server and provider failures. |
| [ ] | OAuth completion | Open the authorization URL and complete or cancel the actual attempt. Preserve attempt state across app switches. |
| [ ] | Credentials | List, create, update, activate, and remove server credentials through supported routes. Never fabricate a successful connection. |
| [ ] | MCP management | List, add, remove, connect, and disconnect MCP servers. Display authentication or elicitation requirements. |
| [ ] | MCP resources | List actual MCP resources and add supported resource context to the prompt. |
| [ ] | Saved permissions | Inspect, edit, and remove saved permission rules. Keep project scope clear. |
| [ ] | Project preferences | Update supported project properties. Distinguish project properties from local display preferences. |
| [ ] | Server configuration | Read actual configuration and apply supported global updates. Display validation failures and server scope. |
| [ ] | Configuration reload | Reload configuration and recover cancelled pending requests and replacement location state. |
| [ ] | Usage | Display server usage limits, session token counts, and costs where available. Preserve unknown values as unknown. |
| [ ] | Interface preferences | Support light, dark, and system appearance, readable text sizes, and transcript detail preferences. |
| [ ] | Local notifications | Notify about completion, errors, permissions, and forms while the app has an active connection and OS permission. |
| [ ] | Export and import | Use real transcript export and import routes. Preserve export errors and native document selection. |
| [ ] | Diagnostics | Provide server details and useful connection errors. Export only the logs that the app actually records or receives. |

Sources: [integration protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/integration.ts), [credential protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/credential.ts), [MCP protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/mcp.ts), [configuration protocol](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/config.ts), [desktop actions and settings](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/app/src/runtime/i18n/en.ts).

## Experimental and extension parity

These features require explicit server support, configuration, credentials, or a plugin.
An absent capability needs an unavailable state. A control with a fabricated result does not satisfy parity.

| Verification | Feature | Boundary |
| --- | --- | --- |
| [ ] | Side questions | Use session-context generation for `/btw` behavior. Keep the answer outside the main transcript. |
| [ ] | Goals | Detect the actual goal plugin. Display its state and use its real pause, resume, and clear actions. |
| [ ] | Schedules | List, create, inspect, pause, resume, and delete schedules when `experimental.schedules` permits them. |
| [ ] | Image generation | Display real generated images and edit results from supported models and server tools. |
| [ ] | Voice | Discover supported voice models. Use server-brokered WebRTC or WebSocket transport with microphone permission and real audio. |
| [ ] | Plugin status | List enabled plugins and actual update results. Surface plugin failures. |
| [ ] | Plugin RPC | Invoke only known supported plugin contracts. Preserve plugin events and unknown activity in a readable form. |
| [ ] | Instructions | Inspect and update durable instruction entries when the server supports the experimental API. |
| [ ] | Session statistics | Display real activity and reliability statistics from the experimental statistics endpoint. |
| [ ] | Web search | Display available providers, request actual searches, and render returned sources. |
| [ ] | Client MCP | Attach a client MCP server only when a real mobile implementation supplies its tools. |

Sources: [V2 changelog](https://github.com/anomalyco/opencode/blob/v2.2.1/CHANGELOG.md), [schedules](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/schedule.ts), [voice](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/voice.ts), [plugins](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/plugin.ts), [generation](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/generate.ts).

## Mobile limits

The phone cannot start or upgrade a remote OpenCode installation without a separate host-management contract.
Host tools and shell commands execute on the server. A phone attachment path does not identify a server file.

Desktop GUI plugins supply desktop bundles. Native React Native cannot execute their desktop interface without a compatible runtime.
Server plugin tools remain usable through the session. Custom plugin panels need an explicit mobile adapter.

Desktop browser control, Microsoft Office panels, WSL management, host editor launch, and Finder actions depend on desktop capabilities.
Remote file preview and native sharing cover some of these outcomes. They do not establish full desktop plugin parity.

Mobile operating systems suspend background connections. Server execution can continue while the app sleeps.
Reliable remote push needs a push service or server integration. A local notification alone does not provide it.

OAuth flows that depend on a server-local callback need a reachable callback or a supported alternate method.
Opening an authorization page on the phone does not prove that its callback reaches the host.

The app supplies a terminal renderer, WebSocket transport, resize support, and keyboard controls.
Android full-screen terminals use buffered native text input to avoid keyboard composition errors.
Physical phone behavior and literal Unicode input on Android remain outside the recorded native evidence.

Sources: [server pairing and capabilities](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/server.ts), [desktop plugin bundle contract](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/plugin.ts), [desktop built-in plugins](https://github.com/anomalyco/opencode/tree/v2.2.1/packages/gui-plugins/src).

## Evidence boundary

The unchecked rows preserve the complete contracts, including identity changes, cross-client request settlement, interrupted execution, and platform-specific attachments.
Earlier API and device results prove subsets of those contracts. They do not justify a blanket full-parity claim.
This ledger records gaps. It does not request further tests after the instruction to stop them.

The global SSE stream is volatile. A disconnect loses events, and a slow consumer can overflow its stream.
The experimental session log provides durable events after an aggregate sequence. It does not replace state refresh for location-wide requests.

An endpoint response alone does not verify its mobile interface. A typecheck alone does not verify a device build or live server flow.

Sources: [event delivery contract](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/event.ts), [session log and lifecycle contracts](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/protocol/src/groups/session.ts).
