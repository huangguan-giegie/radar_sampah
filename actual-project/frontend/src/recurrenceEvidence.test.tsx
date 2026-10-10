import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RecurrenceEvidence } from './components/RecurrenceEvidence';

const base = {
  cleanupAt: '2026-10-01T23:59:00+08:00', cleanupDate: '2026-10-01',
  intervalDays: null, daysSinceCleanup: 4,
  status: 'No follow-up report yet', calloutStatus: 'Cleanup recorded — awaiting follow-up',
};

describe('recurrence evidence', () => {
  it('shows missing follow-up evidence and elapsed days without asserting cleanliness', () => {
    const html = renderToStaticMarkup(<RecurrenceEvidence evidence={base} />);
    expect(html).toContain('No follow-up report yet');
    expect(html).toContain('4 days since the recorded cleanup');
    expect(html).toContain('does not mean the beach is clean');
    expect(html).not.toContain('Provisional median');
  });
  it('preserves same-day zero intervals and labels only sufficiently evidenced medians', () => {
    const html = renderToStaticMarkup(<RecurrenceEvidence evidence={{ ...base, intervalDays: 0, status: '0 days until next Counted report', medianDays: 2, provisional: true }} />);
    expect(html).toContain('Next report the same day');
    expect(html).not.toContain('0 days until');
    expect(html).toContain('Early estimate: the next counted report was typically recorded after 2 days');
    const insufficient = renderToStaticMarkup(<RecurrenceEvidence evidence={{ ...base, medianDays: 0, provisional: false }} />);
    expect(insufficient).not.toContain('Early estimate');
  });
  it('omits the section when no cleanup exists and keeps superseded-cleanup wording', () => {
    expect(renderToStaticMarkup(<RecurrenceEvidence evidence={null} />)).toBe('');
    const html = renderToStaticMarkup(<RecurrenceEvidence evidence={{ ...base, status: 'No follow-up report before the next cleanup' }} />);
    expect(html).toContain('No follow-up report before the next cleanup');
  });
  it('uses singular days while preserving the distinction between missing and zero-day follow-up', () => {
    const html = renderToStaticMarkup(<RecurrenceEvidence evidence={{ ...base, daysSinceCleanup: 1, intervalDays: 1 }} />);
    expect(html).toContain('Next report after 1 day');
    expect(html).toContain('1 day since the recorded cleanup');
    expect(html).not.toContain('1 days');
    const missing = renderToStaticMarkup(<RecurrenceEvidence evidence={base} />);
    expect(missing).not.toContain('Next report the same day');
  });
});
