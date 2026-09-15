import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LitterGalleryView } from './screens/LitterGalleryScreen';
import { litterGalleryPath } from './litterGallery';
import type { LitterGalleryEntry } from './types';

const entry: LitterGalleryEntry = {
  reportId: 'r_gallery_1',
  reportedAt: '2026-09-16T09:30:00+08:00',
  photoUrl: '/beaches/morib/litter-gallery/r_gallery_1/photo?token=signed',
};

describe('litter gallery frontend', () => {
  it('uses a beach-scoped gallery route', () => {
    expect(litterGalleryPath('morib')).toBe('/beach/morib/gallery');
    expect(litterGalleryPath('pantai remis')).toBe('/beach/pantai%20remis/gallery');
  });

  it('renders historical ordinary report photos with beach context', () => {
    const html = renderToStaticMarkup(
      <LitterGalleryView
        beachName="Pantai Morib"
        entries={[entry]}
        photoUrl={(value) => `https://api.example.test${value}`}
      />,
    );

    expect(html).toContain('Litter Gallery');
    expect(html).toContain('Pantai Morib');
    expect(html).toContain('r_gallery_1');
    expect(html).toContain('https://api.example.test/beaches/morib/litter-gallery/r_gallery_1/photo?token=signed');
    expect(html).not.toContain('latitude');
    expect(html).not.toContain('longitude');
  });

  it('shows a clear empty state when the beach has no gallery photos', () => {
    const html = renderToStaticMarkup(
      <LitterGalleryView beachName="Pantai Morib" entries={[]} photoUrl={(value) => value} />,
    );

    expect(html).toContain('No litter photos yet');
    expect(html).toContain('ordinary Counted reports');
  });
});
