import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./components/useLeafletMap', () => ({
  useLeafletMap: () => ({ elRef: { current: null }, mapRef: { current: null }, ready: false }),
}));
vi.mock('leaflet', () => ({ default: {} }));

import { MiniMap } from './components/MiniMap';

describe('decorative mini map layering', () => {
  it('establishes a background stacking context for Leaflet panes', () => {
    const html = renderToStaticMarkup(<MiniMap lat={2.9} lng={101.35} zoom={9} />);

    expect(html).toContain('style="position:absolute;inset:0;z-index:0"');
  });
});

// This SSR/style regression protects the stacking-context contract only. A real
// browser check is still required to prove that loaded Leaflet tiles stay behind
// the location prompt controls.
