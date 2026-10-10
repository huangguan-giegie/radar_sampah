import type { CleanupEvent } from './iteration2';

type ScheduledEvent = Pick<CleanupEvent, 'beachId' | 'date' | 'startsAt'>;

/** Compare the event date first; comparing time alone picks the wrong Saturday. */
export function compareCleanupStart(a: ScheduledEvent, b: ScheduledEvent): number {
  return a.date.localeCompare(b.date) || a.startsAt.localeCompare(b.startsAt);
}

/** Keep the nearest upcoming event per beach without changing the input ordering. */
export function nearestCleanupPerBeach<T extends ScheduledEvent>(events: readonly T[]): T[] {
  const nearest = new Map<string, T>();
  for (const event of events) {
    const current = nearest.get(event.beachId);
    if (!current || compareCleanupStart(event, current) < 0) nearest.set(event.beachId, event);
  }
  return [...nearest.values()];
}
