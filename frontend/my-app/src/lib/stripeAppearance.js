// One Skyrio look for every Stripe payment form (hotel and flight
// checkout, Duffel, saved cards in Atlas). Stripe draws its fields in its
// own frame, so the theme has to be passed in here; page CSS can't reach
// it. Stripe only accepts solid colors, so these are the solid versions of
// Skyrio's purple glass, with the orange accent. No near-black boxes
// (the "Save my information for faster checkout" box from Link was #100c22).

const SANS =
  '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

export const SKYRIO_PURPLE = "#2a1652"; // Skyrio solid surface
const RAISED = "#341c63"; // boxes inside the form (Link, saved cards)
const FIELD = "#3a2170"; // input fields
const EDGE = "rgba(255,255,255,0.16)";
const ORANGE = "#ff8a2a";

export function skyrioStripeAppearance(fontFamily = SANS) {
  return {
    theme: "night",
    variables: {
      colorPrimary: ORANGE,
      colorBackground: SKYRIO_PURPLE,
      colorText: "#ffffff",
      colorTextSecondary: "rgba(255,255,255,0.68)",
      colorTextPlaceholder: "rgba(255,255,255,0.45)",
      // Payment-method tabs (Card / Bank / Klarna). Stripe's night theme
      // drew the selected tab's icon and label dark, so they vanished on
      // purple. Keep every tab readable.
      tabIconColor: "rgba(255,255,255,0.75)",
      tabIconHoverColor: "#ffffff",
      tabIconSelectedColor: "#ffffff",
      tabIconMoreColor: "rgba(255,255,255,0.75)",
      tabIconMoreHoverColor: "#ffffff",
      iconColor: "rgba(255,255,255,0.75)",
      iconChevronDownColor: "rgba(255,255,255,0.75)",
      colorDanger: "#f87171",
      fontFamily,
      borderRadius: "12px",
      spacingUnit: "4px",
    },
    rules: {
      ".Input": {
        backgroundColor: FIELD,
        border: `1px solid ${EDGE}`,
        boxShadow: "none",
      },
      ".Input:focus": {
        border: `1px solid ${ORANGE}`,
        boxShadow: "0 0 0 3px rgba(255,138,42,0.3)",
      },
      ".Input--invalid": { border: "1px solid #f87171" },
      ".Label": { color: "rgba(255,255,255,0.68)", fontSize: "12px", fontWeight: "600" },
      // Containers inside the form: Link's "Save my information" box,
      // saved payment methods, accordion rows.
      ".Block": {
        backgroundColor: RAISED,
        border: `1px solid ${EDGE}`,
        boxShadow: "none",
      },
      ".AccordionItem": {
        backgroundColor: RAISED,
        border: `1px solid ${EDGE}`,
        boxShadow: "none",
      },
      ".Tab": {
        backgroundColor: RAISED,
        border: `1px solid ${EDGE}`,
        boxShadow: "none",
      },
      ".Tab--selected": {
        border: `1px solid ${ORANGE}`,
        backgroundColor: FIELD,
        color: "#ffffff",
        boxShadow: "0 0 0 1px rgba(255,138,42,0.35)",
      },
      ".Tab--selected:hover": { color: "#ffffff" },
      ".Tab--selected:focus": { color: "#ffffff" },
      ".Tab:hover": { color: "#ffffff" },
      ".TabLabel": { color: "rgba(255,255,255,0.8)" },
      ".TabLabel--selected": { color: "#ffffff", fontWeight: "600" },
      ".TabIcon": { color: "rgba(255,255,255,0.75)", fill: "rgba(255,255,255,0.75)" },
      ".TabIcon--selected": { color: "#ffffff", fill: "#ffffff" },
      ".PickerItem": { backgroundColor: RAISED, border: `1px solid ${EDGE}` },
      ".PickerItem--selected": { border: `1px solid ${ORANGE}` },
      ".Menu": { backgroundColor: RAISED, border: `1px solid ${EDGE}` },
      ".CheckboxInput": { backgroundColor: FIELD, border: `1px solid ${EDGE}` },
      ".CheckboxInput--checked": { backgroundColor: ORANGE, borderColor: ORANGE },
    },
  };
}

export default skyrioStripeAppearance;
