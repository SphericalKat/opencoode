import assert from 'node:assert/strict';

function visibleTextColors(element) {
  const colors = new Set();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const range = document.createRange();
    range.selectNodeContents(node);
    if (node.textContent.trim() && range.getClientRects().length) {
      colors.add(getComputedStyle(node.parentElement).color);
    }
  }
  return [...colors];
}

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const page = await browser.newPage();
const origin = process.env.UI_TEST_ORIGIN || 'http://localhost:8095';
await page.route(`${origin}/`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div><script src="/tests/fixtures/themed-code.bundle?platform=web&dev=true&hot=false&lazy=false"></script>' }));
await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedCode = text; } }, configurable: true }); });
await page.goto(origin);
await page.getByText('const answer', { exact: false }).waitFor();
const code = page.getByText('const answer', { exact: false }).last();
assert.equal(await code.innerText(), 'const answer = "hello";\n');
const colors = await code.evaluate(visibleTextColors);
assert.ok(colors.length >= 2, 'explicit JavaScript uses distinct syntax colors');
const plain = page.getByText('const plain', { exact: false }).last();
assert.equal(await plain.innerText(), 'const plain = "hello";\n');
assert.equal((await plain.evaluate(visibleTextColors)).length, 1, 'unknown languages use one visible text color');
await page.getByRole('button', { name: 'Copy code' }).nth(1).click();
assert.equal(await page.evaluate(() => window.copiedCode), 'const plain = "hello";\n');
await page.getByRole('button', { name: 'Copy code' }).first().click();
assert.equal(await page.evaluate(() => window.copiedCode), 'const answer = \"hello\";\n');
assert.equal(await code.evaluate(el => getComputedStyle(el).userSelect), 'text');
await code.evaluate(el => { const range = document.createRange(); range.selectNodeContents(el); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); });
assert.equal(await page.evaluate(() => getSelection().toString()), 'const answer = \"hello\";');
await browser.close();
