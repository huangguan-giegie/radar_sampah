import type { CleanupAfterBand, LitterCategory, QuantityByCategory } from "./types";
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
  after: CleanupAfterBand,
): Partial<Record<LitterCategory, CleanupAfterBand>> {
  const previous = before[category];
  if (!previous || (after !== 'None' && CLEANUP_BAND_UNITS[after] >= CLEANUP_BAND_UNITS[previous]))
    throw new Error(
      "Choose a lower remaining amount to record a cleanup. If you found more litter, add a new report.",
    );
  return { ...before, [category]: after };
}

/** Apply one cleanup's confirmed after-bands while preserving every category. */
export function applyConfirmedCleanupBands(
  before: QuantityByCategory,
  afterBands: Partial<Record<LitterCategory, CleanupAfterBand>>,
): Partial<Record<LitterCategory, CleanupAfterBand>> {
  const result: Partial<Record<LitterCategory, CleanupAfterBand>> = { ...before };
  for (const [category, after] of Object.entries(afterBands) as [LitterCategory, CleanupAfterBand][]) {
    confirmedCleanupBands(before, category, after);
    result[category] = after;
  }
  return result;
}
