// Runs inside the call page itself (world: MAIN). For platforms without a
// stable in-call API, it infers the join/leave moment from the presence of a
// visible "leave call" control in the page UI and relays normalized joined/left
// events to the isolated bridge (content-call.js) via postMessage.
//
// Best-effort: these are third-party UIs, so the selectors can break when the
// vendor ships a DOM change or a new locale. URL-based tab tracking in the
// background keeps working regardless — this only refines start/end accuracy.
(function () {
  const HOST = location.hostname;

  // Per-platform selectors that are present *only* while in a call. Add Zoom /
  // Teams entries here as their UIs are reverse-engineered (keep them small and
  // replaceable — see the project spec).
  const IN_CALL_SELECTORS = {
    "meet.google.com": [
      'button[aria-label="Leave call"]',
      'button[aria-label*="Leave call"]',
    ],
  };

  const selectors = IN_CALL_SELECTORS[HOST];
  if (!selectors || selectors.length === 0) return;

  const POST = (type) =>
    window.postMessage({ source: "call-page", type, url: location.href }, "*");

  let inCall = false;

  function isInCall() {
    for (const sel of selectors) {
      let el;
      try {
        el = document.querySelector(sel);
      } catch {
        continue; // invalid selector or torn-down DOM
      }
      // getClientRects() is non-empty only when the element is rendered & visible
      if (el && el.getClientRects().length > 0) return true;
    }
    return false;
  }

  function check() {
    const now = isInCall();
    if (now && !inCall) {
      inCall = true;
      POST("joined");
    } else if (!now && inCall) {
      inCall = false;
      POST("left");
    }
  }

  function start() {
    if (!document.body) return setTimeout(start, 200);
    new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
    check();
  }

  start();
  setInterval(check, 2000); // safety net for transitions MutationObserver misses
})();
