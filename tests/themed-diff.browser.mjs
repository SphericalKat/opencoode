import assert from "node:assert/strict";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
});
const page = await browser.newPage();
const origin = process.env.UI_TEST_ORIGIN || "http://localhost:8095";
await page.route(`${origin}/`, (route) =>
  route.fulfill({
    body: '<div id="root"></div><script src="/tests/fixtures/themed-diff.bundle?platform=web&dev=true&hot=false&lazy=false"></script>',
    contentType: "text/html",
  })
);
await page.goto(origin);
const old = page.getByText("-old", { exact: true });
const added = page.getByText("+new", { exact: true });
await old.waitFor({ timeout: 10_000 });
assert.notEqual(
  await old.evaluate((el) => getComputedStyle(el).color),
  await added.evaluate((el) => getComputedStyle(el).color)
);
assert.equal(
  await page
    .getByText("---removed", { exact: true })
    .evaluate((el) => getComputedStyle(el).color),
  await old.evaluate((el) => getComputedStyle(el).color)
);
assert.equal(
  await page
    .getByText("+++added", { exact: true })
    .evaluate((el) => getComputedStyle(el).color),
  await added.evaluate((el) => getComputedStyle(el).color)
);
const patch = await old.evaluate((el) => el.parentElement.textContent);
assert.equal(
  patch,
  "--- a/file\n+++ b/file\n@@ -1,2 +1,2 @@\n context\n-old\n+new\n---removed\n+++added\n\\ No newline at end of file\n"
);
await browser.close();
