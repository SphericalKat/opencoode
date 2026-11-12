# Tool-result images

Tool-result images appear beneath tool activity, independently of the tool details and completed activity group disclosures. Thumbnails wrap in result order. Select a thumbnail to open the image viewer; unavailable sources offer a retry and Download (Save or share on native). The fallback is disabled while an image request is running and preserves access to the original file when its bytes cannot be decoded as an image. Text and other file attachments remain in tool details.

Pi mobile protocol 1 now optionally includes `content` on completed/error tool activity events. This carries images before the corresponding conversation message arrives. Older extensions still work: their images become available with the `toolResult` message. Reopened conversations use the persisted result message. Updating the app and the Pi mobile extension enables the earlier preview.

## Browser integration check

The fixture renders the production `AssistantTurn`, artifact viewer, theme, fonts, safe-area, keyboard, and sheet providers. It is a separate Metro entry under `tests/fixtures/`, with no product navigation route. The test also exercises the OpenCode and Pi clients and conversation backends against controlled HTTP/SSE responses, including live success/error results and restored histories.

Install Playwright separately from the app dependencies:

```sh
npm install --prefix /tmp/opencoode-browser-tests playwright
/tmp/opencoode-browser-tests/node_modules/.bin/playwright install chromium
```

Start the Expo development server in one terminal:

```sh
pnpm exec expo start --web --port 8094 --max-workers 2
```

Run the check in another terminal:

```sh
PLAYWRIGHT_MODULE=/tmp/opencoode-browser-tests/node_modules/playwright/index.mjs \
  node tests/tool-result-images.browser.mjs
```

Set `CHROME_PATH` to use an existing Chromium binary. Set `UI_TEST_ORIGIN` if using another server port. Screenshots are written to `/tmp/opencoode-40-ui` by default; set `UI_SCREENSHOTS` to choose another directory.

The check verifies automatic single/multiple previews, both disclosure levels, tool association, result order at 360 px, no overflow at 240 px, a larger dismissible viewer, MIME changes, text/non-image artifacts, loading, unavailable sources, and retry recovery. It also checks that the fallback waits for an in-flight request and that an undecodable image downloads with its original filename and exact bytes before its preview is retried successfully. It does not require a live coding agent or a model API key. Native device rendering and sharing still require device validation.

## Visual evidence

The captured image used by the fixture is the existing `docs/screenshots/chat-web.png` screenshot.

- [Single image](screenshots/tool-result-single.png)
- [Multiple images on a narrow screen](screenshots/tool-result-multiple.png)
- [Expanded viewer](screenshots/tool-result-expanded.png)
- [Loading](screenshots/tool-result-loading.png)
- [Unavailable image with retry](screenshots/tool-result-unavailable.png)

## Recorded validation (2026-11-12)

The browser integration check passed all scenarios above in Chromium, using the production components with synthetic tool results. The five screenshots were visually inspected. No native simulator or physical-device validation was performed.

The review regression test first failed because an undecodable thumbnail exposed no Download action. After adding the fallback, the complete browser integration check passed, including the byte-for-byte download and loading/HTTP 404/retry scenarios.

The existing Node suite reported **31 passed, 4 failed**, matching the baseline before this change. The failures concern reasoning timestamps and three connection/pairing recovery expectations. **`pnpm typecheck` passes.** The three tool-content narrowing errors in `ToolCallDetails.tsx` were resolved during the image implementation. Follow-up fixes use FlashList's public scroll method, remove an event case unsupported by the installed client, and explicitly type model preference fallback arrays. The full repository test suite retains its four baseline failures.
