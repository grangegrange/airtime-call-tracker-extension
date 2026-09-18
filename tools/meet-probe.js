// Google Meet detector probe — paste into the DevTools console while in a
// real Meet call to validate the "Leave call" selectors against the live DOM.
//
// Usage:
//   1. Join a Google Meet call (so the "Leave call" control is on screen).
//   2. Open DevTools → Console (F12).
//   3. Paste this whole file and press Enter.
//
// Reading the output:
//   - "SELECTOR OK"         → the detector will fire; nothing to change.
//   - "SELECTOR MISS"       → my selectors don't match. Send me the
//     "leave-like buttons" list printed below and I'll fix the selector.
//
// Tip: run it once on the pre-join screen too — it should report
// "SELECTOR OK (not in call, as expected)" there.
(() => {
  const selectors = [
    'button[aria-label="Leave call"]',
    'button[aria-label*="Leave call"]',
  ];

  const rows = [];
  let anyVisible = false;
  for (const sel of selectors) {
    let el = null;
    try {
      el = document.querySelector(sel);
    } catch (e) {
      rows.push({ selector: sel, found: false, visible: false, error: String(e) });
      continue;
    }
    const visible = !!(el && el.getClientRects().length > 0);
    anyVisible = anyVisible || visible;
    rows.push({ selector: sel, found: !!el, visible });
  }

  // broad scan: every button whose label/text mentions "leave"
  const leaveLike = [];
  for (const b of document.querySelectorAll("button")) {
    const label = (b.getAttribute("aria-label") || "") + " " + (b.textContent || "");
    if (/leave/i.test(label)) {
      leaveLike.push({
        "aria-label": b.getAttribute("aria-label"),
        text: (b.textContent || "").trim().slice(0, 40),
        visible: b.getClientRects().length > 0,
      });
    }
  }

  console.log("%c=== Airtime Meet detector probe ===", "font-weight:bold;color:#6366f1");
  console.table(rows);
  console.log("leave-like buttons found:", leaveLike.length);
  if (leaveLike.length) console.log(leaveLike);

  if (anyVisible) {
    console.log("%cSELECTOR OK — detector will fire on this call", "color:#1a7f37;font-weight:bold");
  } else if (leaveLike.length === 0) {
    console.log("%cSELECTOR MISS — no leave-like buttons in DOM (are you actually in a call?)", "color:#c2410c;font-weight:bold");
  } else {
    console.log("%cSELECTOR MISS — leave-like buttons exist but my selectors missed them", "color:#c2410c;font-weight:bold");
  }
})();
