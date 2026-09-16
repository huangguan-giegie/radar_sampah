import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyseReportPhoto,
  completeCleanup,
  canRecordAttendance,
  createAdminEvent,
  formatEventDate,
  getCleanupEvent,
  getCleanupTarget,
  hasEventEvidence,
  joinCleanupEvent,
  listCleanupEvents,
  recordAttendance,
  recordCheckIn,
  recordEventReportEvidence,
} from './iteration2';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });

beforeEach(() => storage.clear());

describe('Iteration 2 date presentation', () => {
  it('prints the exact date first and the verified weekday in brackets', () => {
    expect(formatEventDate('2026-09-12')).toBe('2026-09-12 (Sat)');
    expect(formatEventDate('2026-09-16')).toBe('2026-09-16 (Wed)');
  });
});

describe('Iteration 2 activity and cleanup ledger', () => {
  it('generates four Saturday events only for beaches with a qualifying band', () => {
    const events = listCleanupEvents();
    expect(events).toHaveLength(12);
    expect(events.some((event) => event.beachId === 'kelanang')).toBe(false);
  });

  it('makes Join idempotent for the same participant and event', () => {
    const event = listCleanupEvents().find((item) => item.beachId === 'morib')!;
    const first = joinCleanupEvent(event.id, '1637');
    const second = joinCleanupEvent(event.id, '1637');
    expect(second.participantCount).toBe(first.participantCount);
    expect(second.joinedBy).toEqual(['1637']);
  });

  it('creates at most one admin event for a beach and date', () => {
    const first = createAdminEvent({ beachId: 'morib', date: '2030-01-02' });
    const second = createAdminEvent({ beachId: 'morib', date: '2030-01-02' });
    expect(second.id).toBe(first.id);
    expect(getCleanupEvent(first.id)?.source).toBe('admin');
  });

  it('records only confirmed lower quantity bands and is idempotent per report', () => {
    const target = getCleanupTarget('morib')!;
    const cleanup = completeCleanup({
      participantId: '1637',
      targetReportId: target.reportId,
      afterBands: { Plastic: 'Large', Glass: 'Small' },
      handling: 'Collected for disposal',
    });
    expect(cleanup.score).toBe(3);
    expect(cleanup.rows.find((row) => row.category === 'Plastic')).toMatchObject({ beforeBand: 'Very Large', afterBand: 'Large', score: 1 });
    expect(getCleanupTarget('morib')?.remainingBands.Glass).toBe('Small');
    expect(completeCleanup({ participantId: '1637', targetReportId: target.reportId, afterBands: { Glass: 'Small' }, handling: 'Not recorded' }).id).toBe(cleanup.id);
  });

  it('refuses a cleanup linked to an activity at another beach', () => {
    const target = getCleanupTarget('morib')!;
    const otherBeachEvent = listCleanupEvents().find((item) => item.beachId === 'remis')!;
    joinCleanupEvent(otherBeachEvent.id, '1637');

    expect(() => completeCleanup({
      participantId: '1637',
      targetReportId: target.reportId,
      eventId: otherBeachEvent.id,
      afterBands: { Plastic: 'Large' },
      handling: 'Not recorded',
    })).toThrow('activity beach');
  });

  it('keeps manual reporting available when AI is unavailable', async () => {
    const result = await analyseReportPhoto('mock/photo.jpg', 'unavailable');
    expect(result.modelState).toBe('unavailable');
    expect(result.suggestions).toEqual({});
  });

  it('requires a separate attendance confirmation after check-in and cleanup evidence', () => {
    const event = listCleanupEvents().find((item) => item.beachId === 'morib')!;
    const target = getCleanupTarget('morib')!;
    joinCleanupEvent(event.id, '1637');
    recordCheckIn(event.id, '1637', 'within_area');
    expect(canRecordAttendance(event.id, '1637')).toBe(false);

    completeCleanup({
      participantId: '1637',
      targetReportId: target.reportId,
      eventId: event.id,
      afterBands: { Plastic: 'Large' },
      handling: 'Not recorded',
    });

    expect(hasEventEvidence(event.id, '1637')).toBe(true);
    expect(getCleanupEvent(event.id)?.attendanceBy).toEqual([]);
    expect(canRecordAttendance(event.id, '1637')).toBe(true);
    expect(recordAttendance(event.id, '1637').attendanceBy).toEqual(['1637']);
  });

  it('also accepts a same-event, same-beach report as evidence without auto-recording attendance', () => {
    const event = listCleanupEvents().find((item) => item.beachId === 'morib')!;
    joinCleanupEvent(event.id, '1637');
    recordCheckIn(event.id, '1637', 'within_area');
    recordEventReportEvidence(event.id, '1637', 'r-new', 'morib');

    expect(hasEventEvidence(event.id, '1637')).toBe(true);
    expect(getCleanupEvent(event.id)?.attendanceBy).toEqual([]);
    expect(recordAttendance(event.id, '1637').attendanceBy).toEqual(['1637']);
  });
});
