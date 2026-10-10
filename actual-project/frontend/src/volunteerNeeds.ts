import type { SeverityBand } from "./types";

/** One beach row uses its earliest eligible event, regardless of API ordering. */
export function nextEventPerBeach<T extends { beachId: string; startsAt: string }>(events: readonly T[]): T[] {
  const byBeach = new Map<string, T>();
  for (const event of [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
    if (!byBeach.has(event.beachId)) byBeach.set(event.beachId, event);
  }
  return [...byBeach.values()];
}

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
