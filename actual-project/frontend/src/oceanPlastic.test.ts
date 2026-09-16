import { describe, expect, it } from 'vitest';
import {
  MALAYSIA_NOTE,
  OWID_CHART_URL,
  OWID_MALAYSIA_URL,
  OWID_MAP_URL,
  REGIONS,
  TOP_COUNTRIES,
  WORLD,
  owidCountryUrl,
} from './oceanPlastic';

const pct = (s: string) => Number(s.replace('%', ''));

// The Background figures are copied by hand from the prototype. These checks
// catch a typo that would make two parts of the same screen disagree - a bar
// saying one thing while the region card beside it says another.
describe('ocean plastic background data', () => {
  it('ranks the countries largest first with Malaysia third', () => {
    const percents = TOP_COUNTRIES.map((c) => c.percent);
    expect([...percents].sort((a, b) => b - a)).toEqual(percents);
    expect(TOP_COUNTRIES[2].name).toBe('Malaysia');
    expect(MALAYSIA_NOTE).toContain('7.46%');
    expect(MALAYSIA_NOTE).toContain('3rd of 159 countries');
  });

  it('prints each bar share as its percent rounded to one decimal', () => {
    for (const c of TOP_COUNTRIES) {
      expect(c.share).toBe(`${c.percent.toFixed(1)}%`);
    }
  });

  it('backs up "five countries make up about 70%"', () => {
    const five = TOP_COUNTRIES.reduce((sum, c) => sum + c.percent, 0);
    expect(five).toBeGreaterThan(68);
    expect(five).toBeLessThan(72);
    expect(WORLD.note).toContain('about 70%');
  });

  it('keeps the regional totals consistent with the world split', () => {
    const share = (id: string) => pct(REGIONS.find((r) => r.id === id)!.share);
    const asia = share('southeast-asia') + share('south-asia') + share('east-asia') + share('west-central-asia');
    const americas = share('north-america') + share('south-america');
    expect(Math.abs(asia - pct(WORLD.top[0][1]))).toBeLessThan(0.2);
    expect(Math.abs(americas - pct(WORLD.top[1][1]))).toBeLessThan(0.05);
    expect(share('africa')).toBe(pct(WORLD.top[2][1]));
  });

  it('lists every region with three contributors that do not exceed the region', () => {
    for (const r of REGIONS) {
      expect(r.top).toHaveLength(3);
      const inside = r.top.reduce((sum, [, s]) => sum + pct(s), 0);
      expect(inside).toBeLessThanOrEqual(pct(r.share) + 0.01);
      expect(r.hotspots.length).toBeGreaterThan(0);
      for (const h of r.hotspots) {
        expect(h.left + h.width).toBeLessThanOrEqual(100);
        expect(h.top + h.height).toBeLessThanOrEqual(100);
      }
    }
  });

  it('agrees with the country bars where a country appears in a region card', () => {
    const sea = REGIONS.find((r) => r.id === 'southeast-asia')!;
    const byName = Object.fromEntries(sea.top);
    expect(pct(byName.Malaysia)).toBe(TOP_COUNTRIES.find((c) => c.iso3 === 'MYS')!.percent);
    expect(pct(byName.Philippines)).toBe(TOP_COUNTRIES.find((c) => c.iso3 === 'PHL')!.percent);
  });

  it('builds the Our World in Data links the prototype uses', () => {
    expect(OWID_CHART_URL).toBe('https://ourworldindata.org/grapher/share-of-global-plastic-waste-emitted-to-the-ocean');
    expect(OWID_MAP_URL).toBe(`${OWID_CHART_URL}?tab=map`);
    expect(owidCountryUrl('PHL')).toBe(`${OWID_CHART_URL}?country=~PHL`);
    expect(OWID_MALAYSIA_URL).toBe(`${OWID_CHART_URL}?country=~MYS`);
  });
});
