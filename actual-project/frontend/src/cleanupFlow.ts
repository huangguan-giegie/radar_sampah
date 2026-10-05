import type { LitterCategory, QuantityBand, QuantityByCategory } from "./types";
import { CLEANUP_BAND_UNITS } from "./iteration2";
export function cleanupDestination(beachId: string, eventId?: string | null) {
  return (
    "/cleanup/" +
    encodeURIComponent(beachId) +
    (eventId ? "?event=" + encodeURIComponent(eventId) : "")
  );
}
export function cleanupDoneDestination(eventId?: string | null) {
  return eventId ? "/events/" + encodeURIComponent(eventId) : "/home";
}
export function confirmedCleanupBands(
  before: QuantityByCategory,
  category: LitterCategory,
  after: QuantityBand,
): QuantityByCategory {
  const previous = before[category];
  if (!previous || CLEANUP_BAND_UNITS[after] >= CLEANUP_BAND_UNITS[previous])
    throw new Error(
      "Choose a lower remaining amount to record a cleanup. If you found more litter, add a new report.",
    );
  return { ...before, [category]: after };
}
