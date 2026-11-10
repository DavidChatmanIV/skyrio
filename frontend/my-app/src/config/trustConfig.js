// ─────────────────────────────────────────────────────────────────────────────
// Trust pages settings — Guarantee, Support, About.
// Change these numbers in ONE place and every page updates.
// Only promise what you can actually keep every time.
// ─────────────────────────────────────────────────────────────────────────────

export const TRUST = {
  supportEmail: "skyrioofficial@gmail.com",

  // How fast a real person replies to a support email/case.
  // "Business day" means weekends don't count against you.
  responseTime: "within 1 business day",

  // How fast Skyrio starts a refund once it's approved.
  refundStartDays: 2, // business days

  // How long card refunds usually take to show up (set by banks, not Skyrio).
  cardRefundDays: "5–10 business days",

  company: "Skyrio LLC",
  location: "New Jersey, USA",
  founder: "David Chatman IV",
  founderTitle: "Founder & CEO",

  // DMCA designated agent, shown on the SkyHub safety page (Copyright).
  // Leave null until Skyrio is registered at copyright.gov/dmca-directory:
  // the line stays hidden, so the page never shows a placeholder or claims
  // an agent that isn't registered. Then fill in exactly what you filed:
  //   dmcaAgent: { name: "David Chatman IV, Skyrio LLC", address: "…", email: "…" },
  dmcaAgent: null,

  // Last time the guarantee wording changed. Update when you edit it.
  guaranteeUpdated: "November 2026",
};
