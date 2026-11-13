// Run against `expo start --web --port 8094`; install Playwright in a separate tooling directory.
// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs CHROME_PATH=/path/to/chrome node tests/tool-result-images.browser.mjs
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";

import { verifyBackendImages } from "./tool-result-backends.browser.mjs";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
});
const page = await browser.newPage({
  colorScheme: "dark",
  reducedMotion: "reduce",
  viewport: { height: 800, width: 360 },
});
const screenshot = await readFile(
  new URL("../docs/screenshots/chat-web.png", import.meta.url)
);
await page.addInitScript((png) => {
  globalThis.fixtureImage = png;
}, screenshot.toString("base64"));
page.setDefaultTimeout(10_000);
const origin = process.env.UI_TEST_ORIGIN || "http://localhost:8094";
await page.route(`${origin}/**`, (route) =>
  new URL(route.request().url()).pathname === "/"
    ? route.fulfill({
        body: '<html><body style="margin:0"><div id="root"></div><script src="/tests/fixtures/tool-results.bundle?platform=web&dev=true&hot=false&lazy=false"></script></body></html>',
        contentType: "text/html",
      })
    : route.continue()
);
await page.goto(origin);
await page.getByText("The screenshot is ready for review.").waitFor();
await verifyBackendImages(page);
await page
  .getByRole("button", { name: "Expand image preview: Screenshot.png" })
  .waitFor({ timeout: 5000 });
console.log(
  "PASS single tool-result image appears automatically with activity group collapsed"
);
const output = process.env.UI_SCREENSHOTS || "/tmp/opencoode-40-ui";
await mkdir(output, { recursive: true });
await page.screenshot({ fullPage: true, path: `${output}/single.png` });
const small = await page
  .getByRole("img", { exact: true, name: "Screenshot.png" })
  .boundingBox();
await page
  .getByRole("button", { name: "Expand image preview: Screenshot.png" })
  .click();
await page
  .getByRole("img", { exact: true, name: "Expanded Screenshot.png" })
  .waitFor({ timeout: 3000 });
const large = await page
  .getByRole("img", { exact: true, name: "Expanded Screenshot.png" })
  .boundingBox();
assert.ok(
  large.height > small.height * 2,
  "the image opens a substantially larger view"
);
await page.evaluate(() =>
  Promise.all(
    document
      .getAnimations()
      .map((animation) => animation.finished.catch(() => null))
  )
);
await page.screenshot({ fullPage: true, path: `${output}/expanded.png` });
await page.getByRole("button", { exact: true, name: "Done" }).click();
await page
  .getByRole("button", { exact: true, name: "Used 1 screenshot" })
  .click();
await page.getByRole("button", { exact: true, name: "screenshot" }).click();
await page
  .getByText("Screenshot captured successfully", { exact: true })
  .waitFor();
await page.getByText("report.txt", { exact: true }).waitFor();
assert.equal(
  await page
    .getByRole("button", { name: "Expand image preview: Screenshot.png" })
    .count(),
  1,
  "expanded details do not duplicate image artifacts"
);
await page.getByRole("button", { exact: true, name: "screenshot" }).click();
await page
  .getByRole("button", { name: "Expand image preview: Screenshot.png" })
  .waitFor();
await page.evaluate(() => dispatchEvent(new Event("fixture-mime")));
await page.waitForFunction(() =>
  [...document.querySelectorAll("img")].some((image) =>
    image.src.startsWith("data:image/jpeg;")
  )
);
console.log("PASS an image MIME change with the same URI reloads its preview");
console.log(
  "PASS thumbnails survive both disclosure levels, expand into a larger viewer, and retain text/non-image artifacts in details"
);

await page.goto(`${origin}/?scenario=multiple`);
const previews = page.getByRole("button", { name: /Expand image preview:/u });
await previews.nth(2).waitFor();
assert.deepEqual(
  await previews.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label"))
  ),
  [
    "Expand image preview: First.png",
    "Expand image preview: Second.png",
    "Expand image preview: Third.png",
  ]
);
const boxes = await previews.evaluateAll((elements) =>
  elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top };
  })
);
assert.equal(
  boxes[0].top,
  boxes[1].top,
  "two thumbnails share a row on a phone"
);
assert.ok(boxes[2].top > boxes[1].top, "extra thumbnails wrap");
for (const box of boxes) {
  assert.ok(
    box.left >= 0 && box.right <= 360,
    "thumbnails stay inside the viewport"
  );
}
await page.screenshot({ fullPage: true, path: `${output}/multiple.png` });
await page.setViewportSize({ height: 800, width: 240 });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "very narrow screens do not overflow"
);
await page.setViewportSize({ height: 800, width: 360 });
console.log(
  "PASS multiple images retain result order in wrapping rows without narrow-screen overflow"
);

await page.goto(`${origin}/?scenario=tools`);
await page
  .getByRole("button", { name: "Expand image preview: Result.png" })
  .waitFor();
await page.getByText("screenshot", { exact: true }).waitFor();
await page.getByText("Read · /project/result.png", { exact: true }).waitFor();
console.log(
  "PASS images from multiple collapsed tools retain their tool association"
);

let finishLoading;
await page.route(`${origin}/fixture-image.png`, async (route) => {
  const loading = Promise.withResolvers();
  finishLoading = loading.resolve;
  await loading.promise;
  await route.fulfill({ body: "Missing", status: 404 });
});
await page.goto(`${origin}/?scenario=loading`);
await page.getByText("Loading image…", { exact: true }).waitFor();
assert.equal(
  await page
    .getByRole("button", { exact: true, name: "Download" })
    .isDisabled(),
  true,
  "the fallback waits for the in-flight image request"
);
await page.getByText("The screenshot is ready for review.").waitFor();
await page.screenshot({ fullPage: true, path: `${output}/loading.png` });
finishLoading();
await page.getByText("Image unavailable", { exact: true }).waitFor();
await page.getByRole("button", { exact: true, name: "Retry image" }).waitFor();
await page.screenshot({ fullPage: true, path: `${output}/unavailable.png` });
await page.unroute(`${origin}/fixture-image.png`);
await page.route(`${origin}/fixture-image.png`, (route) =>
  route.fulfill({ body: screenshot, contentType: "image/png" })
);
await page.getByRole("button", { exact: true, name: "Retry image" }).click();
await page
  .getByRole("button", { name: "Expand image preview: Screenshot.png" })
  .waitFor();
console.log(
  "PASS loading/unavailable images leave the conversation usable and retry recovers"
);

await page.unroute(`${origin}/fixture-image.png`);
const originalBytes = Buffer.from(
  "An image attachment whose format cannot be decoded."
);
await page.route(`${origin}/fixture-image.png`, (route) =>
  route.fulfill({ body: originalBytes, contentType: "image/png" })
);
await page.goto(`${origin}/?scenario=undecodable`);
await page
  .getByText("This image cannot be displayed.", { exact: false })
  .waitFor();
await page.getByRole("button", { exact: true, name: "Retry image" }).waitFor();
const downloadButton = page.getByRole("button", {
  exact: true,
  name: "Download",
});
await downloadButton.waitFor();
const downloadedFile = page.waitForEvent("download");
await downloadButton.click();
const download = await downloadedFile;
assert.equal(download.suggestedFilename(), "Screenshot.png");
assert.deepEqual(
  await readFile(await download.path()),
  originalBytes,
  "undecodable tool-result images retain their original downloadable bytes"
);
await page.unroute(`${origin}/fixture-image.png`);
await page.route(`${origin}/fixture-image.png`, (route) =>
  route.fulfill({ body: screenshot, contentType: "image/png" })
);
await page.getByRole("button", { exact: true, name: "Retry image" }).click();
await page
  .getByRole("button", { name: "Expand image preview: Screenshot.png" })
  .waitFor();
console.log(
  "PASS undecodable images retain Download with original bytes and can retry their preview"
);
await browser.close();
