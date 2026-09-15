import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiSuggestionHelp, AI_SUGGESTION_HELP_COPY } from './components/AiSuggestionHelp';

describe('AI suggestion help', () => {
  it('explains the report category and band without claiming verification', () => {
    const html = renderToStaticMarkup(
      <AiSuggestionHelp
        context="report"
        suggestions={{ Plastic: 'Medium', Glass: 'Small' }}
      />,
    );

    expect(html).toContain('AI suggestion');
    expect(html).toContain('?');
    expect(html).toContain('Plastic — Medium');
    expect(html).toContain('Glass — Small');
    expect(html).toContain('supported litter categories');
    expect(html).toContain('not verification');
    expect(html).toContain('confirm or edit');
    expect(html).toContain('does not determine Beach Attention');
    expect(html).toContain('does not prove cleanup success');
  });

  it('uses the same safety explanation for cleanup suggestions', () => {
    const html = renderToStaticMarkup(
      <AiSuggestionHelp context="cleanup" suggestions={{ Metal: 'Large' }} />,
    );

    expect(html).toContain('Metal — Large');
    expect(html).toContain('suggested quantity band');
    expect(html).toContain('not verification');
    expect(html).toContain('confirm or edit');
  });

  it('does not use prohibited certainty language', () => {
    const lower = AI_SUGGESTION_HELP_COPY.toLowerCase();
    expect(lower).not.toContain('verified detection');
    expect(lower).not.toContain('guaranteed result');
    expect(lower).not.toContain('confirmed by ai');
  });
});
