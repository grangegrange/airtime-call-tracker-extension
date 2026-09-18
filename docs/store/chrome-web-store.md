# Chrome Web Store listing (draft)

Filled into the Chrome Web Store developer dashboard. The 128×128 store icon is
`icons/icon128.png`. Screenshots (1280×800) still need to be captured from a
running install — see `docs/PUBLISHING.md`.

## Basic info

- **Name (100 chars):** Airtime — Call Time Tracker
- **Short name (12 chars):** Airtime
- **Category:** Productivity
- **Screenshot**: 1 desktop in-use shot, 1-2 shots of the popup open
- **Language:** English

## Detailed description

Tracks how much time you actually spend in calls — automatically, without
clocks or spreadsheets. Airtime watches your call pages in the background and
logs every session: platform, meeting, start, end and duration.

Supported platforms:

- Jitsi Meet — with precise join/leave detection (counts real time inside the
  conference, not just the open tab)
- Google Meet
- Zoom
- MS Teams

100% private by design: no servers, no analytics, no network calls. All data
stays in your browser.

What you get:

- Toolbar timer — a live badge shows the current call duration; green while you
  are in a call, yellow while the tab is open but you haven't joined
- Popup with the running call and full history, including a running total
- CSV export (UTF-8) for billing, timesheets or weekly reviews
- Accurate even across crashes — sessions are reconciled on browser start
- Teams/office friendly: works with Jitsi, the most privacy-friendly platform

No accounts, no tracking, no sign-up. Install, open a call, done.

## Short description

Automatically tracks time spent in calls on Jitsi, Google Meet, Zoom and Teams.
100% local, no account needed.

## Keywords

call tracking, jitsi, jitsi meet, google meet, zoom, teams, time tracker,
timesheet, meeting, productivity

## Privacy practices (developer dashboard)

- **Privacy policy URL:**
  `https://github.com/grangegrange/airtime-call-tracker-extension/blob/main/PRIVACY.md`
- **Single purpose:** track and display time spent in calls.
- **Data collected:** none transmitted. Session records are only stored in the
  browser's local extension storage (`chrome.storage.local`) and never leave the
  device.
- **Permissions rationale:** `tabs` — read the current page URL to detect call
  pages; `storage` — save session history; `alarms` — per-minute heartbeat for
  accurate durations.
- **Remote code:** none. No third-party libraries or servers involved.