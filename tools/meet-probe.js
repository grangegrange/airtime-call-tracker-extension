// Google Meet detector probe — paste into the DevTools console to validate the
// detector's signals against the live DOM.
//
// Usage:
//   1. In a call, paste this → expect "IN CALL" and the leave-call selectors.
//   2. Click "Leave call", stay on the page, paste again → expect "NOT IN CALL".
//   3. Send me the output if either verdict is wrong — it dumps the exact
//      element states so I can fix the selectors.
(() => {
  const joinSelectors = [
    'button[aria-label="Leave call"]',
    'button[aria-label*="Leave call"]',
  ];
  const endedSelectors = [
    'button[aria-label*="Rejoin"]',
    '[data-call-ended="true"]',
  ];

  const stateOf = (el) => {
    if (!el) return { present: false };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      present: true,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      rect: `${Math.round(r.width)}x${Math.round(r.height)}`,
    };
  };

  const rows = [];
  let inCall = false;
  for (const sel of joinSelectors) {
    let el = null;
    try {
      el = document.querySelector(sel);
    } catch (e) {
      rows.push({ kind: "join", selector: sel, ...{ error: String(e) } });
      continue;
    }
    const s = stateOf(el);
    const visible = s.present && s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0" && s.rect !== "0x0";
    inCall = inCall || visible;
    rows.push({ kind: "join", selector: sel, ...s, visible });
  }

  let ended = false;
  for (const sel of endedSelectors) {
    let el = null;
    try {
      el = document.querySelector(sel);
    } catch {
      continue;
    }
    const s = stateOf(el);
    const visible = s.present && s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0";
    ended = ended || visible;
    rows.push({ kind: "ended", selector: sel, ...s, visible });
  }

  const text = (document.body?.innerText || "");
  const endedText = /you left the meeting|meeting ended/i.test(text);
  const rejoinText = /rejoin/i.test(text);

  console.log("%c=== Airtime Meet detector probe ===", "font-weight:bold;color:#6366f1");
  console.table(rows);
  console.log({ endedText, rejoinText });

  if (inCall && !ended) {
    console.log("%cIN CALL", "color:#1a7f37;font-weight:bold");
  } else {
    console.log("%cNOT IN CALL", "color:#c2410c;font-weight:bold");
  }
})();
