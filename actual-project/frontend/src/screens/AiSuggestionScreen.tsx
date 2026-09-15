import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { analyseReportPhoto } from '../iteration2';
import { useApp } from '../AppContext';
import { BackButton, StepBadge } from '../components/ui';
import { C, MONO } from '../theme';

export default function AiSuggestionScreen() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { draft, patchDraft } = useApp();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const photoKey = draft.photo?.photoKey ?? draft.existingPhotoKey ?? '';
    analyseReportPhoto(photoKey, params.get('ai') === 'fail')
      .then((result) => patchDraft({
        quantities: result.suggestions,
        itemCounts: null,
        aiModelState: result.modelState,
        aiModelVersion: result.modelVersion,
        aiDecision: null,
      }))
      .catch(() => patchDraft({
        quantities: {},
        itemCounts: null,
        aiModelState: 'unavailable',
        aiModelVersion: null,
        aiDecision: null,
      }))
      .finally(() => nav('/report/details', { replace: true }));
  }, [draft.photo?.photoKey, draft.existingPhotoKey, params, nav, patchDraft]);

  return (
    <div className="screen" style={{ zIndex: 27 }}>
      <BackButton onClick={() => nav('/report/confirm', { replace: true })} />
      <div className="measure i2-page anim-fade-up" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <StepBadge>STEP 2 OF 3 · RECOGNITION</StepBadge>
        <div style={{ width: 74, height: 74, marginTop: 28, borderRadius: 37, border: `2px solid ${C.lime}`, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulseDot 1.4s ease infinite' }}><span style={{ width: 18, height: 18, borderRadius: 9, background: C.lime }} /></div>
        <h1 className="i2-title" style={{ marginTop: 22 }}>Checking your photo…</h1>
        <p className="i2-subtitle">We’ll suggest litter categories and quantity bands for you to review.</p>
        <div style={{ marginTop: 18, fontFamily: MONO, fontSize: 10, letterSpacing: '.13em', color: C.muted }}>AI RECOGNITION · PLEASE WAIT</div>
      </div>
    </div>
  );
}
