// End-to-end browser smoke test for the Google Meet precise detector.
// Loads the built extension in headless Chromium, serves a fake meet.google.com
// page via request interception, and drives the "Leave call" control through
// show/hide to verify the full chain: content script → postMessage → bridge →
// background → storage. Requires Playwright + Chromium:
//
//   npm i -D playwright && npx playwright install chromium
//   npm run build
//   node tools/meet-smoke.js
//
// This verifies everything except whether the selectors match *real* Meet's DOM
// (that still needs one live call + tools/meet-probe.js).
const { chromium } = require("playwright");
const path = require("path");

const EXT = path.join(__dirname, "..", "dist", "chrome");
const URL = "https://meet.google.com/abc-defg-hij";

const FAKE = `<!doctype html><html><head><meta charset="utf-8"><title>fake meet</title></head>
<body>
  <div>fake meet page</div>
  <button id="leave" aria-label="Leave call" style="display:none">Leave</button>
</body></html>`;

const assert = (cond, msg) => {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("ok:", msg);
  }
};

(async () => {
  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  await ctx.route("https://meet.google.com/**", (r) =>
    r.fulfill({ contentType: "text/html", body: FAKE })
  );

  let extId = null;
  for (let i = 0; i < 50 && !extId; i++) {
    for (const sw of ctx.serviceWorkers()) {
      const m = sw.url().match(/^chrome-extension:\/\/([^/]+)\//);
      if (m && sw.url().includes("background.js")) {
        extId = m[1];
        break;
      }
    }
    if (!extId) await new Promise((r) => setTimeout(r, 200));
  }
  if (!extId) throw new Error("extension not loaded");
  console.log("extension id:", extId);

  const readState = () =>
    ctx.serviceWorkers()[0].evaluate(() => chrome.storage.local.get(["activeSessions", "history"]));

  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForTimeout(1000); // let the detector attach its MutationObserver

  let s = await readState();
  const session = Object.values(s.activeSessions)[0];
  assert(session?.platform === "gmeet" && session.room === "abc-defg-hij", "gmeet session started by URL detection");
  assert(!session.joinedAt, "not joined while leave control hidden");

  await page.evaluate(() => {
    document.getElementById("leave").style.display = "block";
  });
  await page.waitForTimeout(2500); // MutationObserver is fast; interval fallback is 2s
  s = await readState();
  assert(Object.values(s.activeSessions)[0]?.joinedAt != null, "joinedAt set when leave control appears");

  await page.evaluate(() => {
    document.getElementById("leave").style.display = "none";
  });
  await page.waitForTimeout(2500);
  s = await readState();
  assert(
    s.history.some((h) => h.room === "abc-defg-hij" && h.reason === "left-call"),
    "session ended with left-call when leave control disappears"
  );

  await ctx.close();
  console.log(process.exitCode ? "\nSMOKE FAILED" : "\nAll smoke checks passed.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
