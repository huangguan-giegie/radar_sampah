export const DEMO_CATEGORIES = [
  "Plastic packaging",
  "Fishing gear",
  "Glass",
  "Metal",
  "Other",
];

const MAX_AREA_LENGTH = 120;
const MAX_NOTE_LENGTH = 500;

function isValidDateTime(value) {
  if (!value || Number.isNaN(Date.parse(value))) return false;
  return true;
}

function isSafeImageUrl(value) {
  if (!value) return true;
  if (value.startsWith("/assets/")) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function validateObservation(draft) {
  const errors = {};
  if (!DEMO_CATEGORIES.includes(draft.category)) {
    errors.category = "Choose one of the five demonstration categories.";
  }
  if (!draft.area?.trim()) errors.area = "Enter an approximate area.";
  if (draft.area?.trim().length > MAX_AREA_LENGTH) {
    errors.area = `Keep the area within ${MAX_AREA_LENGTH} characters.`;
  }
  if (!isValidDateTime(draft.observed_at)) {
    errors.observed_at = "Enter a valid observation date and time.";
  }

  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = "Latitude must be between -90 and 90.";
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = "Longitude must be between -180 and 180.";
  }
  if (!isSafeImageUrl(draft.image_url?.trim())) {
    errors.image_url = "Use an HTTPS link or a local /assets/ demo image.";
  }
  if ((draft.note || "").trim().length > MAX_NOTE_LENGTH) {
    errors.note = `Keep the note within ${MAX_NOTE_LENGTH} characters.`;
  }
  return errors;
}

export function buildObservationPayload(draft) {
  const observedAt = draft.observed_at.length === 16
    ? `${draft.observed_at}:00`
    : draft.observed_at;
  return {
    category: draft.category,
    area: draft.area.trim(),
    observed_at: observedAt,
    latitude: Number(draft.latitude),
    longitude: Number(draft.longitude),
    image_url: draft.image_url?.trim() || null,
    note: draft.note?.trim() || null,
  };
}

export function normaliseContextItem(item) {
  const location = item.approximate_location || {};
  const normalised = {
    ...item,
    label: item.label || item.taxon_or_context_label || "Marine context record",
  };
  const latitude = item.latitude ?? location.latitude;
  const longitude = item.longitude ?? location.longitude;
  if (latitude !== undefined) normalised.latitude = Number(latitude);
  if (longitude !== undefined) normalised.longitude = Number(longitude);
  if (item.sensitive !== undefined || item.sensitivity !== undefined) {
    normalised.sensitive = item.sensitive ?? item.sensitivity === "sensitive";
  }
  return normalised;
}

export function getContextMarkers(contextItems) {
  return contextItems
    .map(normaliseContextItem)
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item) => ({
      ...item,
      latitude: item.sensitive ? Math.round(item.latitude * 10) / 10 : item.latitude,
      longitude: item.sensitive ? Math.round(item.longitude * 10) / 10 : item.longitude,
    }));
}

export function getRetryMessage() {
  return "The API could not be reached. Your confirmed input is still here; try again when the service is available.";
}

export function getProgressState(step) {
  const stages = ["report", "review", "results"];
  const activeIndex = stages.indexOf(step);
  return Object.fromEntries(stages.map((stage, index) => [
    stage,
    index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending",
  ]));
}

export function normaliseApiResult(result, fallbackContext = []) {
  const observation = result.observation || result;
  const context = Array.isArray(result.context)
    ? result.context
    : result.context
      ? [result.context]
      : fallbackContext;
  return {
    observation,
    classification: result.classification || {
      label: observation.category,
      method: "Fixed demonstration category selected by the reporter.",
    },
    priority: result.priority || {
      level: "medium",
      reason: "Illustrative clean-up priority only; it is not a pollution-source finding or enforcement decision.",
    },
    context: context.map(normaliseContextItem),
    source: result.source || "Synthetic/public demonstration data",
    data_version: result.data_version || "demo-v1",
    demo: result.demo ?? true,
  };
}
