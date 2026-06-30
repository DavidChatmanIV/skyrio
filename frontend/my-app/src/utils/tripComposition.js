/**
 * tripComposition.js (frontend)
 * Mirrors backend/services/tripComposition.js classification logic so
 * SyncGroupPage can build composition-aware prompts for Atlas without
 * a backend round-trip. Keep in sync if the backend rules ever change.
 */

export function classifyComposition(group) {
  if (group?.tripComposition?.category) {
    return group.tripComposition.category;
  }
  const members = group?.members || [];
  if (members.length === 0) return "solo";

  const independents = members.filter((m) => m.user || m.email);
  const dependents = members.filter((m) => !m.user && !m.email);
  const familyUnits = new Set(members.map((m) => m.familyUnit).filter(Boolean));

  if (familyUnits.size >= 2) return "multiFamily";
  if (independents.length === 0 && dependents.length > 0)
    return "immediateFamily";
  if (independents.length > 0 && dependents.length > 0) return "mixed";
  if (independents.length > 0 && dependents.length === 0) return "friends";
  return "friends";
}

export function getVotingUnits(group) {
  const units = new Map();
  for (const member of group?.members || []) {
    if (!member.user && !member.email) continue; // dependents don't vote
    const key = member.familyUnit || String(member._id);
    if (!units.has(key)) {
      units.set(key, {
        unitId: key,
        type: member.familyUnit ? "familyUnit" : "individual",
        memberIds: [],
        voteWeight: 1,
      });
    }
    units.get(key).memberIds.push(member._id);
  }
  return Array.from(units.values());
}

export function getAtlasMode(category) {
  switch (category) {
    case "immediateFamily":
    case "solo":
    case "romantic":
      return "concierge";
    case "multiFamily":
      return "mediator";
    case "friends":
    case "mixed":
    default:
      return "facilitator";
  }
}

/**
 * Builds a short instruction block describing who's traveling, to be
 * inserted directly into the planning prompt sent to Atlas.
 */
export function buildCompositionInstructions(group) {
  const category = classifyComposition(group);
  const mode = getAtlasMode(category);
  const units = getVotingUnits(group);

  const fragments = {
    concierge:
      "This trip is for an individual or single family unit with one primary decision-maker. Tailor pacing and recommendations accordingly — kid-friendly logistics and room configs if this is a family trip; privacy, ambiance, and special-occasion touches if romantic; safety and flexibility if solo.",
    facilitator: `This trip has ${units.length} independent travelers with possibly different preferences. Suggest options flexible enough for sub-groups to split off and reconvene, and lodging that works well for the whole party.`,
    mediator: `This trip spans ${units.length} separate family units traveling together. Build the itinerary with some shared group activities and some optional/split activities, so each family can opt in or out without needing full consensus on everything.`,
  };

  return fragments[mode];
}
