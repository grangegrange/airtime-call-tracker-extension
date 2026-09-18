# Airtime — Call Time Tracker

A browser extension that automatically tracks how much time you spend in calls, so
you don't have to write it down.

- **Jitsi Meet** — with *precise* join/leave detection (counts actual time in the
  conference, not just the open tab)
- **Google Meet**
- **Zoom**
- **MS Teams**

Everything is stored locally — nothing leaves your browser.

## Features

- Records every call session: platform, room/meeting, start, end, duration, and
  why it ended (`tab-closed`, `left-call`, `navigated-away`, `call-changed`,
  `browser-closed`)
- Live timer on the toolbar icon — green badge while you are actually in a call,
  yellow while the tab is open but you haven't joined yet
- Popup with the active call (live ticking timer) and a session history with a
  running total
- Export everything to CSV (UTF-8, opens fine in Excel/Sheets)
- Heartbeat that keeps durations accurate even if the browser or machine crashes
- Serves both Chromium and Firefox from one codebase

## Install

### Chrome / Edge / Chromium

1. Clone or download this repo.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the repo root (or `dist/chrome`).

To update: reload the extension at `chrome://extensions` (↻ button).

### Firefox

1. `npm run build` to produce `dist/firefox` (or use the files straight from the
   repo — only the manifest differs).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select `dist/firefox/manifest.json`.

The temporary add-on disappears when Firefox restarts; for a permanent install the
add-on must be signed on [addons.mozilla.org](https://addons.mozilla.org).

## Usage

Just open a call. Airtime listens in the background:

- Opening a tab with a call page and navigating to it both start a session.
- Going to another site in the same tab ends the session (`navigated-away`).
- Switching from one meeting room to another creates a new session
  (`call-changed`).
- On Jitsi, the session start snaps to the moment you actually join the
  conference; leaving and rejoining creates separate sessions.
- Opening the Jitsi landing page (`meet.jit.si/`) is *not* counted as a call.

Click the toolbar icon to see live status and history. Use **Export CSV** for
billing or time reports; **Clear history** wipes the log (active sessions are
kept).

### CSV format

```
platform,room,url,start,joined_at,end,duration_min,reason
```

`joined_at` is empty for platforms without precise join detection (Google Meet,
Zoom, Teams) or when the user never joined a Jitsi call.

## How it works

```
┌──────────────── browser ─────────────────────────────┐
│  content-jitsi-page (MAIN world, meet.jit.si only)   │
│    hooks window.APP conference events                │
│        │ postMessage (joined / left)                 │
│  content-jitsi (isolated world)                      │
│        │ chrome.runtime.sendMessage                  │
│  background service worker                           │
│    tab events: onCreated / onUpdated / onRemoved     │
│    matchCallUrl → { platform, room }                 │
│    session log  ──► chrome.storage.local             │
│    badge timer + 1-min heartbeat                     │
└──────────────────────────────────────────────────────┘
```

- **URL matching** (`background.js`, `PLATFORMS`): Jitsi (any `meet.jit.si/<room>`),
  Google Meet (`/abc-defg-hij` codes), Zoom (`/j/<id>`, `/wc/<id>`), Teams
  (`/l/meetup-join/`, `/meet/`). Add your own platform by appending an entry.
- **Precise Jitsi tracking** (`content-jitsi-page.js`): runs in the page context
  (`world: "MAIN"`) and subscribes to Jitsi's internal `window.APP` conference
  events `conference.joined` / `conference.left`. Because it uses internals, it
  may silently stop working after a Jitsi version change — tab-based tracking
  keeps working as a fallback.
- **Storage schema**:
  - `activeSessions`: `{ [tabId]: { platform, room, url, start, joinedAt, lastSeen } }`
  - `history`: `[ { platform, room, url, start, joinedAt, end, durationMs, reason } ]`
- **Crash safety**: a once-per-minute alarm refreshes `lastSeen`. When the browser
  restarts, the `reconcile` step closes sessions whose tab no longer exists using
  the last heartbeat, so a crash doesn't inflate call time.

## Development

```
npm test        # run the mocked background smoke tests
npm run build   # emit dist/chrome and dist/firefox
npm run package # build + emit ready-to-upload ZIPs (airtime-chrome.zip, airtime-firefox.zip)
npm run icon:gen # regenerate PNG icons from tools/make-icons.js
```

CI on GitHub Actions runs the tests and builds the ZIPs on every push and pull
request (`.github/workflows/ci.yml`); pushing a `v*` tag builds and attaches the
ZIPs to a GitHub Release (`.github/workflows/release.yml`).

Besides this README, useful material lives in `docs/`:

- `docs/PUBLISHING.md` — step-by-step guide for Chrome Web Store, AMO and GitHub
- `docs/store/chrome-web-store.md` — CWS listing text + privacy rationale draft
- `docs/store/amo-listing.md` — AMO listing text draft

Project layout:

```
background.js          service worker (tracking, badge, heartbeat, reconcile)
content-jitsi.js       bridge: page → worker (isolated world)
content-jitsi-page.js  Jitsi join/leave detection (MAIN world)
popup.html/css/js      the popup UI
manifest.json          Chrome manifest (source of truth)
build.js               dist/chrome + dist/firefox bundles
test/background.test.js
tools/make-icons.js    zero-dependency PNG icon generator
tools/package-zips.js  zero-dependency ZIP packager
icons/                 generated icons (PNG) + SVG source
PRIVACY.md             privacy policy
.github/workflows/     CI + release automation
```

## Limitations & ideas

- **The Jitsi desktop/mobile app** is out of reach for a browser extension (it
  doesn't render web pages your extension can inject into). Ideas if you need it:
  - *Window-title watcher*: poll OS window titles for "Jitsi Meet" (Linux
    `xdotool`, macOS AppleScript, Windows `Get-Process`) and log start/end — a
    small companion script, easy to hook into the same CSV/CSV-style log.
  - *Self-hosted Jitsi*: use server-side events (Prosody `mod_muc_mam`, Jicofo/Jibri
    logs, or the Jitsi webhook for outgoing calls) for authoritative call records.
  - *Mobile*: not practical via extension; Firefox for Android supports a subset
    of WebExtension APIs and may work with this codebase (untested).
- **Firefox** is supported for the tab-based tracking and the Jitsi precise hook.
  The Firefox build requires 140+ (desktop) / 142+ (Android) for the mandatory
  `data_collection_permissions` manifest key.
- URL-based detection can't tell whether you are on a call inside an *embedded*
  Jitsi iframe on another site — a content script for that host is a possible
  follow-up.

## Privacy

No servers, no analytics, no network calls. All data lives in your browser's
`chrome.storage.local` (or `browser.storage.local` on Firefox). The only
outgoing resources are the call pages themselves and, on Jitsi, the postMessage
bridge between two content scripts.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## License

MIT — see [LICENSE](LICENSE).