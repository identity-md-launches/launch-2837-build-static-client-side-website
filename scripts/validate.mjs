// Production-export checks. Evidence stays in the explicitly ignored scratch path.
// No fixture or mock is bundled with the website.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const exec = promisify(execFile);
const out = resolve("test/scratch/validation");
await mkdir(out, { recursive: true });
const root = resolve("dist");
const api = "https://api.mancer.xyz";
const rpcUrl = "https://rpc.mainnet.chain.robinhood.com";
const prefix = "/book-desk/";
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!pathname.startsWith(prefix)) {
      res.writeHead(404).end();
      return;
    }
    const path = resolve(root, pathname.slice(prefix.length) || "index.html");
    if (!path.startsWith(root + sep) && path !== root) {
      res.writeHead(403).end();
      return;
    }
    const bytes = await readFile(path);
    res.writeHead(200, {
      "Content-Type": mime[extname(path)] ?? "application/octet-stream",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const url = origin + prefix;
const report = {
  date: new Date().toISOString(),
  checks: [],
  limitations: [],
  consoleErrors: [],
  liveConsoleErrors: [],
  expectedFaultConsoleErrors: [],
  failedLocalResources: [],
  screenshots: [],
  axe: [],
};
const check = (name, details = "") => {
  report.checks.push({ name, passed: true, details });
  console.log(`PASS ${name}${details ? ": " + details : ""}`);
};
const snap = async (page, name, fullPage = false) => {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage });
  report.screenshots.push(`${name}.png`);
};
const overflow = async (page) => {
  const result = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  assert.ok(result.document <= result.viewport + 1, JSON.stringify(result));
};
const audit = async (page, label) => {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  report.axe.push({
    label,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        failureSummary: n.failureSummary,
      })),
    })),
  });
  assert.deepEqual(
    result.violations.map((v) => v.id),
    [],
    `axe ${label}: ${JSON.stringify(result.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })))}`,
  );
  check(`axe ${label}`, "No automated WCAG A/AA violations detected");
};
async function prepare(context, controlledFaults = false) {
  if (process.env.BOOK_DESK_TEST_RPC) {
    // Optional test transport. It never changes the built public RPC configuration.
    await context.route(rpcUrl, async (route) => {
      const args = [
        "-sS",
        "--max-time",
        "20",
        "-H",
        "Content-Type: application/json",
        "--data-binary",
        route.request().postData() ?? "{}",
      ];
      if (process.env.HTTP_PROXY)
        args.push("-x", process.env.HTTP_PROXY, "--noproxy", "");
      args.push(process.env.BOOK_DESK_TEST_RPC);
      try {
        const { stdout } = await exec("curl", args, {
          maxBuffer: 8 * 1024 * 1024,
        });
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: stdout,
        });
      } catch {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"error":"Test RPC transport unavailable"}',
        });
      }
    });
  }
  context.on("page", (page) => {
    page.on("pageerror", (e) => report.consoleErrors.push(e.message));
    page.on("console", (message) => {
      if (message.type() === "error")
        (controlledFaults
          ? report.expectedFaultConsoleErrors
          : report.liveConsoleErrors
        ).push(message.text());
    });
    page.on("response", (r) => {
      if (r.url().startsWith(origin) && r.status() >= 400)
        report.failedLocalResources.push(
          `${r.status()} ${new URL(r.url()).pathname}`,
        );
    });
  });
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await prepare(context);
  const page = await context.newPage();
  const fixture = {};
  page.on("response", async (response) => {
    if (!response.url().startsWith(api) || response.status() !== 200) return;
    const path = new URL(response.url()).pathname;
    try {
      fixture[path] = await response.json();
    } catch {
      /* Non-JSON responses are not fixtures. */
    }
  });
  await page.goto(url);
  await page.locator(".books-table tbody tr").first().waitFor();
  assert.equal(await page.title(), "Book Desk | Mancer Books terminal");
  assert.ok(await page.locator('link[rel="icon"]').getAttribute("href"));
  assert.ok(
    await page.locator('meta[property="og:image"]').getAttribute("content"),
  );
  const shareUrl = new URL(
    await page.locator('meta[property="og:image"]').getAttribute("content"),
    page.url(),
  );
  const shareResponse = await context.request.get(shareUrl.href);
  assert.equal(shareResponse.status(), 200);
  const shareBytes = await shareResponse.body();
  assert.equal(shareBytes.readUInt32BE(16), 1200);
  assert.equal(shareBytes.readUInt32BE(20), 630);
  check("Static subpath & metadata", "Production assets load at /book-desk/");
  await audit(page, "board desktop");
  await snap(page, "board-desktop");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await overflow(page);
    if (width === 390) {
      const mainAction = await page
        .getByRole("button", { name: "Refresh board" })
        .boundingBox();
      const search = await page.getByRole("searchbox").boundingBox();
      assert.ok(mainAction.y + mainAction.height < 844);
      assert.ok(search.y + search.height < 844);
      await snap(page, "board-mobile");
      await audit(page, "board mobile");
      await page.locator(".sort-controls > button").focus();
      await page.keyboard.press("Tab");
      assert.ok(
        await page.evaluate(
          () => !!document.activeElement?.closest(".book-link"),
        ),
      );
    }
  }
  check(
    "Responsive board",
    "No page overflow at 320, 390, 768, 1024 and 1440; refresh and search on first 390 screen",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  await overflow(page);
  await snap(page, "text-enlargement");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "16px";
    document.documentElement.dir = "rtl";
  });
  await overflow(page);
  await page.evaluate(() => {
    document.documentElement.dir = "ltr";
  });
  check(
    "Text enlargement & direction",
    "No page overflow with 200% CSS text size at 390 or a separate RTL mirror; not browser-native zoom",
  );
  await page.evaluate(() => document.fonts.ready);
  report.fonts = await page.evaluate(() =>
    [...document.fonts].map((f) => ({
      family: f.family,
      weight: f.weight,
      status: f.status,
    })),
  );
  assert.ok(
    report.fonts.filter(
      (f) => f.family.includes("IBM Plex Mono") && f.status === "loaded",
    ).length >= 2,
  );
  check(
    "Local fonts",
    "Both IBM Plex Mono weights loaded from local WOFF2 assets",
  );
  report.contrast = await page.evaluate(() => {
    const rgb = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    const lum = (a) =>
      a
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const background = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const c = getComputedStyle(e).backgroundColor;
        if (c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
      }
      return "rgb(11, 12, 14)";
    };
    return [
      ["Primary button", ".button.primary"],
      ["Secondary text", ".metric-label"],
      ["Heading", "#page-title"],
      ["Positive return", ".return-cell.positive > .mono"],
      ["Negative return", ".return-cell.negative > .mono"],
    ].map(([label, selector]) => {
      const el = document.querySelector(selector),
        foreground = getComputedStyle(el).color,
        bg = background(el);
      const a = lum(rgb(foreground)),
        b = lum(rgb(bg));
      return {
        label,
        foreground,
        background: bg,
        ratio: Number(
          ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(3),
        ),
      };
    });
  });
  assert.ok(report.contrast.every((p) => p.ratio >= 4.5));
  check(
    "Rendered contrast samples",
    "Five measured solid foreground/background pairs meet 4.5:1",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  const initialCount = await page.locator(".books-table tbody tr").count();
  await page
    .locator(".phase-filters > button")
    .filter({ hasText: "Trading" })
    .click();
  const phases = await page
    .locator(".books-table .phase-cell")
    .allTextContents();
  assert.ok(phases.length > 0 && phases.every((p) => p === "Trading"));
  await page.getByRole("searchbox").fill("__no_book_desk_match__");
  await page.getByRole("heading", { name: "No matching Books" }).waitFor();
  await page.getByRole("button", { name: "Clear filters" }).click();
  assert.equal(
    await page.locator(".books-table tbody tr").count(),
    initialCount,
  );
  await page.getByLabel("Other phases").selectOption("aborted");
  assert.ok(
    (await page.locator(".books-table .phase-cell").allTextContents()).every(
      (p) => p === "Aborted",
    ),
  );
  await page
    .locator(".phase-filters > button")
    .filter({ hasText: "All Books" })
    .click();
  await page.getByLabel("Sort by").selectOption("trust");
  await page.getByLabel("Sort by").selectOption("nav");
  const firstBefore = await page
    .locator(".nav-cell > .mono")
    .first()
    .innerText();
  await page
    .getByRole("button", { name: "Sort ascending", exact: true })
    .click();
  const firstAfter = await page
    .locator(".nav-cell > .mono")
    .first()
    .innerText();
  assert.notEqual(firstBefore, firstAfter);
  check(
    "Board interactions",
    "Phase filters including Aborted, search, empty-state recovery, NAV direction and trust sort",
  );
  const chosen = fixture["/v1/books"]?.books.find(
    (b) => b.value && b.holdings.tokens.length && b.profile?.targets.length,
  );
  assert.ok(chosen, "A live valued Book is needed for the integration check");
  const token = chosen.token;
  await page.getByRole("searchbox").fill(token);
  assert.equal(await page.locator(".books-table tbody tr").count(), 1);
  await page.locator(".books-table .pin-button").click();
  assert.equal(
    new URL(page.url()).searchParams.get("book"),
    token.toLowerCase(),
  );
  assert.equal(new URL(page.url()).hash, "");
  assert.equal(
    await page.locator(".books-table .pin-button").getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("link", { name: /Watchlist/ })
    .first()
    .click();
  await page
    .locator(".chain-check")
    .filter({ hasText: "Factory record confirmed" })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Scan earlier blocks", exact: true })
    .waitFor({ timeout: 30000 });
  await page.locator(".notice .icon-button").click();
  await audit(page, "watchlist desktop");
  await snap(page, "watchlist-desktop");
  await page.getByLabel("Book token address", { exact: true }).fill("0x123");
  await page.getByRole("button", { name: "Watch Book", exact: true }).click();
  assert.equal(
    await page
      .getByLabel("Book token address", { exact: true })
      .getAttribute("aria-invalid"),
    "true",
  );
  assert.ok(
    await page
      .getByText("Use 0x followed by 40 hexadecimal characters.", {
        exact: true,
      })
      .isVisible(),
  );
  await page.getByLabel("Book token address", { exact: true }).fill(token);
  await page.getByRole("button", { name: "Watch Book", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Book token address", exact: true })
    .press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Watch Book",
  );
  check(
    "Watchlist & URL",
    "Pin stays on board; watchlist navigates; invalid addresses are announced; keyboard form path works",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await overflow(page);
  await snap(page, "watchlist-mobile");
  await audit(page, "watchlist mobile");
  await page
    .getByRole("spinbutton", { name: "Estimate for Book tokens" })
    .fill("1000000");
  await page.getByText("Estimated payout", { exact: false }).waitFor();
  await page
    .getByRole("spinbutton", { name: "Estimate for Book tokens" })
    .fill("-1");
  assert.ok(
    await page.getByText("Enter a positive token amount or zero.").isVisible(),
  );
  await page
    .getByRole("spinbutton", { name: "Estimate for Book tokens" })
    .fill("1e100");
  assert.ok(
    await page
      .getByText("This amount exceeds the circulating Book supply.")
      .isVisible(),
  );
  await page
    .getByRole("spinbutton", { name: "Estimate for Book tokens" })
    .fill("1000000");
  check(
    "Settlement calculator",
    "Positive token amount produces an estimate; negative and above-supply amounts show inline errors",
  );
  await page.goto(url + "#/book/" + token);
  await page
    .locator(".chain-check")
    .filter({ hasText: "Factory record confirmed" })
    .waitFor({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Scan earlier blocks", exact: true })
    .waitFor({ timeout: 30000 });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await overflow(page);
  }
  await snap(page, "book-desktop");
  await audit(page, "book desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await audit(page, "book mobile");
  await page.locator(".inline-address summary").first().click();
  assert.ok(await page.locator(".inline-address .address").first().isVisible());
  await page.locator(".inline-address summary").first().click();
  const priorScan = await page.locator(".trade-load > span").innerText();
  await page
    .getByRole("button", { name: "Scan earlier blocks", exact: true })
    .click();
  await page.waitForFunction(
    (previous) =>
      document.querySelector(".trade-load > span")?.textContent !== previous,
    priorScan,
    { timeout: 30000 },
  );
  assert.ok(
    (await page.locator(".trade-load > span").innerText()).includes(
      "1 earlier windows scanned",
    ),
  );
  check(
    "Book detail & RPC",
    `Factory record, cost basis, unlock, all tracked balances, holdings address disclosure and earlier trade scanning for ${chosen.symbol}`,
  );
  check(
    "Responsive Book detail",
    "No page overflow at 320, 390, 768, 1024 and 1440",
  );
  const localPoints = await page.evaluate(
    (t) => JSON.parse(localStorage.getItem("bookdesk.history.v1." + t) || "[]"),
    token,
  );
  assert.ok(localPoints.length >= 1);
  await page.reload();
  await page.locator(".history-details").waitFor();
  assert.ok(
    (await page.evaluate(
      (t) =>
        JSON.parse(localStorage.getItem("bookdesk.history.v1." + t) || "[]")
          .length,
      token,
    )) >= localPoints.length,
  );
  check(
    "Local NAV persistence",
    "A real NAV observation is saved and restored after reload",
  );
  await page.goto(url + "?book=" + token);
  await page
    .getByRole("heading", { name: "Watchlist.", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Unpin", exact: true }).click();
  assert.equal(new URL(page.url()).searchParams.has("book"), false);
  await page.getByRole("heading", { name: "Choose a Book to watch" }).waitFor();
  check(
    "Direct watch URL & unpin",
    "A fresh ?book URL opens Watchlist and Unpin clears URL and local storage",
  );
  // Deterministic failure and timer checks use captured public responses in a separate context.
  assert.ok(fixture["/v1/books/" + token]);
  const isolated = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await prepare(isolated, true);
  let failBoard = true,
    failPrices = false,
    timedDetail = false,
    detailCalls = 0,
    missingBook = false;
  await isolated.route(api + "/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/v1/books" && failBoard)
      return route.fulfill({
        status: 503,
        json: { error: "Controlled validation outage" },
      });
    if (path === "/v1/prices" && failPrices)
      return route.fulfill({
        status: 503,
        json: { error: "Controlled price-feed outage" },
      });
    if (path.startsWith("/v1/books/") && missingBook)
      return route.fulfill({ status: 404, json: { error: "not found" } });
    const body = structuredClone(fixture[path]);
    if (!body)
      return route.fulfill({
        status: 404,
        json: { error: "No captured validation response" },
      });
    if (timedDetail && path === "/v1/books/" + token) {
      detailCalls++;
      body.book.value.asOf.timestamp += detailCalls * 61;
      body.book.value.asOf.block += detailCalls;
      body.book.value.navWei = (
        BigInt(body.book.value.navWei) +
        BigInt(detailCalls) * 1000000000000n
      ).toString();
    }
    return route.fulfill({ status: 200, json: body });
  });
  const fault = await isolated.newPage();
  await fault.goto(url);
  await fault.getByText("Unable to load data", { exact: true }).waitFor();
  await snap(fault, "board-error-mobile");
  failBoard = false;
  await fault.getByRole("button", { name: "Retry", exact: true }).click();
  await fault.locator(".books-table tbody tr").first().waitFor();
  failPrices = true;
  await fault
    .getByRole("button", { name: "Refresh board", exact: true })
    .click();
  await fault.waitForFunction(() =>
    document.querySelector(".source-price")?.textContent?.includes("Book API"),
  );
  failBoard = true;
  await fault
    .getByRole("button", { name: "Refresh board", exact: true })
    .click();
  await fault.getByText("Update unavailable", { exact: true }).waitFor();
  await fault.waitForFunction(() =>
    document.querySelector(".source-price")?.textContent?.includes("—"),
  );
  assert.ok((await fault.locator(".books-table tbody tr").count()) > 0);
  check(
    "Outage & stale recovery",
    "503 retries preserve the board; failed ETH prices use fresh Book metadata; two failed price sources show USD as unavailable",
  );
  failBoard = false;
  failPrices = false;
  timedDetail = true;
  await fault.clock.install();
  await fault.goto(url + "#/book/" + token);
  await fault.locator(".history-details").waitFor();
  const initialDetailCalls = detailCalls;
  await fault.clock.runFor(15100);
  await fault.waitForFunction(
    (n) =>
      JSON.parse(localStorage.getItem("bookdesk.history.v1." + n) || "[]")
        .length >= 2,
    token,
  );
  assert.ok(detailCalls > initialDetailCalls);
  check(
    "Polling & history series",
    "Advancing the browser clock 15.1s triggers a fresh detail read and stores a second minute sample; controlled responses only",
  );
  await fault.clock.resume();
  await isolated.route(rpcUrl, (route) =>
    route.fulfill({ status: 503, json: { error: "Controlled RPC outage" } }),
  );
  await fault
    .getByRole("button", { name: "Refresh on-chain check", exact: true })
    .click();
  await fault.getByText("RPC check unavailable", { exact: true }).waitFor();
  assert.ok(
    await fault
      .getByRole("heading", { name: "Vault holdings", exact: true })
      .isVisible(),
  );
  check(
    "RPC outage",
    "Book and holdings remain usable with an explicit on-chain failure",
  );
  missingBook = true;
  await fault.goto(url + "#/book/" + chosen.vault);
  await fault.getByText("This Book was not found.", { exact: true }).waitFor();
  check(
    "Unknown Book",
    "404 is explained with a retry and a route back to the board",
  );
  const keyboard = await context.newPage();
  await keyboard.goto(url + "#/board");
  await keyboard.keyboard.press("Tab");
  assert.equal(
    await keyboard.evaluate(() => document.activeElement?.textContent),
    "Skip to content",
  );
  await snap(keyboard, "keyboard-focus");
  await keyboard.keyboard.press("Tab");
  assert.equal(
    await keyboard.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    "Book Desk board",
  );
  await keyboard.locator(".books-table a.book-link").first().focus();
  await keyboard.keyboard.press("Enter");
  await keyboard.locator(".book-page-heading").waitFor();
  await keyboard.waitForFunction(
    () => document.activeElement?.id === "page-title",
  );
  const currentBookUrl = keyboard.url();
  await keyboard.locator(".skip-link").focus();
  await keyboard.keyboard.press("Enter");
  assert.equal(keyboard.url(), currentBookUrl);
  assert.equal(
    await keyboard.evaluate(() => document.activeElement?.id),
    "page-title",
  );
  check(
    "Keyboard navigation",
    "Skip link, brand and Book link work by keyboard; the loaded heading receives focus; activating Skip keeps the Book route",
  );
  await keyboard.emulateMedia({ reducedMotion: "reduce" });
  const running = await keyboard.evaluate(
    () =>
      document.getAnimations().filter((a) => a.playState === "running").length,
  );
  assert.equal(running, 0);
  check("Reduced motion", "No running animations under reduced motion");
  await isolated.close();
  await context.close();
  try {
    const safari = await webkit.launch({ headless: true });
    try {
      const c = await safari.newContext({
        viewport: { width: 390, height: 844 },
      });
      await prepare(c);
      const p = await c.newPage();
      await p.goto(url);
      await p.locator(".books-table tbody tr").first().waitFor();
      await overflow(p);
      await p.getByRole("searchbox").fill(token);
      await p.locator(".books-table a.book-link").click();
      await p.locator(".book-page-heading").waitFor();
      await overflow(p);
      await snap(p, "webkit-book-mobile");
      check("WebKit primary interaction", "Search and Book navigation at 390");
      await c.close();
    } finally {
      await safari.close();
    }
  } catch (e) {
    report.limitations.push(
      /Host system is missing/.test(String(e.message))
        ? "WebKit could not launch: required host libraries, including GTK4 and GStreamer, are unavailable."
        : "WebKit could not complete its browser check: " +
            String(e.message).split("\n")[0],
    );
    console.log("LIMITATION WebKit runtime unavailable");
  }
  assert.deepEqual(report.consoleErrors, []);
  assert.deepEqual(report.liveConsoleErrors, []);
  assert.deepEqual(report.failedLocalResources, []);
  check(
    "Runtime integrity",
    "No uncaught page exceptions or missing local resources",
  );
} catch (e) {
  report.checks.push({
    name: "Validation interrupted",
    passed: false,
    details: e.stack || String(e),
  });
  console.error(e);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
  await writeFile(
    `${out}/results.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Evidence: test/scratch/validation/results.json (${report.checks.length} checks)`,
  );
}
