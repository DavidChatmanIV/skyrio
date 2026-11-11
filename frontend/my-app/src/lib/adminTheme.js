// Skyrio look for the admin pages: warm purple with orange, same as the
// public site. No blur (backdrop-filter) on purpose: blurred layers on
// these long pages made Chrome on Mac skip drawing parts of the page.
export const ADMIN = {
  // Page: orange glow top-left, purple glow top-right, deep purple base.
  pageBg:
    "radial-gradient(900px 520px at 0% -8%, rgba(255,138,42,0.16), transparent 62%), " +
    "radial-gradient(1000px 680px at 100% -6%, rgba(155,92,255,0.30), transparent 60%), " +
    "linear-gradient(180deg, #2c1757 0px, #22124a 700px, #1d0f3e 100%)",
  pageBase: "#1d0f3e",
  // Cards: the site's purple glass, drawn without blur.
  card: "linear-gradient(160deg, rgba(86,48,130,0.55) 0%, rgba(44,24,82,0.72) 100%)",
  // Solid surfaces: sticky bars, drawers, modals, popovers, inputs.
  solid: "#2a1652",
  solidRaised: "#341c63",
  field: "rgba(20,10,44,0.55)",
  border: "rgba(255,255,255,0.14)",
  borderStrong: "rgba(255,255,255,0.24)",
  topline: "linear-gradient(90deg, #ff8a2a, #ffb347 40%, #9b5cff)",
  text: "rgba(255,255,255,0.82)",
  muted: "rgba(255,255,255,0.6)",
};
