// What kind of room a rate is, from its name (and the property's name):
//   private       – a room of your own
//   mixed_dorm    – a bed in a shared room, any gender
//   female_dorm   – a bed in a female-only shared room (or female-only room)
//   male_dorm     – a bed in a male-only shared room (or male-only room)
//   unknown       – a hostel room whose name doesn't say private or shared
// Hotels/hostels name rooms inconsistently, so this only reads clear words.
const DORM = /\bdorm(s|itory|itories)?\b|\bbed in (a |an )?\d*[- ]?(bed )?(shared|mixed|dorm|room)|\bshared (room|dorm)|\bbunk|\bcapsule|\bpod\b|\bmixed\b/i;
const FEMALE = /\b(female|women'?s?|woman|ladies|girls?)\b/i;
const MALE = /\b(male|men'?s?|man|gents|boys?)\b/i;
const PRIVATE = /\bprivate\b|\bensuite\b|\ben-suite\b/i;
const HOSTEL = /\bhostel\b|\bbackpacker/i;

export const ROOM_LABELS = {
  private: "Private room",
  mixed_dorm: "Mixed dorm (shared room)",
  female_dorm: "Female-only dorm (shared room)",
  male_dorm: "Male-only dorm (shared room)",
  unknown: null,
};

export function roomKindOf(roomName = "", propertyName = "") {
  const name = String(roomName || "");
  const dorm = DORM.test(name) && !/\bprivate\b/i.test(name);
  // "Female only" also applies to rooms not called dorms (hostels).
  const female = FEMALE.test(name);
  const male = !female && MALE.test(name);
  const genderOnly = (female || male) && (dorm || /\bonly\b/i.test(name));
  if (genderOnly) return female ? "female_dorm" : "male_dorm";
  if (dorm) return "mixed_dorm";
  if (PRIVATE.test(name)) return "private";
  if (HOSTEL.test(String(propertyName || ""))) return "unknown";
  return "private";
}

export const isGenderOnly = (kind) => kind === "female_dorm" || kind === "male_dorm";
export const roomLabelOf = (kind) => ROOM_LABELS[kind] ?? null;

/**
 * May Skyrio pick this room for someone automatically? Never a female-only
 * or male-only dorm unless the traveler asked for that one ("female" /
 * "male"). Private rooms and mixed dorms are fine.
 */
export function roomAllowed(kind, genderOnlyDorm = null) {
  if (!isGenderOnly(kind)) return true;
  return (genderOnlyDorm === "female" && kind === "female_dorm") || (genderOnlyDorm === "male" && kind === "male_dorm");
}
