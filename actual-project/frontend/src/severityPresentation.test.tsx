import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { markerHtml } from './components/BeachMarker';
import { SeverityBadge } from './components/ds';
import { SCORING_METHOD } from './scoring';
import { attentionStateFor, severityLabel } from './theme';
import type { BeachSummary, SeverityBand } from './types';

describe('published severity bands', () => {
  it.each<SeverityBand>(['Low', 'Moderate', 'High', 'Severe'])('uses %s consistently in labels and badges', (band) => {
    expect(severityLabel(band)).toBe(band);
    expect(attentionStateFor(band, false, 3)).toMatchObject({
      markerLabel: band.toUpperCase(), pageLabel: band, hasBand: true,
    });
    const badge = renderToStaticMarkup(<SeverityBadge band={band} />);
    expect(badge).toContain(`>${band}</span>`);
    expect(badge).toContain(`data-status="${band.toLowerCase()}"`);
    expect(badge).not.toContain('Very high');
  });

  it('publishes the complete score range with exact inclusive and exclusive boundaries', () => {
    expect(SCORING_METHOD.bands.map(({ band, range }) => ({ band, range }))).toEqual([
      { band: 'Low', range: '0.35 ≤ x < 1.50' },
      { band: 'Moderate', range: '1.50 ≤ x < 2.50' },
      { band: 'High', range: '2.50 ≤ x < 3.50' },
      { band: 'Severe', range: '3.50 ≤ x ≤ 4.00' },
    ]);
  });

  it('labels the top band Severe on full and compact map markers', () => {
    const beach: BeachSummary = {
      id: 'morib', name: 'Pantai Morib', area: 'Banting', lat: 2.746, lng: 101.44,
      severity: 'Severe', band: 4, insufficientData: false, validReports: 3,
      attentionScore: 3.5, eligibleReportCount: 3, lastReportedAt: null, freshnessKind: 'ok',
      habitat: 'mudflat', habitatTag: 'MUD FLAT', sensitivity: 'medium', primarySpeciesGlyph: 'bird',
      speciesNames: [], coverImageUrl: null, scene: '#123456',
    };
    for (const compact of [false, true]) {
      const html = markerHtml(beach, false, 'litter', 'bird', [0, 0], compact);
      expect(html).toContain('aria-label="Pantai Morib · SEVERE"');
      expect(html).not.toContain('VERY HIGH');
      if (!compact) expect(html).toContain('>SEVERE</b>');
      const insufficient = markerHtml({ ...beach, validReports: 2 }, false, 'litter', 'bird', [0, 0], compact);
      expect(insufficient).toContain('INSUFFICIENT DATA');
      expect(insufficient).not.toContain('SEVERE');
    }
  });
});
