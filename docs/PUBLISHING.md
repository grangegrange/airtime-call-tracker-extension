# Publishing guide

This walkthrough covers all three channels. Most text is already drafted in
`docs/store/`; screenshots still need to be captured from a real install.

## 0. Preparation (one-time)

1. `npm test` — suite must pass.
2. `npm run icon:gen` then `npm run build` — icons and both bundles fresh.
3. `npm run package` — produces `dist/airtime-chrome.zip` and
   `dist/airtime-firefox.zip`.

Test the `dist/chrome` build yourself first (see README → Install).

## 1. GitHub (open source)

1. Create an empty repository named `airtime-call-tracker-extension` (put the
   remote in the repo root). Do **not** add a README/license/gitignore via the
   web UI — they exist in the commit already.
2. `git remote add origin https://github.com/<user>/airtime-call-tracker-extension.git`
3. Verify pushes are allowed, then `git push -u origin main`. **Single clean
   history** — the repo starts fresh, see below.
4. Keep `dist/` and the upload zips out of git (they are already ignored);
   attach `dist/airtime-chrome.zip` / `dist/airtime-firefox.zip` to a GitHub
   Release if desired.

Fresh git history was created from scratch (old `.git` removed) so the timeline
starts with one clean commit.

## 2. Chrome Web Store

1. Go to the [Chrome Web Store developer dashboard] and pay the one-time
   $5 registration fee.
2. New item → upload `dist/airtime-chrome.zip` (NOT the `dist` folder, the zip).
3. Copy the listing text from `docs/store/chrome-web-store.md`.
4. Screenshots required: **1280×800** captures. Recommended set:
   - a real Jitsi call with the green badge/“In a call” popup visible,
   - the popup open over history,
   - (optional) CSV in a spreadsheet app.
5. Complete the “Privacy practices” questionnaire with the rationale from the
   store doc. **Single purpose** — tracking call time. **No data collected.**
6. Submit for review. Turnaround is typically a few days; privacy/host changes
   may extend it.

## 3. Firefox — AMO

1. `npm run package` and upload `dist/airtime-firefox.zip` to
   [addons.mozilla.org]. Self-distribution, then request a review, or side-load
   locally per README.
2. Copy the description from `docs/store/amo-listing.md`.
3. Signing is automatic for self-distributed add-ons; full review is needed to
   be listed. Expect a note that `world: "MAIN"` and the postMessage bridge are
   reviewed carefully.

## Tips

- Version bumps: update `manifest.json` and `CHANGELOG.md`, keep `version` in
  sync between Chrome and Firefox (they share `manifest.json` via `build.js`).
- Rebuild both ZIPs on every release and re-upload wherever hosted.
- If you need the repo private (GitHub) while you keep pushing, that's fine —
  the extension itself is open-source under MIT either way.

[Chrome Web Store developer dashboard]: https://chrome.google.com/u/2/webstore/devconsole
[addons.mozilla.org]: https://addons.mozilla.org/en-US/developers/