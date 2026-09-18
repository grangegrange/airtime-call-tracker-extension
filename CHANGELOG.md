# Changelog

All notable changes to Airtime are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/).

## [1.3.0] — 2026-09-18

### Added

- Precise join/leave detection for Google Meet: a MAIN-world content script
  (`content-call-page.js`) infers the in-call state from the "Leave call"
  control, relays normalized joined/left events through an isolated bridge
  (`content-call.js`) to the background, which guards against stale events from
  a different meeting. Pre-join, lobby and the bare meet.google.com page are
  not counted.
- End-to-end browser smoke test (`tools/meet-smoke.js`) and a live-selector
  probe (`tools/meet-probe.js`).

### Changed

- Detection for Meet is best-effort: it depends on Meet's UI, so the selectors
  may need updating after a Meet redesign. URL-based tracking keeps working as
  a fallback.

## [1.2.2] — 2026-09-18

### Added

- Manifest `homepage_url` and `author`.
- "Notes to reviewer" block for the AMO submission (`docs/store/amo-listing.md`).

## [1.2.1] — 2026-09-18

### Added

- Store screenshots (popup + 1280×800 landing composites) and a
  `tools/make-screenshots.js` generator.

### Changed

- Firefox: added `data_collection_permissions.required = ["none"]` (mandatory
  for new AMO submissions since Nov 2025) and raised `strict_min_version` to
  140.0 (desktop) / 142.0 (Android) accordingly.
- Popup: replaced `innerHTML` assignments with DOM construction.

### Fixed

- `web-ext lint` now passes with 0 errors / 0 warnings.

## [1.2.0] — 2026-09-18

### Added
- English UI and "Airtime" branding with generated icons (indigo→violet
  gradient, white clock).
- `dist/chrome` and `dist/firefox` bundles via `build.js`.
- `npm run package` produces ready-to-upload ZIPs for the Chrome Web Store and
  AMO.
- Docs: store listings, publishing guide, changelog.
- Test suite relocated to `test/background.test.js` (`npm test`).
- `PRIVACY.md` privacy policy (linked from the store listings).
- GitHub Actions CI (test + build + package on push/PR) and release automation
  (attaches ZIPs to a GitHub Release on `v*` tags).

### Changed
- Firefox support: MV3 background as an event page (`background.scripts`),
  `browser_specific_settings.gecko` with id `airtime@calltracker` and
  `strict_min_version: "128.0"` (required for `world: "MAIN"`).
- Badge timer units in English (`5m`, `1:05`, `10h+`).

## [1.1.0] — earlier

### Added
- Precise Jitsi tracking via `window.APP` conference events
  (`conference.joined` / `conference.left`); session start snaps to the actual
  join moment; leaving and rejoining produce separate sessions.
- Google Meet, Zoom (`/j/`, `/wc/`) and MS Teams (`/l/meetup-join/`, `/meet/`)
  support.
- Live timer on the toolbar icon (green = in a call, yellow = tab open),
  heartbeat (1 min) and startup reconcile to keep durations accurate across
  crashes.
- Popup with active calls, history, running total, CSV export with reason codes.
- Fixed a storage race condition by serializing handlers through a promise
  queue.