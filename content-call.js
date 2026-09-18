// Content script (isolated world) — bridge for the generic call-page detector.
// Receives postMessage from content-call-page.js and forwards it to the worker.
window.addEventListener("message", (e) => {
  if (e.source !== window) return;
  const d = e.data;
  if (d?.source === "call-page" && (d.type === "joined" || d.type === "left")) {
    chrome.runtime.sendMessage({ source: "call", type: d.type, url: d.url }).catch(() => {
      // the service worker may have been restarting — the next event will arrive
    });
  }
});
