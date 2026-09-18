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
- **Version:** 1.2.1

## Description

Automatically tracks how much time you actually spend in calls — no clocks, no
spreadsheets. Airtime watches your call pages in the background and logs every
session: platform, meeting, start, end and duration.

Supports:

- Jitsi Meet — precise join/leave detection (counts real time inside the
  conference, not just the open tab)
- Google Meet
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
- No remote code; the only cross-webpage bridge is `window.postMessage` between
  two content scripts on `meet.jit.si` itself.
- Permissions are limited to `tabs`, `storage`, `alarms` and the `meet.jit.si`
  content script host permission.