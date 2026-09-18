# Changelog

All notable changes to Airtime are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/).

## [1.2.0] — 2026-09-18

### Added
- English UI and "Airtime" branding with generated icons (indigo→violet
  gradient, white clock).
- `dist/chrome` and `dist/firefox` bundles via `build.js`.
- `npm run package` produces ready-to-upload ZIPs for the Chrome Web Store and
  AMO.
- Docs: store listings, publishing guide, changelog.
- Test suite relocated to `test/background.test.js` (`npm test`).

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