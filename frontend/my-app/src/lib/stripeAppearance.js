// One Skyrio look for every Stripe payment form (hotel and flight
// checkout, Duffel, saved cards in Atlas). Stripe draws its fields in its
// own frame, so page CSS can't reach them; the theme is passed in here.
//
// Glass: Stripe's frame is see-through, so fields, tabs and the Link box
// use the same translucent white fills as Skyrio's booking cards and let
// the purple page show through. (Stripe takes no gradients or blur, and
// its base color variables must be solid; rules can be translucent.)
// No near-black boxes anywhere.

const SANS =
  '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

// Solid fallback Stripe uses where it can't be see-through (menus, popups).
export const SKYRIO_PURPLE = "#2e1852";

const GLASS = "rgba(255,255,255,0.06)"; // fields (matches --sk-glass-light)
const GLASS_UP = "rgba(255,255,255,0.09)"; // hover
const PANEL = "rgba(255,255,255,0.045)"; // boxes: Link, saved cards, tabs
const EDGE = "rgba(255,255,255,0.14)";
const EDGE_SOFT = "rgba(255,255,255,0.10)";
const ORANGE = "#ff8a2a";
const ORANGE_TINT = "rgba(255,138,42,0.14)";
const ORANGE_RING = "0 0 0 3px rgba(255,138,42,0.28)";
const TEXT = "#ffffff";
const TEXT_SOFT = "rgba(255,255,255,0.72)";
const TEXT_DIM = "rgba(255,255,255,0.45)";
const SHINE = "inset 0 1px 0 rgba(255,255,255,0.08)";

export function skyrioStripeAppearance(fontFamily = SANS) {
  return {
    theme: "night",
    variables: {
      colorPrimary: ORANGE,
      colorBackground: SKYRIO_PURPLE,
      colorText: TEXT,
      colorTextSecondary: TEXT_SOFT,
      colorTextPlaceholder: TEXT_DIM,
      colorDanger: "#f87171",
      colorSuccess: "#4ade80",
      fontFamily,
      fontSizeBase: "16px",
      borderRadius: "14px",
      spacingUnit: "4px",
      // Tabs (Card / Bank / Klarna) and icons stay readable on purple.
      tabIconColor: TEXT_SOFT,
      tabIconHoverColor: TEXT,
      tabIconSelectedColor: TEXT,
      tabIconMoreColor: TEXT_SOFT,
      tabIconMoreHoverColor: TEXT,
      iconColor: TEXT_SOFT,
      iconHoverColor: TEXT,
      iconChevronDownColor: TEXT_SOFT,
      iconCheckmarkColor: "#1a0e06",
      accessibleColorOnColorPrimary: "#1a0e06",
    },
    rules: {
      // Fields
      ".Input": {
        backgroundColor: GLASS,
        border: `1px solid ${EDGE}`,
        boxShadow: SHINE,
        color: TEXT,
      },
      ".Input:hover": { backgroundColor: GLASS_UP },
      ".Input:focus": {
        backgroundColor: GLASS_UP,
        border: `1px solid ${ORANGE}`,
        boxShadow: ORANGE_RING,
      },
      ".Input--invalid": { border: "1px solid #f87171", boxShadow: "none" },
      ".Input::placeholder": { color: TEXT_DIM },
      ".Label": { color: TEXT_SOFT, fontSize: "13px", fontWeight: "600" },
      ".Error": { color: "#fca5a5" },

      // Boxes inside the form: Link's "Save my information", saved cards
      ".Block": {
        backgroundColor: PANEL,
        border: `1px solid ${EDGE_SOFT}`,
        boxShadow: SHINE,
      },
      ".BlockDivider": { backgroundColor: EDGE_SOFT },
      ".AccordionItem": {
        backgroundColor: PANEL,
        border: `1px solid ${EDGE_SOFT}`,
        boxShadow: SHINE,
        color: TEXT,
      },
      ".AccordionItem--selected": { border: `1px solid ${ORANGE}` },

      // Payment-method tabs
      ".Tab": {
        backgroundColor: PANEL,
        border: `1px solid ${EDGE_SOFT}`,
        boxShadow: SHINE,
        color: TEXT_SOFT,
      },
      ".Tab:hover": { backgroundColor: GLASS_UP, color: TEXT },
      ".Tab--selected": {
        backgroundColor: ORANGE_TINT,
        border: `1px solid ${ORANGE}`,
        boxShadow: "0 0 18px rgba(255,138,42,0.25)",
        color: TEXT,
      },
      ".Tab--selected:hover": { color: TEXT },
      ".Tab--selected:focus": { color: TEXT, boxShadow: ORANGE_RING },
      ".TabLabel": { color: TEXT_SOFT },
      ".TabLabel--selected": { color: TEXT, fontWeight: "600" },
      ".TabIcon": { color: TEXT_SOFT, fill: TEXT_SOFT },
      ".TabIcon--selected": { color: TEXT, fill: TEXT },

      // Lists and menus
      ".PickerItem": {
        backgroundColor: PANEL,
        border: `1px solid ${EDGE_SOFT}`,
        color: TEXT,
      },
      ".PickerItem--selected": {
        backgroundColor: ORANGE_TINT,
        border: `1px solid ${ORANGE}`,
      },
      ".Menu": { backgroundColor: SKYRIO_PURPLE, border: `1px solid ${EDGE}` },

      // Checkboxes
      ".CheckboxInput": { backgroundColor: GLASS, border: `1px solid ${EDGE}` },
      ".CheckboxInput--checked": { backgroundColor: ORANGE, borderColor: ORANGE },
      ".CheckboxLabel": { color: TEXT_SOFT },

      // Links and small print in Skyrio's warm orange
      ".Link": { color: "#ffb347" },
      ".TermsText": { color: TEXT_DIM },
      ".TermsLink": { color: "#ffb347" },
    },
  };
}

export default skyrioStripeAppearance;
