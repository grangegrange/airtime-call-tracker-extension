// Smoke tests for background.js with a mocked chrome API.
// Run with: node test/background.test.js

const store = {};
const listeners = {};
const badgeCalls = [];

global.chrome = {
  storage: {
    local: {
      get: async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        const out = {};
        for (const k of arr) if (k in store) out[k] = store[k];
        return out;
      },
      set: async (obj) => Object.assign(store, structuredClone(obj)),
    },
  },
  tabs: {
    onCreated: { addListener: (f) => (listeners.onCreated = f) },
    onUpdated: { addListener: (f) => (listeners.onUpdated = f) },
    onRemoved: { addListener: (f) => (listeners.onRemoved = f) },
    query: async () => [],
  },
  alarms: {
    onAlarm: { addListener: (f) => (listeners.onAlarm = f) },
    create: () => {},
  },
  action: {
    setBadgeText: async (o) => badgeCalls.push({ text: o.text }),
    setBadgeBackgroundColor: async (o) => badgeCalls.push({ color: o.color }),
  },
  runtime: {
    onStartup: { addListener: (f) => (listeners.onStartup = f) },
    onInstalled: { addListener: (f) => (listeners.onInstalled = f) },
    onMessage: { addListener: (f) => (listeners.onMessage = f) },
  },
};

require("../background.js");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (cond, msg) => {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok:", msg);
};
const msg = (type, tabId, url) =>
  listeners.onMessage({ source: "jst", type }, { tab: { id: tabId, url } });
const callMsg = (type, tabId, url) =>
  listeners.onMessage({ source: "call", type, url }, { tab: { id: tabId, url } });

(async () => {
  // --- platform detection ---
  listeners.onUpdated(1, { url: "https://meet.jit.si/TestRoom" });
  listeners.onUpdated(2, { url: "https://meet.google.com/abc-defg-hij" });
  listeners.onUpdated(3, { url: "https://us05web.zoom.us/j/12345678901?pwd=x" });
  listeners.onUpdated(4, { url: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_xxx" });
  listeners.onUpdated(5, { url: "https://meet.google.com/" }); // not a call
  await sleep(40);
  assert(store.activeSessions[1]?.platform === "jitsi" && store.activeSessions[1].room === "TestRoom", "jitsi detected");
  assert(store.activeSessions[2]?.platform === "gmeet" && store.activeSessions[2].room === "abc-defg-hij", "google meet detected");
  assert(store.activeSessions[3]?.platform === "zoom" && store.activeSessions[3].room === "ID 12345678901", "zoom detected");
  assert(store.activeSessions[4]?.platform === "teams", "teams detected");
  assert(!store.activeSessions[5], "bare meet.google.com not tracked");

  // --- precise tracking: joined/left ---
  const before = store.activeSessions[1].start;
  await sleep(1100);
  msg("joined", 1, "https://meet.jit.si/TestRoom");
  await sleep(40);
  const joinedAt = store.activeSessions[1].joinedAt;
  assert(joinedAt > before, "joinedAt set on conference join");

  msg("joined", 1, "https://meet.jit.si/TestRoom"); // duplicate must not shift joinedAt
  await sleep(40);
  assert(store.activeSessions[1].joinedAt === joinedAt, "duplicate join ignored");

  await sleep(1100);
  msg("left", 1, "https://meet.jit.si/TestRoom");
  await sleep(40);
  const h1 = store.history.at(-1);
  assert(h1.reason === "left-call", "leave ended the session");
  assert(h1.durationMs >= 1000 && h1.durationMs < 2600, `duration measured from joinedAt (${h1.durationMs}ms)`);

  // --- rejoin after left -> new session with joinedAt already set ---
  msg("joined", 1, "https://meet.jit.si/TestRoom");
  await sleep(40);
  assert(store.activeSessions[1]?.joinedAt != null, "rejoin created a session with joinedAt");
  listeners.onRemoved(1);
  await sleep(40);
  assert(store.history.at(-1).reason === "tab-closed", "tab close after rejoin");

  // --- leaving a platform / going elsewhere ---
  listeners.onRemoved(2);
  listeners.onUpdated(3, { url: "https://example.com/" });
  await sleep(40);
  assert(store.history.some((h) => h.platform === "gmeet" && h.reason === "tab-closed"), "gmeet closed by tab");
  assert(store.history.some((h) => h.platform === "zoom" && h.reason === "navigated-away"), "zoom closed by navigation");

  // --- badge ---
  assert(badgeCalls.some((c) => c.color === "#1a7f37"), "badge was green (in a call)");
  assert(typeof badgeCalls.filter((c) => "text" in c).at(-1).text === "string", "badge text updates");

  // --- heartbeat without active sessions must not crash ---
  listeners.onRemoved(4);
  await sleep(40);
  await listeners.onAlarm({ name: "heartbeat" });
  await sleep(40);
  const cleared = badgeCalls.filter((c) => "text" in c).at(-1);
  assert(cleared.text === "", "badge cleared when no calls");

  // --- precise tracking for Meet via generic detector (source: "call") ---
  listeners.onUpdated(6, { url: "https://meet.google.com/qrs-tuvw-xyz" });
  await sleep(40);
  assert(store.activeSessions[6]?.platform === "gmeet", "gmeet session via url");

  callMsg("joined", 6, "https://meet.google.com/qrs-tuvw-xyz");
  await sleep(40);
  assert(store.activeSessions[6]?.joinedAt != null, "gmeet joinedAt set by detector");

  // stale left from a different meeting must NOT stop the session
  callMsg("left", 6, "https://meet.google.com/zzz-abcd-efg");
  await sleep(40);
  assert(store.activeSessions[6] != null, "stale left ignored (room mismatch)");

  // real left from the same meeting
  callMsg("left", 6, "https://meet.google.com/qrs-tuvw-xyz");
  await sleep(40);
  assert(
    store.history.some((h) => h.platform === "gmeet" && h.room === "qrs-tuvw-xyz" && h.reason === "left-call"),
    "gmeet ended by detector left"
  );

  console.log(`\nAll checks passed. Sessions in history: ${store.history.length}`);
})();