import { describe, expect, it } from 'vitest';
import { cleanupBandLabelForRow } from './iteration2';

describe('recorded cleanup bands', () => {
  it('shows the before and after evidence without inferring a removed quantity', () => {
    expect(cleanupBandLabelForRow({ category: 'Plastic', beforeBand: 'Very Large', afterBand: 'Medium', score: 2 }))
      .toBe('Very Large → Medium');
    expect(cleanupBandLabelForRow({ category: 'Glass', beforeBand: 'Medium', afterBand: 'Medium', score: 0 }))
      .toBe('Medium → Medium');
  });

  it('preserves a removed band that was directly recorded in a standalone cleanup', () => {
    expect(cleanupBandLabelForRow({ category: 'Plastic', removedBand: 'Large', score: 3 })).toBe('Large');
  });

  it('does not invent a band for a legacy score-only result', () => {
    expect(cleanupBandLabelForRow({ category: 'Plastic', score: 3 })).toBeNull();
  });
});
