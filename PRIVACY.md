# Airtime — Privacy Policy

_Last updated: 2026-09-18_

Airtime ("the extension") is a browser extension that automatically records how
much time you spend in video calls. This policy explains what data the extension
handles and what happens to it.

**The short version: Airtime does not collect, transmit, or share anything. Every
piece of data stays on your own device, inside your own browser.**

## Data we do not collect

Airtime has **no servers, no analytics, no tracking, no advertising, and no
third-party services**. It does not:

- send any data over the network,
- use remote code or external libraries,
- create an account or ask you to sign in,
- read or transmit the contents of your calls, screen, microphone, or camera,
- collect personal information, identifiers, or browsing history.

## Data stored locally

Airtime stores a minimal session log in your browser's built-in extension
storage — `chrome.storage.local` (Chrome/Edge) or `browser.storage.local`
(Firefox). This storage is isolated to your profile and never leaves your
device. The log contains only:

- the name of the platform (e.g. "Google Meet"),
- the meeting/room identifier as it appears in the URL,
- the page URL of the call,
- the start time, the time you joined (Jitsi only), the end time, the duration,
  and a short reason the call ended (e.g. "tab closed").

You can view this data in the extension popup, export it as a CSV file, and
clear it at any time ("Clear history" in the popup). Clearing history removes
the stored log.

## Permissions

Airtime requests three permissions, and uses them only for the purpose described:

- **`tabs`** — to read the URL of the current page and detect when you are on a
  call page (this is how it knows a call started or ended).
- **`storage`** — to save the session log locally.
- **`alarms`** — to run a once-per-minute heartbeat that keeps call durations
  accurate even if the browser is closed or crashes.

On Jitsi Meet only, the extension runs an additional content script on
`meet.jit.si` that subscribes to Jitsi's internal conference events
(`conference.joined` / `conference.left`) to detect the exact moment you join or
leave a call. This happens entirely inside the page; no call data is recorded or
transmitted — only a timestamp is kept.

## How data can leave your device

The only way data leaves your device is if **you** choose to export it: the
"Export CSV" button in the popup writes the session log to a file on your
computer. Airtime itself never sends anything anywhere.

## Changes to this policy

Because Airtime stores no data on any server and collects nothing, there is
nothing to migrate or delete. If the extension's behavior ever changes, this
policy will be updated here and the version history will be noted in the
repository's changelog.

## Contact

For questions about this policy or the extension, open an issue in the
[GitHub repository](https://github.com/grangegrange/airtime-call-tracker-extension).
