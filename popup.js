const $ = (id) => document.getElementById(id);

const PLATFORM_NAMES = {
  jitsi: "Jitsi Meet",
  gmeet: "Google Meet",
  zoom: "Zoom",
  teams: "MS Teams",
};
// records from older versions of the extension were Jitsi-only
const platformName = (id) => PLATFORM_NAMES[id] ?? id ?? "Jitsi Meet";

function fmtDuration(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function makeItem(session, metaText, durText) {
  const li = document.createElement("li");
  li.dataset.platform = session.platform || "jitsi";

  const main = document.createElement("div");
  main.className = "item-main";

  const chip = document.createElement("span");
  chip.className = "chip";
  const dot = document.createElement("span");
  dot.className = "chip-dot";
  chip.append(dot, document.createTextNode(platformName(session.platform)));
  main.appendChild(chip);

  const room = document.createElement("div");
  room.className = "room";
  room.textContent = session.room;
  main.appendChild(room);

  if (metaText) {
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = metaText;
    main.appendChild(meta);
  }

  const dur = document.createElement("div");
  dur.className = "dur";
  dur.textContent = durText;

  li.append(main, dur);
  return li;
}

function renderList(el, emptyEl, sessions, itemBuilder) {
  el.replaceChildren();
  const show = sessions.length > 0;
  emptyEl.style.display = show ? "none" : "";
  for (const s of sessions) el.appendChild(itemBuilder(s));
}

async function render() {
  const { activeSessions = {}, history = [] } = await chrome.storage.local.get([
    "activeSessions",
    "history",
  ]);

  // Active calls
  renderList($("active"), $("no-active"), Object.values(activeSessions), (s) => {
    const meta = s.joinedAt
      ? `in call since ${fmtTime(s.joinedAt)}`
      : `tab open since ${fmtTime(s.start)}, not joined yet`;
    return makeItem(s, meta, fmtDuration(Date.now() - (s.joinedAt ?? s.start)));
  });

  // "In a call" indicator
  const inCall = Object.values(activeSessions).some((s) => s.joinedAt);
  $("live").classList.toggle("hidden", !inCall);

  // History (newest first)
  const hist = [...history].reverse();
  renderList($("history"), $("no-history"), hist, (h) => {
    let meta = fmtTime(h.start);
    if (h.platform === "jitsi" && !h.joinedAt) meta += " · not joined";
    return makeItem(h, meta, fmtDuration(h.durationMs));
  });

  // Total
  const totalMs = history.reduce((sum, h) => sum + h.durationMs, 0);
  $("total").textContent = history.length
    ? `Total: ${fmtDuration(totalMs)} (${history.length} sessions)`
    : "";
}

$("export").addEventListener("click", async () => {
  const { history = [] } = await chrome.storage.local.get("history");
  const rows = [
    ["platform", "room", "url", "start", "joined_at", "end", "duration_min", "reason"],
  ];
  for (const h of history) {
    rows.push([
      platformName(h.platform),
      h.room,
      h.url,
      new Date(h.start).toISOString(),
      h.joinedAt ? new Date(h.joinedAt).toISOString() : "",
      new Date(h.end).toISOString(),
      (h.durationMs / 60000).toFixed(2),
      h.reason,
    ]);
  }
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "airtime-sessions.csv";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("clear").addEventListener("click", async () => {
  if (confirm("Delete all session history?")) {
    await chrome.storage.local.set({ history: [] });
    render();
  }
});

render();
setInterval(render, 1000); // live timer for the active call