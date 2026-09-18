// Content script (isolated world) — bridge between the page and the background.
// Receives postMessage from content-jitsi-page.js and forwards it to the worker.

window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  const d = e.data;
  if (d?.source === "jst-page" && (d.type === "joined" || d.type === "left")) {
    chrome.runtime.sendMessage({ source: "jst", type: d.type }).catch(() => {
      // the service worker may have been restarting — the next event will arrive
    });
  }
});