/**
 * Derives trip composition (family/friends/multi-family/etc) and
 * voting weights from a SyncGroup document.
 *
 * Detection signals, in priority order:
 *  1. Explicit tripComposition.category (set by "who's coming?" UI step)
 *  2. Structural inference from member shape:
 *     - "dependent" = member with no `user` AND no `email` (name-only)
 *     - "independent" = member with `user` and/or `email`
 *     - familyUnit groups members into blocks for unit-based voting
 */

export function classifyComposition(group) {
  // 1. Explicit signal always wins
  if (group.tripComposition?.category) {
    return group.tripComposition.category;
  }

  // Solo: owner only, no other members at all
  if (!group.members || group.members.length === 0) {
    return "solo";
  }

  const independents = group.members.filter((m) => m.user || m.email);
  const dependents = group.members.filter((m) => !m.user && !m.email);
  const familyUnits = new Set(
    group.members.map((m) => m.familyUnit).filter(Boolean)
  );

  // 2+ distinct family units present -> multi-family trip
  if (familyUnits.size >= 2) return "multiFamily";

  // Only dependents, no other independent adults besides the owner
  // -> classic parent(s) + kids trip
  if (independents.length === 0 && dependents.length > 0) {
    return "immediateFamily";
  }

  // Mix of independent adults and dependents, but only one family unit
  // (e.g. mom, dad, kids, plus one grandparent who has their own account)
  if (independents.length > 0 && dependents.length > 0) {
    return "mixed";
  }

  // All independent adults, no dependents -> friend group
  if (independents.length > 0 && dependents.length === 0) {
    return "friends";
  }

  return "friends"; // sensible fallback
}

/**
 * Returns voting units for facilitator/mediator mode.
 * Each unit gets exactly 1 vote regardless of how many people are in it,
 * so a family of 5 can't outvote a couple 5-to-2.
 *
 * Returns: [{ unitId, type, memberIds, voteWeight: 1 }]
 */
export function getVotingUnits(group) {
  const units = new Map();

  for (const member of group.members) {
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

/**
 * Returns which Atlas "mode" should drive the conversation for this trip.
 */
export function getAtlasMode(category) {
  switch (category) {
    case "immediateFamily":
    case "solo":
    case "romantic":
      return "concierge"; // confirm with single decision-maker
    case "multiFamily":
      return "mediator"; // per-unit options, then unit-level vote
    case "friends":
    case "mixed":
    default:
      return "facilitator"; // tally votes, nudge toward consensus
  }
}

/**
 * Builds the prompt fragment to inject into Atlas's system prompt
 * based on trip composition. Append this to whatever base persona
 * prompt the trip-planning call uses.
 */
export function buildCompositionPromptFragment(group) {
  const category = classifyComposition(group);
  const mode = getAtlasMode(category);
  const units = getVotingUnits(group);

  const fragments = {
    concierge: `
This trip is for an individual or single family unit with one primary
decision-maker. Speak directly to the organizer. Confirm choices with
them rather than soliciting a group vote. Surface logistics relevant
to the trip type (kid-friendly pacing and room configs for family
trips; privacy/ambiance and special-occasion add-ons for romantic
trips; safety info and flexible itinerary for solo trips).`,
    facilitator: `
This trip has ${units.length} independent travelers, each with an equal
vote. Present 2-3 concrete options for any decision (dates, activities,
lodging) rather than asking an open-ended question. Tally stated
preferences explicitly and call out when the group is split. If a
decision stalls, suggest the group's designated organizer break the tie.`,
    mediator: `
This trip spans ${units.length} separate family units, each casting ONE
vote regardless of its size. Present options first at the per-unit
level (ask each family what they'd prefer), THEN surface the
cross-unit vote. Do not let a larger family's headcount outweigh a
smaller unit's vote. Flag clearly when units disagree rather than
forcing a premature decision.`,
  };

  return fragments[mode].trim();
}
