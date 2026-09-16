import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EcologicalBackgroundLink, ECOLOGICAL_BACKGROUND_URL } from './components/EcologicalBackgroundLink';

const APPROVED_URL = 'https://ourworldindata.org/grapher/share-of-global-plastic-waste-emitted-to-the-ocean?country=~MYS';

describe('ecological background story link', () => {
  it('opens the exact approved Our World in Data background source safely', () => {
    expect(ECOLOGICAL_BACKGROUND_URL).toBe(APPROVED_URL);

    const html = renderToStaticMarkup(<EcologicalBackgroundLink />);
    expect(html).toContain(`href="${APPROVED_URL.replace('&', '&amp;')}"`);
    expect(html).toContain('target="_blank"');
    expect(html).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(html).toMatch(/rel="[^"]*noreferrer[^"]*"/);
    expect(html).toContain('Learn more');
  });
});
