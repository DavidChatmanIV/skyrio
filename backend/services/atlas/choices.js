// Tappable answers in Atlas replies (see TRAVELER_STYLE_RULES).
/**
 * Atlas ends a question with "[[choices: A | B | C]]". Split that off the
 * reply → { text, choices } (2–6 short choices, or [] if none/garbled).
 */
export function splitChoices(text) {
  const raw = String(text || "");
  const m = raw.match(/\n?\s*\[\[\s*choices\s*:\s*([^\]]*?)\s*\]\]\s*$/i);
  if (!m) return { text: raw.replace(/\[\[\s*choices\s*:[^\]]*\]\]/gi, "").trim(), choices: [] };
  const choices = [
    ...new Set(
      m[1]
        .split("|")
        .map((c) => c.replace(/[*_`]/g, "").trim())
        .filter((c) => c && c.length <= 40)
    ),
  ].slice(0, 6);
  return {
    text: raw.slice(0, m.index).replace(/\[\[\s*choices\s*:[^\]]*\]\]/gi, "").trim(),
    choices: choices.length >= 2 ? choices : [],
  };
}
