import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { AiSuggestionHelp } from '../components/AiSuggestionHelp';
import { Alert } from '../components/Icon';
import { BackButton, PrimaryButton, StepBadge } from '../components/ui';
import { C } from '../theme';
import type { LitterCategory, QuantityBand, QuantityByCategory } from '../types';

const CATEGORIES: LitterCategory[] = ['Plastic', 'Fishing gear', 'Glass', 'Metal', 'Paper', 'Other'];
const BANDS: QuantityBand[] = ['Small', 'Medium', 'Large', 'Very Large'];

export default function RecordScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  const [showErrors, setShowErrors] = useState(false);
  const quantities = draft.quantities;
  const picked = CATEGORIES.filter((category) => category in quantities);

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
    patchDraft({ itemCounts: null, aiDecision: draft.aiModelState === 'ready' ? 'confirmed' : 'manual' });
    nav('/report/review', { state: { from: 'details' } });
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <BackButton onClick={() => nav('/report/confirm', { replace: true })} />
      <div className="measure i2-page" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
        <StepBadge>STEP 3 OF 3 · DETAILS</StepBadge>
        <h1 className="i2-title" style={{ marginTop: 18 }}>{draft.editingReportId ? 'Correct your report' : 'What did you find?'}</h1>
        <p className="i2-subtitle">Select every category and choose a quantity band.</p>
        {draft.aiModelState === 'ready' && Object.keys(quantities).length > 0 && (
          <AiSuggestionHelp context="report" suggestions={quantities} />
        )}
        {(draft.aiModelState === 'empty' || draft.aiModelState === 'unavailable') && (
          <div style={{ marginTop: 16, padding: 13, borderRadius: 14, background: C.tint, color: C.slate, fontSize: 12 }}>
            <Alert /> AI could not provide a supported suggestion. Select the category and quantity band manually.
          </div>
        )}
        <div className="i2-chip-row" style={{ marginTop: 22 }}>
          {CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className="i2-chip press"
              aria-pressed={category in quantities}
              onClick={() => toggleCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          {picked.map((category) => (
            <label key={category} className="i2-quantity-row">
              <span>{category}</span>
              <select
                className="i2-field"
                aria-label={`${category} quantity band`}
                value={quantities[category] ?? ''}
                onChange={(event) => setBand(category, event.target.value as QuantityBand)}
              >
                <option value="" disabled>Select amount</option>
                {BANDS.map((band) => <option key={band} value={band}>{band}</option>)}
              </select>
            </label>
          ))}
        </div>
        {showErrors && (
          <div role="alert" style={{ marginTop: 16, color: C.red, fontSize: 12 }}>
            Select at least one category and choose Small, Medium, Large, or Very Large for every selected category.
          </div>
        )}
        <PrimaryButton onClick={next} style={{ marginTop: 24 }}>Continue</PrimaryButton>
      </div>
    </div>
  );
}
