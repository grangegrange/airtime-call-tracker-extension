// Airtime — background service worker (Manifest V3).
// Tracks call tabs (Jitsi Meet, Google Meet, Zoom, MS Teams) and stores sessions in
// chrome.storage.local:
//   activeSessions: { [tabId]: { platform, room, url, start, joinedAt, lastSeen } }
//   history: [ { platform, room, url, start, joinedAt, end, durationMs, reason } ]
//
// start    — when the tab opened a call page
// joinedAt — when the user actually joined the conference (Jitsi only, via content
//            script); duration is measured from joinedAt when present.

const HEARTBEAT_ALARM = "heartbeat";
const HEARTBEAT_PERIOD_MIN = 1;

// --- platforms ---

const PLATFORMS = [
  {
    id: "jitsi",
    name: "Jitsi Meet",
    host: /^meet\.jit\.si$/,
    match(u) {
      const p = u.pathname.replace(/^\/+|\/+$/g, "");
      return p ? decodeURIComponent(p) : null; // landing page is not a call
    },
  },
  {
    id: "gmeet",
    name: "Google Meet",
    host: /^meet\.google\.com$/,
    match(u) {
      const m = u.pathname.match(/^\/([a-z]{3}-[a-z]{4}-[a-z]{3})\/?$/i);
      return m ? m[1].toLowerCase() : null; // code like abc-defg-hij
    },
  },
  {
    id: "zoom",
    name: "Zoom",
    host: /(^|\.)zoom\.us$/,
    match(u) {
      const m = u.pathname.match(/^\/(?:j|wc)\/(\d{9,11})/);
      return m ? `ID ${m[1]}` : null;
    },
  },
  {
    id: "teams",
    name: "MS Teams",
    host: /^teams\.(microsoft|live)\.com$/,
    match(u) {
      if (u.pathname.includes("/l/meetup-join/")) return "Meeting";
      if (/^\/meet\//.test(u.pathname)) return "Meeting";
      return null;
    },
  },
];

// Returns { platform, room } or null if the URL is not a call page.
function matchCallUrl(url) {
  try {
    const u = new URL(url);
    for (const p of PLATFORMS) {
      if (p.host.test(u.hostname)) {
        const room = p.match(u);
        return room ? { platform: p.id, room } : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// --- storage ---

// chrome.storage.local is not transactional and several tab events can arrive at
// once — serialize handlers through a simple promise queue.
let queue = Promise.resolve();
function enqueue(fn) {
  queue = queue.then(fn).catch((e) => console.error("airtime error", e));
}

async function getState() {
  const { activeSessions = {}, history = [] } = await chrome.storage.local.get([
    "activeSessions",
    "history",
  ]);
  return { activeSessions, history };
}

async function startSession(tabId, url, joined = false) {
  const found = matchCallUrl(url);
  if (!found) return;
  const { activeSessions, history } = await getState();
  if (activeSessions[tabId]) return; // already tracked
  const now = Date.now();
  activeSessions[tabId] = {
    platform: found.platform,
    room: found.room,
    url,
    start: now,
    joinedAt: joined ? now : null,
    lastSeen: now,
  };
  await chrome.storage.local.set({ activeSessions, history });
  updateBadge();
}

async function stopSession(tabId, reason, endOverride) {
  const { activeSessions, history } = await getState();
  const s = activeSessions[tabId];
  if (!s) return;
  delete activeSessions[tabId];
  const end = endOverride ?? Date.now();
  const effectiveStart = s.joinedAt ?? s.start;
  history.push({
    platform: s.platform,
    room: s.room,
    url: s.url,
    start: s.start,
    joinedAt: s.joinedAt,
    end,
    durationMs: Math.max(0, end - effectiveStart),
    reason,
  });
  await chrome.storage.local.set({ activeSessions, history });
  updateBadge();
}

// Tab URL changed: start / stop / switch the session.
async function handleUrlChange(tabId, url) {
  const found = matchCallUrl(url);
  const { activeSessions } = await getState();
  const current = activeSessions[tabId];
  const sameCall =
    current && found && current.platform === found.platform && current.room === found.room;
  if (current && !sameCall) {
    await stopSession(tabId, found ? "call-changed" : "navigated-away");
  }
  if (found) await startSession(tabId, url);
}

// --- tab events ---

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id != null && tab.url) enqueue(() => handleUrlChange(tab.id, tab.url));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) enqueue(() => handleUrlChange(tabId, changeInfo.url));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  enqueue(() => stopSession(tabId, "tab-closed"));
});

// --- precise Jitsi tracking (messages from content script) ---

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.source !== "jst" || sender.tab?.id == null) return;
  if (msg.type === "joined") enqueue(() => onJoined(sender.tab.id, sender.tab.url));
  else if (msg.type === "left") enqueue(() => onLeft(sender.tab.id));
});

async function onJoined(tabId, url) {
  const { activeSessions, history } = await getState();
  const s = activeSessions[tabId];
  if (s) {
    if (s.joinedAt) return; // already marked
    s.joinedAt = Date.now();
    await chrome.storage.local.set({ activeSessions, history });
  } else {
    // the tab somehow was missed — start the session at the join moment
    await startSession(tabId, url, true);
  }
  updateBadge();
}

async function onLeft(tabId) {
  await stopSession(tabId, "left-call");
}

// --- icon badge timer ---

async function updateBadge() {
  try {
    const { activeSessions } = await getState();
    const sessions = Object.values(activeSessions);
    if (sessions.length === 0) {
      await chrome.action.setBadgeText({ text: "" });
      return;
    }
    // prefer confirmed calls (green badge), otherwise the oldest pending one (yellow)
    const joined = sessions.filter((s) => s.joinedAt);
    const pool = joined.length > 0 ? joined : sessions;
    const oldest = pool.reduce((a, b) =>
      (a.joinedAt ?? a.start) <= (b.joinedAt ?? b.start) ? a : b
    );
    const ms = Date.now() - (oldest.joinedAt ?? oldest.start);
    const totalMin = Math.max(0, Math.floor(ms / 60000));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const text = h >= 10 ? "10h+" : h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}m`;
    await chrome.action.setBadgeBackgroundColor({
      color: joined.length > 0 ? "#1a7f37" : "#b7791f",
    });
    await chrome.action.setBadgeText({ text });
  } catch {
    // badge may not be available at the moment — not critical
  }
}

// --- heartbeat ---
// Every minute, refresh lastSeen for active sessions (protects against a browser
// crash inflating durations) and update the badge timer.

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) return;
  enqueue(async () => {
    const { activeSessions, history } = await getState();
    if (Object.keys(activeSessions).length > 0) {
      const now = Date.now();
      for (const s of Object.values(activeSessions)) s.lastSeen = now;
      await chrome.storage.local.set({ activeSessions, history });
    }
    updateBadge();
  });
});

// --- startup reconcile ---
// The service worker can be unloaded, or the browser can close with call tabs open:
// reconcile activeSessions against the tabs that actually exist.

async function reconcile() {
  const { activeSessions } = await getState();
  const tabs = await chrome.tabs.query({});
  const byId = new Map(tabs.map((t) => [t.id, t]));

  for (const [tabIdStr, s] of Object.entries(activeSessions)) {
    const tabId = Number(tabIdStr);
    const tab = byId.get(tabId);
    if (!tab) {
      await stopSession(tabId, "browser-closed", s.lastSeen);
    } else if (!matchCallUrl(tab.url || "")) {
      await stopSession(tabId, "navigated-away");
    }
  }

  // Pick up call tabs that are already open (e.g. after an extension update).
  for (const tab of tabs) {
    if (tab.id != null && tab.url && matchCallUrl(tab.url)) {
      await startSession(tab.id, tab.url);
    }
  }
  updateBadge();
}

chrome.runtime.onStartup.addListener(() => enqueue(reconcile));
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: HEARTBEAT_PERIOD_MIN });
  enqueue(reconcile);
});