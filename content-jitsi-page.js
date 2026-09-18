// Runs inside the meet.jit.si page itself (world: MAIN).
// Jitsi Meet keeps its app state on window.APP — we subscribe to the conference
// events and relay them to the content script via postMessage (the page context
// has no direct access to chrome.runtime).

(function () {
  const POST = (type) => window.postMessage({ source: "jst-page", type }, "*");
  let hookedRoom = null;

  function poll() {
    try {
      const room = window.APP?.conference?._room;
      // _room is recreated on every join — hook each new object
      if (room && room !== hookedRoom && typeof room.on === "function") {
        hookedRoom = room;
        room.on("conference.joined", () => POST("joined"));
        room.on("conference.left", () => POST("left"));
        // if the content script attached while we are already in a call
        if (window.APP.conference.isJoined()) POST("joined");
      }
    } catch {
      // page not initialized yet — keep polling
    }
    setTimeout(poll, 1000);
  }

  poll();
})();