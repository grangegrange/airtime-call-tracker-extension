// Generates store screenshots (popup + 1280x800 landing composites) from the
// built extension. Requires Playwright and its Chromium browser:
//
//   npm i -D playwright && npx playwright install chromium
//   npm run build           # first build dist/chrome
//   node tools/make-screenshots.js
//
// Output goes to docs/store/screenshots/. The popup shots are rendered from the
// real popup code with seeded demo data; the 1280x800 composites wrap them for
// the Chrome Web Store. The toolbar badge is browser chrome, so it is NOT
// captured here — see docs/PUBLISHING.md.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const EXT = path.join(ROOT, "dist", "chrome");
const ICON = path.join(ROOT, "icons", "icon128.png");
const OUT = path.join(ROOT, "docs", "store", "screenshots");

const MIN = 60000;
const now = Date.now();

const hist = (platform, room, url, minutes, reason, ago, joined) => {
  const end = now - ago * MIN;
  const start = end - minutes * MIN;
  return { platform, room, url, start, joinedAt: joined ? start + 20000 : null, end, durationMs: minutes * MIN, reason };
};

const SEED = {
  activeSessions: {
    12345: { platform: "jitsi", room: "weekly-sync", url: "https://meet.jit.si/weekly-sync", start: now - 26 * MIN, joinedAt: now - 25 * MIN, lastSeen: now },
  },
  history: [
    hist("gmeet", "abc-defg-hij", "https://meet.google.com/abc-defg-hij", 47, "left-call", 180),
    hist("zoom", "ID 9876543210", "https://zoom.us/j/9876543210", 32, "tab-closed", 320),
    hist("teams", "Meeting", "https://teams.microsoft.com/l/meetup-join/19%3ameeting", 18, "navigated-away", 470),
    hist("jitsi", "standup", "https://meet.jit.si/standup", 12, "left-call", 600, true),
    hist("gmeet", "xyz-wvut-srq", "https://meet.google.com/xyz-wvut-srq", 55, "browser-closed", 900),
  ],
};

const BULLETS = [
  ["Jitsi Meet", "with precise join/leave detection"],
  ["Google Meet · Zoom · MS Teams", "tracked automatically"],
  ["100% private", "no servers, no accounts, all local"],
  ["CSV export", "for billing & timesheets"],
];

const compositeHTML = (iconB64, popupB64) => `<!doctype html><html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{width:1280px;height:800px;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;overflow:hidden;}
  .left{flex:1;padding:72px 40px 72px 72px;display:flex;flex-direction:column;justify-content:center;}
  .logo{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
  .logo img{width:56px;height:56px;border-radius:14px;background:#fff;padding:8px;}
  .logo h1{font-size:46px;font-weight:800;letter-spacing:-0.02em;}
  .tag{font-size:19px;opacity:0.92;margin-bottom:38px;}
  .bullet{display:flex;gap:12px;align-items:flex-start;margin-bottom:18px;}
  .dot{width:10px;height:10px;border-radius:50%;background:#c7d2fe;margin-top:7px;flex:0 0 auto;}
  .b-title{font-size:21px;font-weight:600;}
  .b-sub{font-size:15px;color:#e0e7ff;}
  .foot{margin-top:28px;font-size:14px;opacity:0.85;}
  .right{flex:0 0 auto;padding:26px 56px 26px 8px;display:flex;align-items:center;}
  .pop{background:#fff;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,0.35);overflow:hidden;}
  .pop img{display:block;height:700px;width:auto;}
</style></head><body>
  <div class="left">
    <div class="logo"><img src="data:image/png;base64,${iconB64}"/><h1>Airtime</h1></div>
    <div class="tag">Call Time Tracker</div>
    ${BULLETS.map((b) => `<div class="bullet"><div class="dot"></div><div><div class="b-title">${b[0]}</div><div class="b-sub">${b[1]}</div></div></div>`).join("")}
    <div class="foot">Free & open source · MIT license</div>
  </div>
  <div class="right"><div class="pop"><img src="data:image/png;base64,${popupB64}"/></div></div>
</body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const icon = fs.readFileSync(ICON).toString("base64");

  const ctx = await chromium.launchPersistentContext("", {
    channel: "chromium",
    headless: true,
    deviceScaleFactor: 2,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });

  let extId = null;
  for (let i = 0; i < 50 && !extId; i++) {
    for (const sw of ctx.serviceWorkers()) {
      const m = sw.url().match(/^chrome-extension:\/\/([^/]+)\//);
      if (m && sw.url().includes("background.js")) { extId = m[1]; break; }
    }
    if (!extId) await new Promise((r) => setTimeout(r, 200));
  }
  if (!extId) throw new Error("extension service worker not found");

  const sw = ctx.serviceWorkers()[0];
  await sw.evaluate((d) => chrome.storage.local.set(d), SEED);

  const page = await ctx.newPage();
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`chrome-extension://${extId}/popup.html`);
  await page.waitForTimeout(1500);

  const fit = async (name) => {
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewportSize({ width: 360, height: h });
    await page.screenshot({ path: path.join(OUT, name) });
  };

  await fit("popup-active.png");

  await sw.evaluate(() => chrome.storage.local.remove("activeSessions"));
  await page.waitForTimeout(1500);
  await fit("popup-history.png");
  await page.close();

  // 1280x800 landing composites for the Chrome Web Store
  const activeB64 = fs.readFileSync(path.join(OUT, "popup-active.png")).toString("base64");
  const histB64 = fs.readFileSync(path.join(OUT, "popup-history.png")).toString("base64");

  const comp = await ctx.newPage();
  await comp.setViewportSize({ width: 1280, height: 800 });
  await comp.setContent(compositeHTML(icon, activeB64));
  await comp.waitForTimeout(200);
  await comp.screenshot({ path: path.join(OUT, "cws-active-1280x800.png") });

  await comp.setContent(compositeHTML(icon, histB64));
  await comp.waitForTimeout(200);
  await comp.screenshot({ path: path.join(OUT, "cws-history-1280x800.png") });

  await ctx.close();
  console.log("screenshots written to docs/store/screenshots/");
})().catch((e) => { console.error(e); process.exit(1); });
