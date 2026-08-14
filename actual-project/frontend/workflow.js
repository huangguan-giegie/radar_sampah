export const DEMO_HOTSPOTS = [
  { id: "tioman-coast", area: "Tioman coastal area", level: "High", context: "Illustrative reports of packaging after busy weekends." },
  { id: "kuala-selangor-coast", area: "Kuala Selangor coastal area", level: "Medium", context: "Mixed shoreline litter reported by local volunteers." },
  { id: "terengganu-coast", area: "Terengganu coastal area", level: "Watch", context: "Recurring fishing-gear and container reports." },
];

const litterTypes = ["Plastic packaging", "Fishing gear", "Glass", "Metal", "Other"];
const equipmentPlans = ["Gloves, bags and sorting sheet", "Gloves, tongs and sharps container", "Join an organised cleanup"];

export function getDemoHotspots() { return DEMO_HOTSPOTS; }

export function validateLitterReport(draft) {
  const errors = {};
  if (!DEMO_HOTSPOTS.some((hotspot) => hotspot.id === draft.area_id)) errors.area_id = "Choose a broad reporting area.";
  if (!litterTypes.includes(draft.litter_type)) errors.litter_type = "Choose the main litter type.";
  if (!(draft.description || "").trim()) errors.description = "Describe what needs attention.";
  if ((draft.description || "").trim().length > 500) errors.description = "Keep the description within 500 characters.";
  return errors;
}

export function buildLitterReport(draft) {
  return { area_id: draft.area_id, litter_type: draft.litter_type, description: draft.description.trim() };
}

export function getDemoDetection(draft) {
  const label = draft.litter_type === "Mixed litter" ? "Likely mixed shoreline litter" : `Likely ${draft.litter_type.toLowerCase()}`;
  return { label, confidence: 82, source: "Demo fallback" };
}

export function validateCleanupMission(mission) {
  const errors = {};
  if (!Number.isInteger(Number(mission.team_size)) || Number(mission.team_size) < 1) errors.team_size = "Enter at least one cleanup participant.";
  if (!equipmentPlans.includes(mission.equipment)) errors.equipment = "Choose the equipment plan.";
  if (mission.confirmed !== true && mission.confirmed !== "on") errors.confirmed = "Confirm the detection before starting a mission.";
  return errors;
}

export function getRetryMessage() {
  return "Detection is unavailable. Your report is saved locally; retry or continue with the demo result.";
}

export function getProgressState(step) {
  const stages = ["report", "detection", "context", "mission", "impact", "progress"];
  const activeIndex = stages.indexOf(step);
  return Object.fromEntries(stages.map((stage, index) => [stage, index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending"]));
}
