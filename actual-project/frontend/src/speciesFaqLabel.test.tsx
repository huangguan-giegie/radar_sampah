import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SpeciesIntroductionView } from './screens/MarineLifeScreen';

describe('published species answers', () => {
  it('labels prepared sourced answers as reading content', () => {
    const html = renderToStaticMarkup(<SpeciesIntroductionView goBack={() => {}} species={{
      name: 'Green sea turtle', subtitle: 'Chelonia mydas', intro: 'Species introduction.',
      evidence: 'Published source information.', image: null, credit: '', photoSource: null,
      answers: [{ title: 'Habitat', text: 'A prepared habitat answer.' }],
      sources: [{ label: 'Published species source', url: 'https://www.marinespecies.org/' }],
    }} />);
    expect(html).toContain('Read answers');
    expect(html).toContain('Answers use this card’s published sources');
    expect(html).toContain('A prepared habitat answer.');
    expect(html).not.toContain('Ask AI');
  });
});
