// HTML-escapelés a felhasználói adatokhoz (XSS ellen).
// esc(x): szövegként illeszti be HTML-be (tartalomba vagy "..." attribútumba).
// jsq(x): idézőjeles JS-szövegként illeszti be egy onclick="..." attribútumba.
(function () {
  const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;" };
  window.esc = function (v) {
    return String(v === null || v === undefined ? "" : v).replace(/[&<>"'`]/g, c => MAP[c]);
  };
  window.jsq = function (v) {
    return window.esc(JSON.stringify(String(v === null || v === undefined ? "" : v)));
  };
})();
