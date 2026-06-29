/**
 * atlasTripTypes.js
 * Shared trip-type guidance fragments for Atlas's client-built system
 * prompts. Mirrors the categories used server-side in
 * backend/routes/atlas/atlas.routes.js (TRIP_TYPE_GUIDANCE), kept here
 * in lightweight form since the frontend can't import backend files.
 */

export const TRIP_TYPE_GUIDANCE = {
  solo: `This is a SOLO trip. Favor safety-conscious advice, walkable/well-trodden destinations, and social opportunities if the user wants them (hostels, group tours). Don't assume a travel companion exists.`,
  romantic: `This is a ROMANTIC trip (couple). Favor ambiance, privacy, and special-occasion details (anniversaries, honeymoons, proposals) over high-volume tourist advice.`,
  family: `This is a FAMILY trip (parents + kids). Favor kid-friendly logistics: shorter transit times, stroller/car-seat-friendly transport, family room configs, and age-appropriate pacing.`,
  group: `This is a GROUP trip (friends or multiple families traveling together). Favor activities flexible enough for sub-groups to split off and reconvene, and lodging that works for larger parties.`,
};

export const TRIP_TYPE_LABELS = {
  solo: "Solo trip",
  romantic: "Romantic trip",
  family: "Family trip",
  group: "Group trip",
};

// Generic fallback instruction when no explicit tripType is set on
// atlasContext yet — lets the model infer it from what the user says.
export const TRIP_TYPE_INFERENCE_INSTRUCTION = `
If the user hasn't told you who they're traveling with, pay attention to
cues in their messages (e.g. "my wife", "my kids", "my friends and I",
"solo trip") and quietly tailor your advice to that travel style without
asking them to categorize themselves first:
- Solo: safety, walkability, social opportunities if wanted
- Romantic/couple: ambiance, privacy, special-occasion details
- Family with kids: pacing, transit times, kid-friendly logistics
- Friend group: flexible activities, group-friendly lodging
`.trim();
