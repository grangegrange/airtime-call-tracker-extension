// Runs inside the call page itself (world: MAIN). For platforms without a
// stable in-call API, it infers the join/leave moment from the page UI and
// relays normalized joined/left events to the isolated bridge (content-call.js)
// via postMessage.
//
// Best-effort: these are third-party UIs, so the selectors can break when the
// vendor ships a DOM change or a new locale. URL-based tab tracking in the
// background keeps working regardless — this only refines start/end accuracy.
(function () {
  const HOST = location.hostname;

  // Selectors present *only* while in a call (e.g. the leave-call control).
  const IN_CALL_SELECTORS = {
    "meet.google.com": [
      'button[aria-label="Leave call"]',
      'button[aria-label*="Leave call"]',
    ],
  };

  // Selectors that indicate the call is already over even if the leave control
  // is still in the DOM (e.g. the "Rejoin" screen after leaving).
  const ENDED_SELECTORS = {
    "meet.google.com": [
      'button[aria-label*="Rejoin"]',
      '[data-call-ended="true"]',
    ],
  };

  const joinSelectors = IN_CALL_SELECTORS[HOST];
  const endedSelectors = ENDED_SELECTORS[HOST] || [];
  if (!joinSelectors || joinSelectors.length === 0) return;

  const POST = (type) =>
    window.postMessage({ source: "call-page", type, url: location.href }, "*");

  let inCall = false;

  function isVisible(el) {
    if (!el || el.getClientRects().length === 0) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  }

  function anyVisible(selectors) {
    for (const sel of selectors) {
      let el;
      try {
        el = document.querySelector(sel);
      } catch {
        continue;
      }
      if (isVisible(el)) return true;
    }
    return false;
  }

  function isInCall() {
    return anyVisible(joinSelectors) && !anyVisible(endedSelectors);
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
