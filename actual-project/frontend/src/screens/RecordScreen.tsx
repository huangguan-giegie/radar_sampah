import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { photoPreviewUrl } from '../api';
import { AiSuggestionHelp } from '../components/AiSuggestionHelp';
import { OverlayChip, SectionLabel } from '../components/ds';
import { Alert } from '../components/Icon';
import { BackButton, PrimaryButton, StepBadge } from '../components/ui';
import { continueFromDetails } from '../flowRules';
import { C, MONO } from '../theme';
import type { LitterCategory, QuantityBand, QuantityByCategory } from '../types';

const CATEGORIES: LitterCategory[] = ['Plastic', 'Fishing gear', 'Glass', 'Metal', 'Paper', 'Other'];
const BANDS: QuantityBand[] = ['Small', 'Medium', 'Large', 'Very Large'];

export default function RecordScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  const [showErrors, setShowErrors] = useState(false);
  const quantities = draft.quantities;
  const picked = CATEGORIES.filter((category) => category in quantities);

  // The photo sits behind the form so the user can look at what they found
  // while they pick categories. After a refresh the local preview is gone, so
  // fall back to the stored photo, then to a plain surface.
  const photoUrl =
    draft.photo?.previewUrl || photoPreviewUrl(draft.photo?.photoKey) || draft.existingPhotoUrl;

  // Which beach this report is for. A correction says CONFIRMED because the
  // beach was already confirmed when the report was first filed.
  const beachChip = draft.beachName
    ? `${draft.beachName.toUpperCase()}${draft.editingReportId ? ' · CONFIRMED' : ''}`
    : null;

  function toggleCategory(category: LitterCategory) {
    const next: QuantityByCategory = { ...quantities };
    if (category in next) delete next[category];
    else next[category] = undefined;
    patchDraft({ quantities: next, itemCounts: null });
    setShowErrors(false);
  }

  function setBand(category: LitterCategory, value: QuantityBand) {
    patchDraft({ quantities: { ...quantities, [category]: value }, itemCounts: null });
    setShowErrors(false);
  }

  function next() {
    const valid = picked.length > 0 && picked.every((category) => Boolean(quantities[category]));
    if (!valid) {
      setShowErrors(true);
      return;
    }
    // Step 3 is the AI check. It runs once per photo; coming back here after
    // it has run goes straight on to Review.
    const step = continueFromDetails(draft);
    if (step.to === '/report/suggestions') {
      patchDraft({ itemCounts: null });
      nav(step.to);
      return;
    }
    patchDraft({ itemCounts: null, aiDecision: step.aiDecision });
    nav(step.to, { state: { from: 'details' } });
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <div style={{ position: 'relative', height: 'min(38vh, 300px)', background: '#A19C90', overflow: 'hidden' }}>
        {photoUrl && (
          <img src={photoUrl} alt="Your report photo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(12,24,52,.34) 0%,transparent 42%)', pointerEvents: 'none' }} />
        <div
          className="measure"
          style={{ position: 'absolute', top: 'var(--top-inset)', left: 0, right: 0, paddingInline: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
            <BackButton dark onClick={() => nav('/report/confirm', { replace: true })} />
            {beachChip && <OverlayChip>{beachChip}</OverlayChip>}
          </div>
          <StepBadge dark>STEP 2 OF 4 · DETAILS</StepBadge>
        </div>
      </div>

      <div
        className="measure i2-page"
        style={{ position: 'relative', marginTop: -26, paddingTop: 24, borderRadius: '28px 28px 0 0', background: C.bg, paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}
      >
        <div>
          <h1 className="i2-title">{draft.editingReportId ? 'Correct your report' : 'What did you find?'}</h1>
          <p className="i2-subtitle">Select every category and choose a quantity band.</p>
        </div>
        {draft.aiModelState === 'ready' && draft.aiDecision !== 'manual' && Object.keys(quantities).length > 0 && (
          <AiSuggestionHelp context="report" suggestions={quantities} />
        )}
        {(draft.aiModelState === 'empty' || draft.aiModelState === 'unavailable') && (
          <div style={{ padding: 13, borderRadius: 14, background: C.tint, color: C.slate, fontSize: 12 }}>
            <Alert /> AI could not provide a supported suggestion. Select the category and quantity band manually.
          </div>
        )}

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <SectionLabel size="sm">CATEGORY</SectionLabel>
            <SectionLabel size="sm" tone="alert">REQUIRED</SectionLabel>
          </div>
          <div className="i2-chip-row" style={{ marginTop: 10 }}>
            {CATEGORIES.map((category) => {
              const band = quantities[category];
              return (
                <button
                  key={category}
                  type="button"
                  className="i2-chip press"
                  aria-pressed={category in quantities}
                  aria-label={band ? `${category}, ${band}` : category}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                  {/* The chosen band rides along on the chip, so a report with
                      several categories can be checked at a glance. */}
                  {band && (
                    <span style={{ marginLeft: 6, fontFamily: MONO, fontSize: 9, letterSpacing: '.08em' }}>
                      {band.toUpperCase()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Four fixed bands as buttons, never a number field: the report
            records how much, not an exact item count. */}
        {picked.map((category) => (
          <div key={category} role="group" aria-label={`${category} quantity band`}>
            <SectionLabel size="sm">QUANTITY BAND · {category.toUpperCase()}</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 7, marginTop: 10 }}>
              {BANDS.map((band) => {
                const selected = quantities[category] === band;
                return (
                  <button
                    key={band}
                    type="button"
                    className="press"
                    aria-pressed={selected}
                    onClick={() => setBand(category, band)}
                    style={{
                      minHeight: 54,
                      padding: '0 4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      borderRadius: 14,
                      border: `1px solid ${selected ? C.navy : C.line2}`,
                      background: selected ? C.navy : C.white,
                      color: selected ? C.white : C.ink3,
                      fontSize: 12.5,
                      fontWeight: 650,
                      cursor: 'pointer',
                    }}
                  >
                    {band}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {showErrors && (
          <div role="alert" style={{ color: C.red, fontSize: 12 }}>
            Select at least one category and choose Small, Medium, Large, or Very Large for every selected category.
          </div>
        )}
        <PrimaryButton onClick={next} style={{ marginTop: 8 }}>Continue</PrimaryButton>
      </div>
    </div>
  );
}
