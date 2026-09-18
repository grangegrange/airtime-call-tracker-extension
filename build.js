// Builds ready-to-load bundles of the extension into dist/.
// Chrome loads dist/chrome as an unpacked extension; Firefox loads dist/firefox
// via "Load Temporary Add-on". No dependencies — run with: node build.js
const fs = require("fs");
const path = require("path");

const COMMON_FILES = [
  "background.js",
  "content-jitsi.js",
  "content-jitsi-page.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "icons",
];

function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) copy(path.join(src, name), path.join(dst, name));
  } else {
    fs.copyFileSync(src, dst);
  }
}

function build(target) {
  const out = path.join("dist", target);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  for (const f of COMMON_FILES) copy(f, path.join(out, f));

  const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
  if (target === "firefox") {
    // Firefox runs MV3 background as a non-persistent event page, not a service worker
    delete manifest.background.service_worker;
    manifest.background = { scripts: ["background.js"] };
    manifest.browser_specific_settings = {
      gecko: {
        id: "airtime@calltracker",
        strict_min_version: "128.0",
      },
    };
  }
  fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`ok built dist/${target}`);
}

build("chrome");
build("firefox");