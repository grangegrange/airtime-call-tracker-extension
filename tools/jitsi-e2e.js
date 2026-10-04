// End-to-end test of the Jitsi detector against a *real* Jitsi Meet.
//
// Why: content-jitsi-page.js relies on Jitsi internals — window.APP.conference._room
// and the "conference.joined"/"conference.left" events. If Jitsi renames them, the
// extension silently stops counting calls, and no fake page can catch that.
//
// Why our own Jitsi: public meet.jit.si does not let a robot into a call — a
// moderator has to log in first (checked 2026-10-04). So this script starts the
// official docker-jitsi-meet on 127.0.0.1 with auth off, and Chromium resolves
// meet.jit.si to it (--host-resolver-rules). The extension sees the real
// https://meet.jit.si URL its manifest matches; inside is real Jitsi.
//
//   npm run build && npm run e2e:jitsi            # needs docker + playwright chromium
//   KEEP_JITSI=1 npm run e2e:jitsi                # leave the containers running
//
// Leaves nothing exposed: web on 127.0.0.1:443, JVB unpublished.
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");

const JITSI_VERSION = "stable-11248"; // docker-jitsi-meet release, 2026-09-14
const DIR = path.join(__dirname, "jitsi-e2e");
const CACHE = path.join(DIR, ".cache");
const EXT = path.join(__dirname, "..", "dist", "chrome");
const PROJECT = "airtime-jitsi-e2e";
const ROOM = `AirtimeE2E${Date.now()}`;

let failed = false;
const assert = (cond, msg) => {
  console.log(`${cond ? "ok" : "FAIL"}: ${msg}`);
  if (!cond) failed = true;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function compose(...args) {
  const files = ["-f", path.join(CACHE, "docker-compose.yml"), "-f", path.join(DIR, "compose.override.yml")];
  return execFileSync("docker", ["compose", "-p", PROJECT, "--env-file", path.join(CACHE, ".env"), ...files, ...args],
    { stdio: ["ignore", "pipe", "inherit"] }).toString();
}

async function prepare() {
  fs.mkdirSync(CACHE, { recursive: true });
  const yml = path.join(CACHE, "docker-compose.yml");
  if (!fs.existsSync(yml) || !fs.readFileSync(yml, "utf8").includes(JITSI_VERSION)) {
    const url = `https://raw.githubusercontent.com/jitsi/docker-jitsi-meet/${JITSI_VERSION}/docker-compose.yml`;
    fs.writeFileSync(yml, execFileSync("curl", ["-fsSL", url]));
  }
  // Passwords are generated once: prosody registers the focus/jvb users on first
  // start and keeps them in ${CONFIG}, so new passwords would lock jicofo out.
  const envFile = path.join(CACHE, ".env");
  const old = fs.existsSync(envFile) ? Object.fromEntries(fs.readFileSync(envFile, "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])) : {};
  const pw = (k) => old[k] || crypto.randomBytes(16).toString("hex");
  // Every ${CONFIG}/... volume must exist before `up`, owned by us: otherwise
  // docker creates it as root and the containers (uid 1000) refuse to start.
  const config = path.join(CACHE, "config");
  for (const [, d] of fs.readFileSync(yml, "utf8").matchAll(/\$\{CONFIG\}\/([^:\s]+):/g)) {
    fs.mkdirSync(path.join(config, d), { recursive: true });
  }
  fs.writeFileSync(envFile, [
    `CONFIG=${config}`,
    "HTTP_PORT=127.0.0.1:18000",
    "HTTPS_PORT=127.0.0.1:443",
    "JICOFO_REST_PORT=18888",
    "TZ=UTC",
    "PUBLIC_URL=https://meet.jit.si",
    "ENABLE_AUTH=0",
    "ENABLE_LETSENCRYPT=0",
    "ENABLE_HTTP_REDIRECT=0",
    "JVB_ADVERTISE_IPS=127.0.0.1",
    "RESTART_POLICY=no",
    ...["JICOFO_AUTH_PASSWORD", "JVB_AUTH_PASSWORD", "JIGASI_XMPP_PASSWORD", "JIGASI_TRANSCRIBER_PASSWORD",
        "JIBRI_RECORDER_PASSWORD", "JIBRI_XMPP_PASSWORD"].map((k) => `${k}=${pw(k)}`),
  ].join("\n") + "\n");
}

function webUp() {
  return new Promise((resolve) => {
    const req = https.get({ host: "127.0.0.1", port: 443, path: "/", servername: "meet.jit.si",
                            rejectUnauthorized: false, timeout: 3000 }, (res) => { res.resume(); resolve(res.statusCode < 500); });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

(async () => {
  if (!fs.existsSync(path.join(EXT, "manifest.json"))) throw new Error("no dist/chrome — run npm run build");
  await prepare();
  console.log(`starting docker-jitsi-meet ${JITSI_VERSION} on 127.0.0.1 …`);
  compose("up", "-d", "--quiet-pull");
  try {
    let up = false;
    for (let i = 0; i < 90 && !up; i++) { up = await webUp(); if (!up) await sleep(2000); }
    if (!up) throw new Error("jitsi web did not come up on 127.0.0.1:443");

    const ctx = await chromium.launchPersistentContext("", {
      channel: "chromium",
      headless: true,
      ignoreHTTPSErrors: true,
      locale: "en-US", // selectors below are English; the host locale is Russian
      args: [
        `--disable-extensions-except=${EXT}`,
        `--load-extension=${EXT}`,
        "--host-resolver-rules=MAP meet.jit.si 127.0.0.1",
        "--ignore-certificate-errors",
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
      ],
    });
    let sw = ctx.serviceWorkers().find((w) => w.url().includes("background.js"));
    for (let i = 0; i < 50 && !sw; i++) {
      await sleep(200);
      sw = ctx.serviceWorkers().find((w) => w.url().includes("background.js"));
    }
    if (!sw) throw new Error("extension not loaded");
    const state = () => sw.evaluate(() => chrome.storage.local.get(["activeSessions", "history"]));
    const active = async () => Object.values((await state()).activeSessions || {})[0];

    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    await page.goto(`https://meet.jit.si/${ROOM}`, { waitUntil: "domcontentloaded" });
    await sleep(3000);
    let s = await active();
    assert(s?.platform && s.room?.toLowerCase() === ROOM.toLowerCase(), `session opened by URL for room ${ROOM}`);
    assert(s && !s.joinedAt, "not joined on the prejoin screen");

    // Prejoin screen: the join control is a div[role=button] labelled "Join meeting"
    // (or "Join" on some versions). Some deployments skip prejoin altogether.
    const join = page.locator('[role="button"][aria-label^="Join"], button[aria-label^="Join"]').first();
    try {
      await join.waitFor({ timeout: 20000 });
      await join.click();
    } catch {
      await page.screenshot({ path: path.join(CACHE, "prejoin.png") });
      console.log("no join control found — screenshot in tools/jitsi-e2e/.cache/prejoin.png");
    }
    let joined = false;
    for (let i = 0; i < 30 && !joined; i++) {
      await sleep(1000);
      joined = await page.evaluate(() => !!window.APP?.conference?.isJoined?.());
    }
    assert(joined, "real Jitsi let us into the conference (APP.conference.isJoined)");
    if (!joined) {
      await page.screenshot({ path: path.join(CACHE, "not-joined.png") });
      const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ");
      console.log("  page:", text.slice(0, 300));
      console.log("  console errors:", consoleErrors.slice(-8).join("\n    "));
    }
    await sleep(2500); // detector polls every second
    s = await active();
    assert(s?.joinedAt != null, "joinedAt set once really in the call (conference.joined or the isJoined() fallback)");

    await page.evaluate(() => window.APP.conference.hangup());
    let ended = null;
    for (let i = 0; i < 15 && !ended; i++) {
      await sleep(1000);
      ended = ((await state()).history || []).find((h) => h.room?.toLowerCase() === ROOM.toLowerCase());
    }
    assert(ended?.reason === "left-call", `session ended with left-call (got ${ended?.reason})`);
    assert(ended?.joinedAt != null, "ended session keeps its join time");

    await ctx.close();
  } finally {
    if (!process.env.KEEP_JITSI) compose("down", "--remove-orphans");
  }
  console.log(failed ? "\nJITSI E2E FAILED" : "\nAll Jitsi E2E checks passed.");
  process.exitCode = failed ? 1 : 0;
})().catch((e) => {
  console.error(e);
  try { if (!process.env.KEEP_JITSI) compose("down", "--remove-orphans"); } catch {}
  process.exit(1);
});
