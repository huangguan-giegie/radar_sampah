import { describe, expect, it } from 'vitest';
import { beachDistanceKm, closestSupportedBeach } from './homeNearby';

const morib = { id: 'morib', lat: 2.746, lng: 101.44 };
const cenang = { id: 'cenang', lat: 6.30, lng: 99.73 };
const unknown = { id: 'unknown', lat: null, lng: null };

describe('privacy-preserving nearest supported beach', () => {
  it('selects the nearest valid beach without mutating the catalogue', () => {
    const source = [morib, unknown, cenang];
    expect(closestSupportedBeach(source, { lat: 6.3, lng: 99.7 })?.id).toBe('cenang');
    expect(source).toHaveLength(3);
  });
  it('falls back rather than using missing or invalid coordinates', () => {
    expect(closestSupportedBeach([unknown], { lat: 2.74, lng: 101.44 })).toBeNull();
    expect(closestSupportedBeach([morib], { lat: 100, lng: 0 })).toBeNull();
  });
  it('uses great-circle distances and deterministic ties', () => {
    expect(beachDistanceKm({ lat: 2.746, lng: 101.44 }, morib)).toBe(0);
    expect(closestSupportedBeach([morib, { ...morib, id: 'other' }], morib)?.id).toBe('morib');
  });
});
