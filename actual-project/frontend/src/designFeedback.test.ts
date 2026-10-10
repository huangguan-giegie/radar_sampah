import { describe, expect, it } from 'vitest';
import { searchBeaches, borneoReportCounts } from './beachSearch';
import type { CoastalBeach } from './coastalData';
import { eventInvitationPath, eventInvitationText } from './eventInvitation';
import { cleanupShareLines } from './cleanupShare';
import type { CleanupAction } from './iteration2';
import content from './content/coastalContent.json';

const beaches = [
  { id: 'morib', name: 'Pantai Morib', area: 'Selangor', region: 'selangor', validReports: 4 },
  { id: 'sabah-a', name: 'Tanjung Aru', area: 'Kota Kinabalu, Sabah', region: 'borneo', validReports: 5 },
  { id: 'sarawak-a', name: 'Damai Beach', area: 'Kuching, Sarawak', region: 'borneo', validReports: 3 },
] as CoastalBeach[];

describe('design feedback behaviour', () => {
  it('searches across regions and combines name and area words without requiring coordinates', () => {
    expect(searchBeaches(beaches, '  TANJUNG   Sabah ').map(b => b.id)).toEqual(['sabah-a']);
    expect(searchBeaches(beaches, 'Sarawak').map(b => b.id)).toEqual(['sarawak-a']);
    expect(searchBeaches(beaches, 'missing')).toEqual([]);
  });
  it('keeps Sabah and Sarawak report totals separate from peninsula totals', () => {
    expect(borneoReportCounts(beaches)).toEqual({ total: 8, sabah: 5, sarawak: 3 });
  });
  it('uses only a public event ID in the invitation and includes the actual date and time', () => {
    const url = 'https://example.com' + eventInvitationPath('morib-2026-10-10');
    expect(url).toBe('https://example.com/j/morib-2026-10-10');
    const message = eventInvitationText({ beachName: 'Pantai Morib', date: '2026-10-10', startsAt: '09:00', endsAt: '12:00' }, url);
    expect(message).toContain('You’re invited to the Pantai Morib Cleanup!');
    expect(message).toContain('9:00 AM – 12:00 PM');
    expect(message).toContain(url);
    expect(message).not.toContain('eyJ');
  });
  it('shares recorded transitions and standalone removals without invented bag counts or beach-rating changes', () => {
    const cleanup = { rows: [{ category: 'Plastic', beforeBand: 'Large', afterBand: 'Small' }, { category: 'Metal', removedBand: 'Medium' }] } as CleanupAction;
    expect(cleanupShareLines(cleanup)).toEqual(['Plastic: Large → Small', 'Metal: Medium collected']);
    expect(cleanupShareLines(cleanup).join(' ')).not.toMatch(/bags|participants|High|Moderate/);
  });
  it('uses different actual assets for the species and group cards called out in the feedback', () => {
    const image = (id: string) => content.species.find(s => s.id === id)?.image;
    expect(image('green-sea-turtle')).not.toBe(image('sea-turtles'));
    expect(image('hawksbill-turtle')).not.toBe(image('sea-turtles'));
    expect(image('blood-cockle')).not.toBe(image('coastal-shellfish'));
  });
});
