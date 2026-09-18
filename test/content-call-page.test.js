// Unit tests for the MAIN-world call-page detector (content-call-page.js)
// with a mocked DOM. Run with: node test/content-call-page.test.js

const posts = [];
let leavePresent = false;
let endedPresent = false;
let observerCb = null;

const fakeEl = () => ({
  getClientRects: () => [{}],
  getBoundingClientRect: () => ({ width: 100, height: 40 }),
});

global.location = { hostname: "meet.google.com", href: "https://meet.google.com/qrs-tuvw-xyz" };
global.window = { postMessage: (m) => posts.push(m) };
global.getComputedStyle = () => ({ display: "block", visibility: "visible", opacity: "1" });
global.document = {
  body: {},
  querySelector: (sel) => {
    if (endedPresent && (sel.includes("Rejoin") || sel.includes("data-call-ended"))) {
      return fakeEl();
    }
    if (!leavePresent) return null;
    if (sel.includes("Leave call")) return fakeEl();
    return null;
  },
};
global.MutationObserver = class {
  constructor(cb) {
    observerCb = cb;
  }
  observe() {}
  disconnect() {}
};
global.setInterval = () => {};
global.setTimeout = () => {};

require("../content-call-page.js");

const assert = (cond, msg) => {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok:", msg);
};
const last = () => posts.at(-1);

// initial state: no leave control → no events yet
assert(posts.length === 0, "no event before join");

leavePresent = true;
observerCb();
assert(last().type === "joined", "posts joined when leave control appears");
assert(last().source === "call-page" && typeof last().url === "string", "joined carries source + url");

observerCb(); // still in call → no duplicate
assert(posts.length === 1, "no duplicate joined");

leavePresent = false;
observerCb();
assert(last().type === "left", "posts left when leave control disappears");

observerCb(); // still out → no duplicate
assert(posts.length === 2, "no duplicate left");

// rejoin, then the "Rejoin" screen appears while the leave control lingers →
// the ended indicator must force a left
leavePresent = true;
observerCb();
assert(last().type === "joined", "posts joined on rejoin");

endedPresent = true;
observerCb();
assert(last().type === "left", "posts left when ended indicator appears (leave control still present)");

console.log("\nAll detector checks passed.");
