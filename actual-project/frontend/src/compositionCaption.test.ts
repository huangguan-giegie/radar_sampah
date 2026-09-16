import { describe, expect, it } from 'vitest';
import { compositionFooter } from './screens/BeachScreen';
import { initialFor } from './useAsyncData';

describe('shared loader initial value', () => {
  it('starts array payloads empty instead of null', () => {
    expect(initialFor([1, 2, 3])).toEqual([]);
    expect(initialFor(null)).toBeNull();
  });
});

describe('composition caption', () => {
  const active = { method: 'active_report_estimate' as const, activeReportCount: 16, windowDays: 90 };

  it('names the active-report window instead of a single report date', () => {
    expect(compositionFooter(active)).toBe('16 ACTIVE REPORTS · LAST 90 DAYS');
  });

  it('still dates a single-report source and survives a missing source', () => {
    // A past date keeps this assertion stable: formatDate answers "Today" for
    // the current day, which would make the expected string depend on the
    // calendar rather than on the helper.
    const single = { method: 'reported_quantity_estimate' as const, reportId: 'r_1', createdAt: '2026-08-19T18:00:00+08:00' };
    expect(compositionFooter(single)).toBe('REPORT 2026-08-19 (WED)');
    expect(compositionFooter(null)).toBe('BACKEND CALCULATED');
  });
});
