export const DEMO_DIVE_SITES = [
  { id: "tioman-demo", name: "Tioman reef demonstration zone", map_latitude: 2.788, map_longitude: 104.169, briefing: "Check your buddy, buoyancy and sea state. Stay with your guide." },
  { id: "perhentian-demo", name: "Perhentian reef demonstration zone", map_latitude: 5.918, map_longitude: 102.736, briefing: "Use calm entries, watch your depth and protect the reef." },
];

export const DEMO_SPECIES = [
  { id: "clownfish-demo", name: "Clownfish", note: "Orange body with pale bands; similar species exist." },
  { id: "parrotfish-demo", name: "Parrotfish", note: "A broad reef-fish demo label." },
  { id: "seahorse-sensitive-demo", name: "Seahorse", note: "Sensitive example. Exact locations are never recorded." },
];

const profiles = ["Open Water student", "Certified recreational diver", "Dive guide (demo)"];
const activities = ["Sighting only", "Collection with operator support"];

export function getDemoDiveSites() { return DEMO_DIVE_SITES; }
export function getSpeciesForSite(siteId) {
  return DEMO_DIVE_SITES.some((site) => site.id === siteId)
    ? DEMO_SPECIES.map((species) => ({ ...species, source: "DiveSafe MY demo directory" }))
    : [];
}

export function getProgressState(step) {
  const stages = ["profile", "site", "briefing", "confirm", "record"];
  const activeIndex = stages.indexOf(step);
  return Object.fromEntries(stages.map((stage, index) => [stage, index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending"]));
}

export function getRetryMessage() {
  return "The service is unavailable. Your confirmed demo record is still here; try again or continue with the demo result.";
}

export function validateSighting(draft) {
  const errors = {};
  if (!profiles.includes(draft.profile)) errors.profile = "Choose your demo diver profile.";
  if (!DEMO_DIVE_SITES.some((site) => site.id === draft.site_id)) errors.site_id = "Choose a dive site.";
  if (!getSpeciesForSite(draft.site_id).some((species) => species.id === draft.species_id)) errors.species_id = "Choose a species from the directory.";
  if (!activities.includes(draft.activity)) errors.activity = "Choose sighting only or collection.";
  if (!draft.observed_at || Number.isNaN(Date.parse(draft.observed_at))) errors.observed_at = "Enter a valid date and time.";
  if ((draft.note || "").trim().length > 500) errors.note = "Keep the note within 500 characters.";
  return errors;
}

export function buildSightingPayload(draft) {
  return {
    site_id: draft.site_id,
    species_id: draft.species_id,
    observed_at: draft.observed_at.length === 16 ? `${draft.observed_at}:00` : draft.observed_at,
    note: draft.note?.trim() || null,
  };
}
