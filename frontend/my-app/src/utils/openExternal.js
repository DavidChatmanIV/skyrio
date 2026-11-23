// Opens an outside site in a new tab. Done with a real link click instead
// of window.open(url, "_blank", "noopener"): Chrome on iPhone opens that
// as a blank page (about:blank). Call it from a tap/click handler.
export function openExternal(url) {
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
