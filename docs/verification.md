# API verification

Verification date: October 29, 2026.

This document records checks completed before the later instruction to stop tests.
It does not request additional checks.

## Earlier automated checks

I ran `npm run typecheck` after the settings review fixes.
It passed.
I also ran `npm test`.
All 29 tests passed at this point.

The tests cover these contracts:

- URL validation, Basic authentication, and pairing with a server path prefix
- Chat deltas, tool results, command input, and message pagination
- Form defaults, conditions, values, formats, and external acknowledgments
- Schedule input validation
- Config syntax and protection against stale file writes
- Terminal input, resize validation, and cursor recovery
- UTF-8 edits, byte-order marks, file size limits, and write failures

## Real server checks

I ran `npm run test:live` against the installed OpenCode 2.1.4 binary.
I also ran it against an official OpenCode 2.2.1 binary in `/tmp`.
I verified the downloaded archive against the checksum from the official release.
I did not replace the installed binary.

Each run used a new Git project and isolated config, data, cache, and state directories.
The script read the generated server password without console output.
It removed the temporary server, sessions, terminals, and project after the run.

Both versions passed these checks:

- Password rejection and single-use pairing
- Directory resolution and project membership
- Session creation, list, rename, archive, and restore
- Session and shell events through the actual SSE stream
- Shell execution, message history, pagination, and fork history
- Queued prompts and cancellation without model execution
- Instruction JSON values through save, read, and remove
- Forms with conditional fields and hidden defaults through reply
- Permission requests, persistent approval, update, and revocation
- File read, write, search, and Git diff
- PTY tickets, WebSocket output, resize, and terminal input

Version 2.2.1 also passed these checks:

- Schedule creation, list, pause, read, resume, and deletion
- Usage limits for an account without credentials

The schedule test enabled `experimental.schedules` in the isolated configuration.
It set a future interval and deleted the schedule before any prompt ran.
Version 2.1.4 lacks the schedule and usage endpoints, so the script skipped those checks.

I also read the remaining settings APIs on version 2.1.4.
Those requests succeeded.
I did not change real user credentials.

I ran `npx tsx tests/live-persistent-terminal.ts` against the isolated 2.1.4 fixture.
I verified persistent terminal creation, session membership, observer attachment, explicit control, UTF-8 input, byte positions, snapshot recovery, resize, and screen reads.
I verified that reconnect did not repeat prior Unicode output.
The test used the same frame and URL helpers as the mobile client.
It removed only its own terminal and session.

I also verified ordinary PTY recovery with `α🙂世界` output.
The server position matched JavaScript string lengths, and reconnect did not repeat that output.

## Review fixes

I added a guard before configuration edits can disappear through navigation.
I blocked edits and sheet closure during a config save.
I added readable notices for newer endpoints on an older server.
I requested image models explicitly and excluded chat models from the image endpoint picker.
I added a notice about the global configuration that standalone generation uses.

## Opt-in inference check

`tests/live-inference.ts` lists model prices and connections by default.
The `--run` argument enables one short prompt through an existing connection.
The script preserves global configuration and credentials.
It removes only its own session, temporary project, and server.

I made three narrow prompt attempts without attachments or tools.
The initial free model attempt failed before an assistant response.
The second attempt returned `provider.free-limit` with HTTP 429.
The connected OpenCode Go model returned `provider.auth` with HTTP 401 because its API key expired.
I did not renew credentials or retry after that error.

These attempts did not verify the reducer against a real stream of text deltas.
The script checks that comparison when a provider completes a response.

I separately read a real assistant response from the isolated browser fixture.
It used `opencode/big-pickle`, completed with `finish: stop`, and stored 371 text characters.
The server recorded a cost of zero for that response.
That record verifies actual inference separately from the failed automated prompt checks.

## Limits

The provider-free API suite did not invoke model inference or provider OAuth.
It did not spend provider credits or use simulated providers.
The API checks did not establish physical phone behavior, background delivery, or OAuth return behavior.

The [native record](native-verification.md) records secure credential restoration, live sessions, file saves, and terminal input on simulators and emulators.
It also states the remaining keyboard, device, and distribution limits.
The [mobile UX record](mobile-ux.md) records browser layout evidence separately.
The [API research](api-research.md) records the source contracts and version differences.
