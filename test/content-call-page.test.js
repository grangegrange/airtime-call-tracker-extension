// Unit tests for the MAIN-world call-page detector (content-call-page.js)
// with a mocked DOM. Run with: node test/content-call-page.test.js

const posts = [];
let leavePresent = false;
let observerCb = null;

global.location = { hostname: "meet.google.com", href: "https://meet.google.com/qrs-tuvw-xyz" };
global.window = { postMessage: (m) => posts.push(m) };
global.document = {
  body: {},
  querySelector: (sel) => {
    if (!leavePresent) return null;
    if (sel.includes("Leave call")) return { getClientRects: () => [{}] };
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

console.log("\nAll detector checks passed.");
