import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Info } from '../components/Icon';
import { Alert, Callout, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import { analyseReportPhoto, type AiSuggestion } from '../iteration2';
import { C, MONO } from '../theme';
import type { LitterCategory, QuantityBand, QuantityByCategory } from '../types';

const CATEGORIES: LitterCategory[] = ['Plastic', 'Fishing gear', 'Glass', 'Metal', 'Paper', 'Other'];
const QUANTITIES: QuantityBand[] = ['Small', 'Medium', 'Large', 'Very Large'];

export default function AiSuggestionScreen() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { draft, patchDraft } = useApp();
  const [result, setResult] = useState<AiSuggestion | null>(null);
  const [editable, setEditable] = useState<QuantityByCategory>({});
  const [loading, setLoading] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const photoKey = draft.photo?.photoKey ?? draft.existingPhotoKey ?? '';
    analyseReportPhoto(photoKey, params.get('ai') === 'fail')
      .then((suggestion) => {
        setResult(suggestion);
        setEditable(suggestion.suggestions);
      })
      .finally(() => setLoading(false));
  }, [draft.photo?.photoKey, draft.existingPhotoKey, params]);

  function confirm() {
    if (Object.keys(editable).length === 0) return;
    patchDraft({ quantities: editable, aiDecision: 'confirmed', aiModelVersion: result?.modelVersion ?? null });
    nav('/report/review', { state: { from: 'suggestions' } });
  }

  function keepManual() {
    patchDraft({ aiDecision: 'manual', aiModelVersion: result?.modelVersion ?? null });
    nav('/report/review', { state: { from: 'suggestions' } });
  }

  function toggle(category: LitterCategory) {
    setEditable((current) => {
      const next = { ...current };
      if (category in next) delete next[category];
      else next[category] = 'Small';
      return next;
    });
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 27 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav('/report/details', { replace: true })} />
        <div>
          <SectionLabel size="sm">AI SUGGESTION · REVIEW BEFORE SAVING</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>{loading ? 'Checking your photo…' : result?.modelState === 'ready' ? 'Review the suggestion' : "We're not sure"}</h1>
          <p className="i2-subtitle">You decide the final categories and amounts. A suggestion is never submitted on its own.</p>
        </div>

        {loading ? (
          <div className="i2-hero" style={{ minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 74, height: 74, borderRadius: 37, border: `2px solid ${C.lime}`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulseDot 1.4s ease infinite' }}>
              <span style={{ width: 18, height: 18, borderRadius: 9, background: C.lime }} />
            </div>
            <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 10, letterSpacing: '.13em', color: 'rgba(255,255,255,.72)' }}>AI SUGGESTION · NOT YET CONFIRMED</div>
          </div>
        ) : result?.modelState === 'ready' ? (
          <>
            <Callout title="Suggestion ready" tone="reassurance" icon={<Check color={C.green} />}>
              Check each selected category and change any amount that does not match what you saw.
            </Callout>

            <div className="i2-card">
              <SectionLabel size="sm">CATEGORIES</SectionLabel>
              <div className="i2-chip-row" style={{ marginTop: 11 }}>
                {CATEGORIES.map((category) => (
                  <button key={category} type="button" className="i2-chip press" aria-pressed={category in editable} onClick={() => toggle(category)}>{category}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gap: 11, marginTop: 16 }}>
                {(Object.keys(editable) as LitterCategory[]).map((category) => (
                  <label key={category} className="i2-quantity-row">
                    <span style={{ fontSize: 13.5, fontWeight: 700 }}>{category}</span>
                    <select className="i2-field" aria-label={`${category} suggested amount`} value={editable[category]} onChange={(event) => setEditable((current) => ({ ...current, [category]: event.target.value as QuantityBand }))}>
                      {QUANTITIES.map((quantity) => <option key={quantity}>{quantity}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            </div>

            {Object.keys(editable).length === 0 && <Alert title="Choose at least one category" tone="caution">Or keep the manual values you entered on the previous page.</Alert>}
            <PrimaryButton onClick={confirm} disabled={Object.keys(editable).length === 0}>Confirm suggestions</PrimaryButton>
            <GhostButton onClick={keepManual}>Keep my manual entries</GhostButton>
          </>
        ) : (
          <>
            <Alert title="Select the litter manually" tone="caution">
              The photo could not be classified confidently. Your photo, beach and manual entries are still here.
            </Alert>
            <PrimaryButton onClick={keepManual}>Select manually</PrimaryButton>
            <GhostButton onClick={() => nav('/report/details', { replace: true })}>Review manual entries</GhostButton>
          </>
        )}

        <Callout title="About this suggestion" tone="quiet" icon={<Info color={C.navy} />}>
          These counts are suggestions only. Edit any category or amount before you confirm.
        </Callout>
        <TextButton onClick={() => nav('/method/ai')}>How the AI suggestion works</TextButton>
      </div>
    </div>
  );
}
