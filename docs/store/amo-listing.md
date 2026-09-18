# Firefox addons.mozilla.org listing (draft)

Filled into the AMO developer hub. The add-on id is fixed in the firefox build:
`airtime@calltracker`. `strict_min_version` is 140.0 (desktop) / 142.0 (Android)
— the minimum that supports the mandatory `data_collection_permissions` key.

## Details

- **Name:** Airtime — Call Time Tracker
- **Summary (250 chars):** Automatically tracks time spent in calls on Jitsi
  Meet, Google Meet, Zoom and MS Teams. 100% local, no account needed.
- **Categories:** Productivity → Time Management
- **Tags:** calls, jitsi, meetings, time-tracking
- **Home page:** https://github.com/grangegrange/airtime-call-tracker-extension
- **Privacy policy URL:**
  https://github.com/grangegrange/airtime-call-tracker-extension/blob/main/PRIVACY.md
- **Version:** 1.3.0

## Description

Automatically tracks how much time you actually spend in calls — no clocks, no
spreadsheets. Airtime watches your call pages in the background and logs every
session: platform, meeting, start, end and duration.

Supports:

- Jitsi Meet and Google Meet — precise join/leave detection (counts real time
  inside the call, not just the open tab)
- Zoom
- MS Teams

100% private by design: no servers, no analytics, no network traffic. Data
stays in your browser's local extension storage.

You get a live toolbar timer (green = in a call, yellow = tab open but not yet
joined), a popup with the current call and full history with a running total,
and CSV export in UTF-8. Durations stay accurate even if the browser crashes —
sessions are reconciled on startup.

No accounts, no tracking. Install, open a call, done.

## Firefox-specific notes for AMO review

- MV3 background runs as a non-persistent event page
  (`background.scripts`), not a service worker.
- `world: "MAIN"` requires Firefox 128+; `data_collection_permissions` requires
  140+ (desktop) / 142+ (Android), hence `strict_min_version` 140.0 / 142.0.
- No remote code; the only cross-webpage bridges are `window.postMessage` between
  content script pairs on `meet.jit.si` and `meet.google.com`.
- Permissions are limited to `tabs`, `storage`, `alarms` and the `meet.jit.si` /
  `meet.google.com` content script host permissions.

## Notes to reviewer (paste into the AMO "notes" field)

Airtime tracks time spent in video calls. The background script matches call
pages by URL (`tabs` permission) and stores session records in `storage.local`
(`storage` permission); a 1-minute `alarms` heartbeat keeps durations accurate
and reconciles sessions on startup.

On `meet.jit.si` and `meet.google.com`, content scripts run to detect the exact
join/leave moment:

- Jitsi: `content-jitsi-page.js` (`world: "MAIN"`) subscribes to Jitsi's
  internal `window.APP` conference events (`conference.joined` /
  `conference.left`).
- Google Meet: `content-call-page.js` (`world: "MAIN"`) watches the "Leave call"
  control and the "Rejoin" / ended indicators to infer in-call state.

Both run in the page world (no access to browser APIs), so they relay only
normalized `joined` / `left` events to their isolated-world bridges
(`content-jitsi.js` / `content-call.js`) via `window.postMessage`, which validate
the sender and forward the event to the background with
`chrome.runtime.sendMessage`.

No data leaves the browser: there are no network requests, no remote code, no
third-party libraries. All records stay in the browser's local extension
storage and are only written to a local CSV file if the user clicks "Export".
The page-world scripts are best-effort — if a vendor changes its UI or
internals, URL-based tab tracking (which needs no page access) keeps working.