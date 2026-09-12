import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyseReportPhoto,
  completeCleanup,
  createAdminEvent,
  formatEventDate,
  getCleanupEvent,
  getCleanupTarget,
  joinCleanupEvent,
  listCleanupEvents,
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
  it('generates four Saturday events per configured beach', () => {
    expect(listCleanupEvents()).toHaveLength(16);
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

  it('subtracts confirmed whole-item counts without going below zero', () => {
    const target = getCleanupTarget('morib')!;
    const cleanup = completeCleanup({
      participantId: '1637',
      targetReportId: target.reportId,
      removed: { Plastic: 100, Glass: 2 },
      handling: 'Collected for disposal',
    });
    expect(cleanup.score).toBe(64);
    expect(cleanup.rows.find((row) => row.category === 'Plastic')).toMatchObject({ before: 62, removed: 62, after: 0 });
    expect(getCleanupTarget('morib')?.remaining.Glass).toBe(13);
    expect(completeCleanup({ participantId: '1637', targetReportId: target.reportId, removed: { Glass: 1 }, handling: 'Not recorded' }).id).toBe(cleanup.id);
  });

  it('keeps manual reporting available when AI is unavailable', async () => {
    const result = await analyseReportPhoto('mock/photo.jpg', true);
    expect(result.modelState).toBe('unavailable');
    expect(result.suggestions).toEqual({});
  });
});
