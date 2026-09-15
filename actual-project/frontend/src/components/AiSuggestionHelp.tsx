import { C } from '../theme';
import type { QuantityByCategory } from '../types';

export const AI_SUGGESTION_HELP_COPY =
  'AI maps supported litter categories in the photo and suggests a quantity band for each one. This is an AI suggestion, not verification. You must confirm or edit every suggestion. AI does not determine Beach Attention and does not prove cleanup success.';

type AiSuggestionHelpProps = {
  context: 'report' | 'cleanup';
  suggestions: QuantityByCategory;
};

export function AiSuggestionHelp({ context, suggestions }: AiSuggestionHelpProps) {
  const rows = Object.entries(suggestions)
    .filter((entry): entry is [string, NonNullable<(typeof suggestions)[keyof typeof suggestions]>] => Boolean(entry[1]))
    .map(([category, band]) => `${category} — ${band}`);

  return (
    <details
      style={{
        marginTop: 10,
        border: `1px solid ${C.line}`,
        borderRadius: 12,
        background: C.tint,
        color: C.slate,
      }}
    >
      <summary
        style={{
          cursor: 'pointer',
          listStyle: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '9px 11px',
          fontSize: 11.5,
          fontWeight: 720,
          color: C.navy,
        }}
      >
        <span>AI suggestion</span>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            borderRadius: 9,
            border: `1px solid ${C.navy}`,
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          ?
        </span>
        <span className="sr-only">Help about AI suggestions</span>
      </summary>
      <div style={{ padding: '0 11px 11px', fontSize: 11.5, lineHeight: 1.55 }}>
        <p style={{ margin: '0 0 7px' }}>
          {context === 'cleanup'
            ? 'For this after-cleanup photo, AI mapped supported litter categories and suggested quantity bands.'
            : 'For this report photo, AI mapped supported litter categories and suggested quantity bands.'}
        </p>
        {rows.length > 0 && (
          <p style={{ margin: '0 0 7px', fontWeight: 700 }}>
            AI suggested quantity band{rows.length === 1 ? '' : 's'}: {rows.join(' · ')}
          </p>
        )}
        <p style={{ margin: 0 }}>{AI_SUGGESTION_HELP_COPY}</p>
      </div>
    </details>
  );
}
