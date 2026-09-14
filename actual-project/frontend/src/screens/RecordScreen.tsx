import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { quantityBandsForCounts } from '../flowRules';
import { useApp } from '../AppContext';
import { Alert } from '../components/Icon';
import { BackButton, PrimaryButton, StepBadge } from '../components/ui';
import { C } from '../theme';
import type { LitterCategory } from '../types';

const CATEGORIES: LitterCategory[] = ['Plastic', 'Fishing gear', 'Glass', 'Metal', 'Paper', 'Other'];

export default function RecordScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  const [showErrors, setShowErrors] = useState(false);
  const counts = draft.itemCounts ?? {};
  const picked = CATEGORIES.filter((category) => category in counts);

  function toggleCategory(category: LitterCategory) {
    const next = { ...counts };
    if (category in next) delete next[category];
    else next[category] = 1;
    patchDraft({ itemCounts: next, quantities: {} });
    setShowErrors(false);
  }

  function setCount(category: LitterCategory, value: number) {
    patchDraft({ itemCounts: { ...counts, [category]: value }, quantities: {} });
    setShowErrors(false);
  }

  function next() {
    const valid = picked.length > 0 && picked.every((category) => Number.isInteger(counts[category]) && Number(counts[category]) >= 1 && Number(counts[category]) <= 100000);
    if (!valid) { setShowErrors(true); return; }
    patchDraft({ quantities: quantityBandsForCounts(counts), aiDecision: draft.aiModelState === 'ready' ? 'confirmed' : 'manual' });
    nav('/report/review', { state: { from: 'details' } });
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <BackButton onClick={() => nav('/report/confirm', { replace: true })} />
      <div className="measure i2-page" style={{ paddingBottom: 'calc(var(--safe-bottom) + 30px)' }}>
        <StepBadge>STEP 3 OF 3 · DETAILS</StepBadge>
        <h1 className="i2-title" style={{ marginTop: 18 }}>{draft.editingReportId ? 'Correct your report' : 'What did you find?'}</h1>
        <p className="i2-subtitle">Select every category and enter the exact number of items.</p>
        {(draft.aiModelState === 'empty' || draft.aiModelState === 'unavailable') && <div style={{ marginTop: 16, padding: 13, borderRadius: 14, background: C.tint, color: C.slate, fontSize: 12 }}><Alert /> AI could not provide counts. Enter them manually.</div>}
        <div className="i2-chip-row" style={{ marginTop: 22 }}>
          {CATEGORIES.map((category) => <button key={category} type="button" className="i2-chip press" aria-pressed={category in counts} onClick={() => toggleCategory(category)}>{category}</button>)}
        </div>
        <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
          {picked.map((category) => <label key={category} className="i2-quantity-row"><span>{category}</span><input className="i2-field" aria-label={`${category} item count`} type="number" min={1} max={100000} step={1} inputMode="numeric" value={counts[category] ?? ''} onChange={(event) => setCount(category, Number(event.target.value))} /></label>)}
        </div>
        {showErrors && <div role="alert" style={{ marginTop: 16, color: C.red, fontSize: 12 }}>Enter at least one category with a whole number from 1 to 100,000.</div>}
        <PrimaryButton onClick={next} style={{ marginTop: 24 }}>Continue</PrimaryButton>
      </div>
    </div>
  );
}
