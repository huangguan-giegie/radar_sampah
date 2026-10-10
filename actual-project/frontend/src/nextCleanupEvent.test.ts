import { describe, expect, it } from 'vitest';
import { compareCleanupStart, nearestCleanupPerBeach } from './nextCleanupEvent';

const event = (id: string, beachId: string, date: string, startsAt: string) =>
  ({ id, beachId, date, startsAt });

describe('next cleanup per beach', () => {
  it('chooses the earliest calendar date, not the smallest hour across different Saturdays', () => {
    const events = [
      event('late-8am', 'morib', '2026-10-24', '08:00'),
      event('next-9am', 'morib', '2026-10-17', '09:00'),
      event('same-day-7am', 'morib', '2026-10-17', '07:00'),
      event('remis', 'remis', '2026-10-18', '10:00'),
    ];
    expect(nearestCleanupPerBeach(events).map(row => row.id)).toEqual(['same-day-7am', 'remis']);
    expect(events[0].id).toBe('late-8am');
  });
  it('sorts events by date before start time even when a future day starts earlier', () => {
    const events = [
      event('tomorrow-7am', 'morib', '2026-10-18', '07:00'),
      event('today-3pm', 'morib', '2026-10-17', '15:00'),
      event('today-9am', 'morib', '2026-10-17', '09:00'),
    ];
    expect([...events].sort(compareCleanupStart).map(row => row.id)).toEqual(['today-9am', 'today-3pm', 'tomorrow-7am']);
    expect(nearestCleanupPerBeach([])).toEqual([]);
  });
});
