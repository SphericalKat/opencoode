# OpenCode 2 API research

Research date: October 29, 2026.

## Version boundary

The mobile app targets OpenCode 2 and `@opencode/client@2.2.1`.
The local server reports version 2.1.4.
I read the 2.1.4 source and current upstream source at commit `3eb834b85ac064d07a1d58044f0c7aa9d78f27b5`.
The core session, message, model, permission, and location contracts match across these versions.

The public [server guide](https://opencode.ai/docs/server/) still documents older paths such as `/session` and `/global/health`.
The public [SDK guide](https://opencode.ai/docs/sdk/) describes `@opencode-ai/sdk/v2`.
That import is a second generated client for the old package.
It does not identify the OpenCode 2 protocol.
The old package remains on npm as version 1.19.5.

The current [client package](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/client/package.json) is version 2.2.1.
Its Promise entry point has no Effect runtime dependency.
Its generated types describe the actual `/api` protocol.
The server-host SDK `@opencode/sdk` includes server dependencies and is unnecessary for a remote mobile client.

## Client construction

```ts
import { OpenCode } from '@opencode/client'
import { fetch } from 'expo/fetch'

const client = OpenCode.make({
  baseUrl: 'https://host.example/opencode',
  fetch,
  headers: { Authorization: 'Basic BASE64_USERNAME_COLON_PASSWORD' },
})

const info = await client.server.info()
const location = await client.location.get({ location: { directory: '/home/me/project' } })
const session = await client.session.create({
  location: { directory: location.directory },
  model: { providerID: 'anthropic', id: 'MODEL_ID' },
})
await client.session.prompt({ sessionID: session.id, text: 'Explain this repository' })
const messages = await client.message.list({ sessionID: session.id, order: 'asc', limit: 100 })
```

The client preserves a path prefix in `baseUrl`.
The second argument for normal requests accepts `{ signal, headers }`.
Requests throw declared API errors or `ClientError`.
There is no `{ data, error }` result wrapper for every method.
Some methods unwrap the wire response, while list methods preserve pagination or location envelopes.

Source: [generated Promise client](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/client/src/promise/generated/client.ts).

## Authentication and pairing

OpenCode 2 uses HTTP Basic authentication with username `opencode`.
The Basic password accepts either the server password or a token from a pairing link.
The token is not a Bearer token.
The client must send the header on ordinary HTTP requests and the SSE request.

`GET /api/info` returns `{ version, pid, hostname?, urls, paths: { tmp }, capabilities? }`.
It requires authentication when the server enforces authentication.
Version 2.1.4 omits `hostname`.
The optional `capabilities.persistentPty` flag identifies persistent terminal support.

`POST /api/pair` creates `{ code, expires_in }` for an authenticated caller.
`GET /auth/connect/{code}` consumes the single-use code.
An `Accept: application/json` request returns `{ token }`.
A browser request that accepts HTML receives a cookie and redirect instead.
The signed token expires after 30 days.
The server password controls the signature, so password rotation invalidates existing tokens.

```ts
const { token } = await client.server.connect(
  { code: 'CODE_FROM_PAIR_LINK' },
  { headers: { Accept: 'application/json' } },
)
```

Native clients can store the password or token with Expo SecureStore.
The web preview can use session storage for credentials that expire with the tab session.

Sources: [server routes](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/protocol/src/groups/server.ts), [authentication](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/server/src/auth.ts), [pairing handler](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/server/src/handlers/server.ts).

## Directory and project scope

Location-scoped methods accept `location: { directory?: string }`.
The client encodes this as `location[directory]=/absolute/path` in the query.
The server resolves its default location when the caller omits it.
The older `x-opencode-directory` convention is unnecessary for this client.

`location.get` returns `{ directory, project: { id, directory, canonical } }`.
Session creation accepts a location in its body.
Session operations resolve the location from the session ID.
Session lists use separate `directory`, `project`, and `subpath` filters.
The global event stream covers every location and includes the location on relevant events.

## Session and message contracts

| SDK method | HTTP route | Main input or output |
| --- | --- | --- |
| `session.list` | `GET /api/session` | Filters: `limit`, `order`, `search`, `parentID`, `archived`, `directory`, `project`, `subpath`, `cursor` |
| `session.create` | `POST /api/session` | Optional `id`, `parentID`, `title`, `agent`, `model`, `location`, `metadata`, `permissions` |
| `session.get` | `GET /api/session/{sessionID}` | Returns `SessionInfo` directly |
| `session.update` | `PATCH /api/session/{sessionID}` | `title`, `metadata`, `permissions`, `archived`. Returns no content |
| `session.remove` | `DELETE /api/session/{sessionID}` | Returns no content |
| `session.fork` | `POST /api/session/{sessionID}/fork` | Optional `before` message boundary |
| `session.switchAgent` | `POST /api/session/{sessionID}/agent` | `{ agent }` |
| `session.switchModel` | `POST /api/session/{sessionID}/model` | `{ model: { providerID, id, variant? } }` |
| `session.prompt` | `POST /api/session/{sessionID}/prompt` | `{ text, files?, agents?, skills?, delivery?, resume?, id?, metadata? }` |
| `session.command` | `POST /api/session/{sessionID}/command` | `{ name, text, files?, agents?, skills?, delivery? }` |
| `session.shell` | `POST /api/session/{sessionID}/shell` | `{ command, id? }` |
| `session.compact` | `POST /api/session/{sessionID}/compact` | Optional `id`, `delivery` |
| `session.interrupt` | `POST /api/session/{sessionID}/interrupt` | Optional `resume`. Returns `{ interrupted }` |
| `session.diff` | `GET /api/session/{sessionID}/diff` | Optional `from`, `to`, `context`. Returns file diffs |
| `message.list` | `GET /api/session/{sessionID}/message` | Optional `limit`, `order`, `cursor`, `type` |
| `session.message.get` | `GET /api/session/{sessionID}/message/{messageID}` | Returns one projected message directly |
| `session.inbox.list` | `GET /api/session/{sessionID}/inbox` | Returns pending work |
| `session.inbox.cancel` | `DELETE /api/session/{sessionID}/inbox/{inboxID}` | Cancels pending work |
| `session.inbox.update` | `PATCH /api/session/{sessionID}/inbox/{inboxID}` | `{ delivery: 'steer' \| 'queue' }` |

`session.list` returns `{ data: SessionInfo[], cursor: { previous?, next? } }`.
`message.list` returns `{ data: SessionMessageInfo[], cursor: { previous?, next? } }`.
`session.prompt` returns the accepted `SessionInboxUser`, rather than an assistant response.
The session executes asynchronously and emits progress through events.
`delivery: 'steer'` supplies work during execution, while `queue` parks it for a later turn.

`SessionInfo` includes `id`, `projectID`, `location`, `agent?`, `model?`, `title?`, `time`, `cost`, `tokens`, and `outcome?`.
It also includes optional `parentID`, fork information, permissions, metadata, and revert information.
The current version adds optional `time.busy`.
Version 2.1.4 does not expose that timestamp.

There is no separate `Part[]` alongside each OpenCode 2 message.
`SessionMessageInfo` is a discriminated union of user, assistant, shell, system, skill, compaction, idle, and selection messages.
User messages contain `text` and optional `files`, `agents`, and `skills`.
Assistant messages contain `content[]` with `text`, `reasoning`, or `tool` members.
Tool state uses `streaming`, `running`, `completed`, or `error`.
Assistant messages also expose model, token usage, cost, finish reason, retry information, and errors.
Shell message output uses an optional `{ output, cursor, size, truncated }` object.
Fork ancestry uses `fork.sessionID`.
The separate `parentID` field represents parent sessions, such as subagents.

File attachments contain `{ uri, name?, description?, mention? }`.
The `uri` refers to content that the remote server can resolve.
A local mobile path is not a path on the remote server.

Revert uses three operations: `session.revert.stage`, `session.revert.clear`, and `session.revert.commit`.
The stage operation accepts a message ID and optional files.
This contract differs from the old `session.revert` endpoint.

Sources: [session protocol](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/protocol/src/groups/session.ts), [generated types](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/client/src/promise/generated/types.ts).

## Events and React Native transport

```ts
const controller = new AbortController()
for await (const event of client.event.subscribe({ signal: controller.signal })) {
  if (event.type === 'server.connected') {
    // Refresh lists and the selected session after each connection.
  }
  if (event.type === 'session.text.delta') {
    const { sessionID, assistantMessageID, ordinal, delta } = event.data
  }
}
```

The endpoint is `GET /api/event` with optional repeated `types` query parameters.
The public client shares one transport across subscribers and filters types locally.
Every subscriber receives `server.connected`, including filtered subscribers.
The returned value is an `AsyncIterable`, with no `.stream` field.

Events contain `id`, `type`, `data`, optional `location`, and usually `created`.
Durable events also contain `{ aggregateID, seq, version }` under `durable`.
The `session.text.delta` payload contains `sessionID`, `assistantMessageID`, `ordinal`, and `delta`.
The stream also supplies reasoning, tool, permission, form, session, project, worktree, credential, and MCP events.

This stream is volatile by contract.
Events during disconnection are lost, and slow consumers can overflow.
The shared client queue holds at most 4,096 events per subscriber.
The client does not automatically reconnect after completion or failure.
The server emits keepalive comments every 15 seconds.
The official web client reconnects, checks stream activity, and refreshes state after connection.
Its default idle timeout is 45 seconds.

The generated Promise client requires `fetch`, `Headers`, `URL`, `AbortController`, `TextDecoder`, and `Response.body.getReader()`.
The shared event wrapper also requires `Promise.withResolvers`.
Standard React Native fetch cannot guarantee the required response stream.
Expo fetch supplies a streaming response API.
Expo SDK 58 installs that implementation as global fetch on Android and iOS by default.
The explicit import preserves this choice if the environment selects React Native fetch.
Hermes compatibility requires a check for `Promise.withResolvers`, with a polyfill when absent.
The mobile app must reconnect after foreground return and refetch authoritative state.

Text and reasoning deltas do not update the persisted message projection.
The projection receives the complete text when the corresponding end event arrives.
A client that only refetches messages cannot display individual token chunks.
The UI must keep a temporary delta overlay until the complete message arrives.
Text and reasoning ordinals count fragments within each kind, rather than positions in the full content array.

Descending message lists use `cursor.next` for older messages.
Cursor requests must omit `order`, because the cursor already encodes it.
The server rejects a cursor request that also supplies `order`.

An experimental session log supports durable catch-up through `experimental.session.log({ sessionID, after?, follow? })`.
The route is `/api/experimental/session/{sessionID}/log`.
The first mobile implementation can use state refresh instead of a second event projection engine.

Sources: [event protocol](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/protocol/src/groups/event.ts), [shared events](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/client/src/shared-events.ts), [official reconnect behavior](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/client/src/solid/connection.ts).

Expo documents the stream and runtime APIs in its [SDK reference](https://docs.expo.dev/versions/latest/sdk/expo/).

## Permissions and forms

Pending permissions use `permission.request.list` or `permission.list`.
Replies use `permission.reply({ sessionID, requestID, decision, message? })`.
The decision is `once`, `always`, or `reject`.
Saved permissions support list, update, and remove operations.

Questions use forms in OpenCode 2.
The client exposes `session.form.list`, `get`, `reply`, and `cancel`.
`session.form.reply` accepts `{ sessionID, formID, answer: Record<string, string | number | boolean | string[]> }`.
The global `form.list` method returns pending forms across sessions.
There is no old `question.reply` method in this protocol.

## Providers, models, and OAuth

`provider.list` and `provider.get` describe providers.
`model.list` and `model.default` describe models available at a location.
Model lists default to chat models.
The `types` input accepts `chat`, `image`, and `decision`.
An image picker must request image models explicitly.
Connection methods belong to integrations, rather than to providers.
`integration.list` and `integration.get` describe available methods and current connection state.

```ts
await client.integration.connect.key({ integrationID, key, label: 'Personal key' })
const attempt = await client.integration.oauth.connect({ integrationID, methodID })
// Open attempt.url in the system browser.
const status = await client.integration.oauth.status({ integrationID, attemptID: attempt.attemptID })
await client.integration.oauth.complete({ integrationID, attemptID: attempt.attemptID, code })
```

OAuth attempts expose `attemptID`, `url`, `instructions`, `mode: 'auto' | 'code'`, and expiration information.
Status is `pending`, `complete`, `failed`, or `expired`.
Automatic flows use the server callback and status endpoint.
Code flows accept a code through `oauth.complete`.
The client must follow each integration's declared method and instructions.
The client also supports external connection methods, command connection attempts, and credential management.

Standalone generation uses the server global configuration, rather than the selected project configuration.
The image endpoint accepts image models, rather than chat models that also advertise image output.
The current text route is `/api/experimental/generate/text`.
OpenCode 2.1.4 uses the older `/api/experimental/generate` route.

Source: [integration protocol](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/protocol/src/groups/integration.ts).

## Config, MCP, LSP, and formatters

`config.get({ location? })` returns `ConfigEntry[]`.
Entries describe config documents or directories.
Document entries expose their path and parsed `info`.
They do not represent one flattened merged config object.

Current config mutation is limited to `experimental.config.update({ shell: string | null })`.
Version 2.1.4 exposes the equivalent operation as `config.update`.
There is no general configuration patch endpoint for arbitrary settings.
`location.reload()` rebuilds every loaded location and returns no content.
Reload cancels pending permissions and forms.

`mcp.list({ location? })` returns `{ location, data: McpServer[] }`.
Status includes connected, pending, disabled, failed, and needs-auth states.
`mcp.resource.catalog` exposes resources and resource templates.
Experimental MCP methods add, remove, connect, and disconnect servers.
The current SDK moves those operations under `experimental.mcp` and preserves deprecated aliases.
Version 2.1.4 uses the direct `mcp` methods.

The current protocol has no LSP status or formatter status endpoint.
Config documents expose their `lsp` and `formatter` settings.
The app cannot claim runtime LSP or formatter health from those settings.

## Files, projects, and worktrees

| SDK method | Contract |
| --- | --- |
| `file.list` | `GET /api/fs/list`, with location and path |
| `file.find` | `GET /api/fs/find`, with query and location |
| `file.read` | `GET /api/fs/read/{path}`, returns `Uint8Array` |
| `project.list` | `GET /api/project` |
| `project.update` | `PATCH /api/project/{projectID}` |
| `worktree.list` | `GET /api/worktree?projectID=...` |
| `worktree.create` | `POST /api/worktree`, body `{ projectID, from?, branch?, directory?, name? }` |
| `worktree.remove` | `DELETE /api/worktree` |
| `worktree.refresh` | `POST /api/worktree/refresh` |
| `vcs.get`, `vcs.status`, `vcs.diff`, `vcs.branch.list` | Repository state and changes at a location |

Worktree creation is server-side Git work.
Session moves accept a directory and optional delivery mode.
The app must use the returned canonical location for subsequent scoped operations.

## PTY WebSockets

PTY management uses `pty.list`, `create`, `get`, `update`, and `remove`.
The ordinary PTY is scoped to a location.
`pty.create` accepts command, args, cwd, title, and environment.
`pty.update` accepts title or `size: { rows, cols }`.

The SDK does not open the WebSocket through an HTTP request method.
A client first requests a short-lived, single-use ticket.

```ts
const token = await client.pty.connect.token({
  ptyID,
  location: { directory },
  'x-opencode-ticket': '1',
})
const url = new URL(`api/pty/${encodeURIComponent(ptyID)}/connect`, `${baseUrl}/`)
url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
url.searchParams.set('location[directory]', directory)
url.searchParams.set('ticket', token.data.ticket)
url.searchParams.set('cursor', String(cursor))
const socket = new WebSocket(url.toString())
socket.binaryType = 'arraybuffer'
```

The ticket endpoint requires `x-opencode-ticket: 1`.
The WebSocket URL uses the same canonical directory as the ticket request.
The ticket replaces credentials in the upgrade request.
The client can supply an output cursor to resume retained output.
The ordinary PTY cursor counts JavaScript UTF-16 code units, rather than UTF-8 bytes.
The server advances it with `chunk.length` and slices the retained string at that position.
Outbound terminal chunks contain raw UTF-8 text.
A binary frame that starts with byte zero contains JSON `{ cursor }` after that byte.
That frame updates the output cursor after replay.
Input frames contain raw terminal input, rather than JSON commands.
Resize uses the HTTP update method.

Persistent PTYs use separate experimental routes and a distinct attachment protocol.
The server capability flag determines support.
This client supports both ordinary shells and session-owned desktop persistent PTYs.
The installed 2.1.4 fixture reports `capabilities.persistentPty: true`.
Ordinary PTYs remain in memory and stop when their workspace service closes.

Persistent connections start from a snapshot checkpoint and `snapshot.info.output.tail`.
Binary frames contain output bytes. Text frames contain attachment, replay, resize, ownership, or exit events.
Persistent output positions count bytes, unlike ordinary PTY positions.
The client starts as an observer and sends no input until the user selects **Take control**.
Control and input frames contain a type byte, two 16-bit dimensions, and optional UTF-8 input bytes.
The client restores resize checkpoints in the server event order.

Sources: [PTY protocol routes](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/protocol/src/groups/pty.ts), [official WebSocket client](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/client/src/solid/pty.ts), [wire frames](https://github.com/anomalyco/opencode/blob/3eb834b85ac064d07a1d58044f0c7aa9d78f27b5/packages/core/src/pty/protocol.ts).

Cursor and lifetime source: [ordinary PTY service](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/core/src/pty.ts).
Persistent sources: [server transport](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/server/src/handlers/persistent-pty.ts), [TUI snapshot recovery](https://github.com/anomalyco/opencode/blob/v2.2.1/packages/tui/src/component/terminal-pane.tsx).

## Minimal mobile strategy

Use the official Promise client and generated types.
Keep one client per server connection.
Supply Expo fetch for REST and SSE.
Use one reconnect loop and refresh selected state after `server.connected`.
Keep list pagination, message unions, and location envelopes in their official forms.
Use exact SDK methods for permissions, forms, models, integrations, files, and PTYs.
Check optional server capabilities before persistent terminal features.
Treat LSP and formatter data as configuration, because no status endpoint exists.
Keep experimental operations behind explicit user actions.

These findings establish protocol behavior from official source.
They do not establish physical iOS or Android runtime compatibility.
Device checks must cover streaming, suspension, credential persistence, browser OAuth return, and terminal input.

## Executable verification

`tests/live-server.ts` starts the installed OpenCode binary with isolated XDG data, config, cache, and state directories.
It uses a temporary Git project and reads the generated server password without console output.
It does not copy user credentials or configure a model provider.

I ran this test against OpenCode 2.1.4.
I verified these operations:

- Authentication rejection and single-use pairing
- Location resolution and project membership
- Session creation, list, title changes, archive, and restore
- Session events and real shell message events through SSE
- Shell message history, pagination, and fork history
- Prompt queues and cancellation without provider execution
- Binary file reads, writes, search, and Git diffs
- PTY tickets, WebSocket output, resize, and input

I also ran the extended test against the official OpenCode 2.2.1 binary.
I downloaded that binary into `/tmp` and verified its archive against the release SHA256 file.
I preserved the installed OpenCode binary.
The [official release](https://github.com/anomalyco/opencode/releases/tag/v2.2.1) supplies the binary and checksum file.

On version 2.2.1, I also verified these operations:

- Instruction JSON values through save, read, and remove
- Form conditions, hidden defaults, and completed answers
- Permission replies, saved approvals, updates, and revocation
- Schedules through create, list, pause, read, resume, and delete
- Usage limits for an account without credentials

The schedule test enables `experimental.schedules` in the isolated configuration.
It uses a future interval and deletes the schedule before any prompt runs.
Version 2.1.4 skips schedule and usage tests because those endpoints are absent.

The script reports model inference and provider OAuth as skipped.
Normal runs remove sessions, PTYs, the temporary project, and the server process.
The `--fixture` mode retains the isolated server for browser checks until termination.
