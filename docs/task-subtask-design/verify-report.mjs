import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

// Tests only the offline documentation artifact; never opens the application.
const root = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, colorScheme: "light" });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    await page.locator("h1").waitFor();
    assert.equal(await page.locator("article.document").count(), 7);
    assert.equal(await page.locator("#field-dictionary tbody tr").count(), 28);
    assert.equal(await page.locator("#permission-matrix tbody tr").count(), 17);
    assert.equal(await page.locator("#event-matrix tbody tr").count(), 13);
    assert.equal(await page.locator("#requirement-coverage tbody tr").count(), 12);
    const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    assert(layout.document <= layout.viewport + 1, `Horizontal overflow at ${width}: ${JSON.stringify(layout)}`);
    await page.locator('nav a[href="#doc-06"]').click();
    assert(new URL(page.url()).hash === "#doc-06");
    const planTop = await page.locator("#doc-06").evaluate((element) => element.getBoundingClientRect().top);
    assert(Math.abs(planTop) < 100, `Navigation did not scroll to plan: ${planTop}`);
    await page.locator('#doc-06 a[href="#top"]').click();
    await page.locator('nav a[href="#permission-matrix"]').focus();
    await page.keyboard.press("Enter");
    assert(new URL(page.url()).hash === "#permission-matrix");
    if (width === 390) {
      const canScroll = await page.locator("#permission-matrix .table-wrap").evaluate((element) => {
        element.scrollLeft = 150;
        return element.scrollWidth > element.clientWidth && element.scrollLeft > 0;
      });
      assert(canScroll, "Mobile permission matrix cannot scroll");
    }
    await page.locator('#doc-01 a[href="#top"]').click();
    await page.screenshot({ path: path.join(root, `review-${width === 390 ? "mobile" : "desktop"}.png`) });
    assert.deepEqual(errors, []);
    results.push({ width, height: 1000, documents: 7, fields: 28, permissionActions: 17, eventGroups: 13, promptSections: 12, noPageOverflow: true, navigation: "pass", keyboard: "pass", pageErrors: errors });
    await page.close();
  }
} finally {
  await browser.close();
}
const evidence = { scope: "Offline report QA only, not application E2E", checkedAt: new Date().toISOString(), results };
fs.writeFileSync(path.join(root, "report-verification.json"), JSON.stringify(evidence, null, 2) + "\n", "utf8");
console.log(JSON.stringify(evidence, null, 2));
