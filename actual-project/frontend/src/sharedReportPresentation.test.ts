import { describe, expect, it } from 'vitest';
import {
  canShareCountedReport,
  hasActiveCleanupBands,
  sharedBandRows,
} from './sharedReportPresentation';


describe('band-native shared report presentation', () => {
  it('allows any Counted report to use the share flow without requiring legacy counts', () => {
    expect(canShareCountedReport('Counted')).toBe(true);
    expect(canShareCountedReport('Duplicate')).toBe(false);
    expect(canShareCountedReport('Incomplete')).toBe(false);
  });

  it('keeps cleanup active only while a non-Small quantity band remains', () => {
    expect(hasActiveCleanupBands({ Plastic: 'Medium', Glass: 'Small' })).toBe(true);
    expect(hasActiveCleanupBands({ Plastic: 'Small', Glass: 'Small' })).toBe(false);
    expect(hasActiveCleanupBands({})).toBe(false);
  });

  it('presents reported and current quantity bands instead of exact item counts', () => {
    expect(sharedBandRows(
      { Plastic: 'Medium', Glass: 'Large' },
      { Plastic: 'Small', Glass: 'Medium' },
    )).toEqual([
      { category: 'Plastic', reported: 'Medium', current: 'Small' },
      { category: 'Glass', reported: 'Large', current: 'Medium' },
    ]);
  });
});
