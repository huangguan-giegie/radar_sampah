import { describe, expect, it } from 'vitest';
import marineDirectorySource from './screens/MarineLifeScreen.tsx?raw';
import { marineLayerEnabled, marineLayerParams, radialPoints, radialSpecies, selectMapBeach, mapMarineCards } from './mapMarineSelection';
import type { BeachMarineCard } from './beachMarineLife';

describe('shared map marine-life workflow', () => {
  it('opens the map from the Marine Life directory with its overlay enabled', () => {
    expect(marineDirectorySource).toContain('nav("/map?marine=on")');
    expect(marineLayerEnabled(new URLSearchParams('marine=on'))).toBe(true);
  });
  it('links existing habitats only where a beach has a matching published record', () => {
    const morib = mapMarineCards('morib');
    expect(morib.find(card => card.kind === 'habitat')?.destination).toBe('/habitats/morib-mudflat?beach=morib');
    expect(morib.filter(card => card.kind !== 'habitat')).toHaveLength(2);
    expect(mapMarineCards('remis').some(card => card.kind === 'habitat')).toBe(false);
    expect(mapMarineCards('pantai-air-batang-tioman')).toEqual([]);
  });
  it('starts with litter only, but supports explicit and existing biodiversity links', () => {
    expect(marineLayerEnabled(new URLSearchParams())).toBe(false);
    expect(marineLayerEnabled(new URLSearchParams('region=selangor'))).toBe(false);
    expect(marineLayerEnabled(new URLSearchParams('marine=on'))).toBe(true);
    expect(marineLayerEnabled(new URLSearchParams('layer=bio&beach=morib'))).toBe(true);
    expect(marineLayerEnabled(new URLSearchParams('layer=bio&marine=off'))).toBe(false);
  });

  it('switches layers without losing the region or carrying an old expanded beach', () => {
    const previous = new URLSearchParams('region=selangor&layer=bio&beach=morib');
    const off = marineLayerParams(previous, false);
    expect(off.get('region')).toBe('selangor');
    expect(marineLayerEnabled(off)).toBe(false);
    expect(off.has('beach')).toBe(false);
    expect(off.has('layer')).toBe(false);
    expect(marineLayerEnabled(marineLayerParams(off, true))).toBe(true);
    expect(previous.get('beach')).toBe('morib');
  });

  it('expands one beach, switches to a different beach, and collapses a repeated selection', () => {
    const morib = { id: 'morib', region: 'selangor' };
    const bagan = { id: 'bagan', region: 'selangor' };
    const selected = selectMapBeach(new URLSearchParams('q=morib&panel=beaches&region=johor'), morib);
    expect(selected.get('beach')).toBe('morib');
    expect(selected.get('region')).toBe('selangor');
    expect(selected.has('q')).toBe(false);
    expect(selected.has('panel')).toBe(false);
    expect(selectMapBeach(selected, bagan).getAll('beach')).toEqual(['bagan']);
    expect(selectMapBeach(selected, morib).has('beach')).toBe(false);
  });

  it('keeps all 40 results reachable without crowding the ring', () => {
    const cards = Array.from({ length: 40 }, (_, i) => ({ id: `species-${i}` } as BeachMarineCard));
    const { visible, remaining } = radialSpecies(cards);
    expect(visible).toHaveLength(5);
    expect(remaining).toHaveLength(35);
    expect([...visible, ...remaining]).toEqual(cards);
    expect(radialSpecies(cards.slice(0, 6)).remaining).toEqual([]);
    expect(radialSpecies([]).visible).toEqual([]);
  });

  it('keeps the six touch targets separated even on a small phone', () => {
    const points = radialPoints(6);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) * 220 / 280).toBeGreaterThan(54);
      }
    }
    expect(radialPoints(0)).toEqual([]);
  });
});
