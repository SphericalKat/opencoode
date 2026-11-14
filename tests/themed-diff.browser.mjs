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
const old = page.getByText("old", { exact: true });
const added = page.getByText("new", { exact: true });
await old.waitFor({ timeout: 10_000 });
const numberColor = (code) =>
  code.evaluate((el) => {
    const number = [...el.parentElement.querySelectorAll("*")].find(
      (node) => node.children.length === 0 && /^\d+$/u.test(node.textContent)
    );
    return getComputedStyle(number).color;
  });
assert.notEqual(await numberColor(old), await numberColor(added));
assert.equal(await page.getByText("@@", { exact: false }).count(), 0);
await browser.close();
