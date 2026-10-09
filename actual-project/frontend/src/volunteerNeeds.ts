import type { SeverityBand } from "./types";

/** H15 prototype rule; missing/invalid timestamps never establish an old cleanup. */
export function beachNeedsVolunteers(
  beach: { severity: SeverityBand | null; insufficientData?: boolean },
  lastCleanup: string | null | undefined,
  nextEventJoined: number | 'Fewer than 3' | undefined,
  now: number,
) {
  if (beach.insufficientData || !["Moderate", "High", "Severe"].includes(beach.severity ?? "")) return false;
  const last = lastCleanup ? Date.parse(lastCleanup) : NaN;
  const noRecentCleanup = lastCleanup === null || (Number.isFinite(last) && now - last >= 30 * 86400000);
  return noRecentCleanup || (nextEventJoined === 'Fewer than 3' || nextEventJoined !== undefined && nextEventJoined < 3);
}
