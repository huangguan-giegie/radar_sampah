import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getBeaches, photoPreviewUrl } from '../api';
import { ArrowRight, Alert } from '../components/Icon';
import { BackButton, PrimaryButton, StepBadge } from '../components/ui';
import { C, MONO, NOISE, QUANTITY_DESC } from '../theme';
import { useApp } from '../AppContext';
import type { BeachSummary, LitterCategory, QuantityBand } from '../types';

const CATEGORIES: LitterCategory[] = ['Plastic', 'Fishing gear', 'Glass', 'Metal', 'Paper', 'Other'];
const QUANTITIES: QuantityBand[] = ['Small', 'Medium', 'Large', 'Very Large'];

export default function RecordScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  const [showErrors, setShowErrors] = useState(false);
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);

  useEffect(() => {
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeaches([]));
  }, []);

  const beach = beaches.find((b) => b.id === draft.beachId);
  const picked = CATEGORIES.filter((c) => c in draft.quantities);
  const missCat = picked.length === 0;
  // 选了类别但还没选数量档的
  const noBand = picked.filter((c) => !draft.quantities[c]);
  // 刷新过一次的话 previewUrl 是空的，用存储键把图找回来
  const photoUrl =
    draft.photo?.previewUrl || photoPreviewUrl(draft.photo?.photoKey) || draft.existingPhotoUrl;

  function toggleCategory(cat: LitterCategory) {
    const next = { ...draft.quantities };
    if (cat in next) delete next[cat];
    else next[cat] = undefined;
    patchDraft({ quantities: next });
    setShowErrors(false);
  }

  function setBand(cat: LitterCategory, q: QuantityBand) {
    // 再点一次同一档 = 取消这个类别
    const next = { ...draft.quantities };
    if (next[cat] === q) delete next[cat];
    else next[cat] = q;
    patchDraft({ quantities: next });
    setShowErrors(false);
  }

  function next() {
    if (missCat || noBand.length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    nav('/report/review');
  }

  return (
    <div
      className="screen"
      style={{
        zIndex: 26,
        overflow: 'hidden',
        background:
          'radial-gradient(80% 50% at 30% 20%,rgba(255,255,255,.4),transparent 60%),linear-gradient(160deg,#BBB6AA 0%,#A19C90 45%,#87847B 75%,#6B6A62 100%)',
      }}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: NOISE }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(18,26,44,.42) 0%,transparent 26%,transparent 55%,rgba(18,34,72,.22) 100%)' }} />

      <BackButton dark onClick={() => nav(-1)} style={{ position: 'absolute', top: 'var(--top-inset)', left: 18, zIndex: 5 }} />
      <div style={{ position: 'absolute', top: 'var(--top-inset)', right: 18, zIndex: 5 }}>
        <StepBadge dark>STEP 2 OF 3 · DETAILS</StepBadge>
      </div>
      {beach && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--top-inset) + 50px)',
            left: 18,
            fontFamily: MONO,
            fontSize: 8.5,
            letterSpacing: '.1em',
            color: 'rgba(255,255,255,.85)',
            background: 'rgba(11,33,97,.6)',
            backdropFilter: 'blur(6px)',
            padding: '5px 9px',
            borderRadius: 8,
            zIndex: 5,
          }}
        >
          {beach.name.toUpperCase()} · CONFIRMED
        </div>
      )}

      <div
        className="scroll-y measure"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '20px 18px calc(var(--safe-bottom) + 20px)',
          background:
            'linear-gradient(180deg,transparent 0%,rgba(252,253,255,.8) 14%,rgba(252,253,255,.96) 32%)',
          backdropFilter: 'blur(14px)',
          borderRadius: '30px 30px 0 0',
          maxHeight: '74%',
        }}
      >
        <div style={{ fontSize: 25, fontWeight: 650, letterSpacing: '-.5px', color: C.ink3 }}>
          What did you find?
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 5, lineHeight: 1.5 }}>
          No weighing, no guesswork. Tap everything you saw, then say roughly how much of each.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 9px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.muted }}>CATEGORY</div>
          {missCat && (
            <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.1em', color: C.red }}>REQUIRED</div>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.map((cat) => {
            const active = cat in draft.quantities;
            const band = draft.quantities[cat];
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => toggleCategory(cat)}
                className={active ? '' : 'chip-hover'}
                style={{
                  padding: '10px 16px',
                  borderRadius: 999,
                  background: active ? C.navy : 'rgba(11,33,97,.04)',
                  color: active ? C.white : C.ink2,
                  fontSize: 13,
                  fontWeight: active ? 700 : 600,
                  border: `1.5px solid ${active ? C.navy : 'rgba(11,33,97,.22)'}`,
                }}
              >
                {cat}
                {band && (
                  <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.08em', marginLeft: 7, opacity: 0.75 }}>
                    {band.toUpperCase()}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {picked.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '18px 0 9px' }}>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.muted }}>
                HOW MUCH OF EACH
              </div>
              {noBand.length > 0 && (
                <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.1em', color: C.red }}>REQUIRED</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {picked.map((cat) => (
                <div key={cat}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 650,
                      color: draft.quantities[cat] ? C.ink2 : C.red,
                      marginBottom: 6,
                    }}
                  >
                    {cat}
                  </div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    {QUANTITIES.map((q, i) => {
                      const active = draft.quantities[cat] === q;
                      return (
                        <button
                          key={q}
                          type="button"
                          aria-pressed={active}
                          aria-label={`${cat}: ${q}`}
                          title={QUANTITY_DESC[q]}
                          onClick={() => setBand(cat, q)}
                          className={active ? '' : 'chip-hover'}
                          style={{
                            flex: 1,
                            padding: '11px 6px 10px',
                            borderRadius: 16,
                            background: active ? C.navy : 'rgba(11,33,97,.04)',
                            border: `1.5px solid ${active ? C.navy : 'rgba(11,33,97,.22)'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span style={{ display: 'flex', gap: 2.5, alignItems: 'center' }}>
                            {[0, 1, 2, 3].map((j) => (
                              <i
                                key={j}
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: 3,
                                  display: 'block',
                                  background: j <= i ? (active ? C.lime : C.faint) : 'rgba(30,36,44,.12)',
                                }}
                              />
                            ))}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: active ? 750 : 650,
                              color: active ? C.white : C.ink2,
                              textAlign: 'center',
                              lineHeight: 1.15,
                            }}
                          >
                            {q}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {showErrors && (missCat || noBand.length > 0) && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              background: 'rgba(196,87,74,.09)',
              border: '1px solid rgba(196,87,74,.28)',
              borderRadius: 16,
              padding: '12px 14px',
              marginTop: 16,
            }}
          >
            <Alert style={{ flex: 'none', marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 650, color: C.red }}>
                {missCat ? 'Pick at least one category' : 'Say how much of each'}
              </div>
              <div style={{ fontSize: 11.5, color: '#8A5049', marginTop: 3, lineHeight: 1.5 }}>
                {missCat
                  ? 'A report needs at least one litter category before it can be submitted.'
                  : `Still missing a quantity band for: ${noBand.join(', ')}.`}
              </div>
            </div>
          </div>
        )}

        <PrimaryButton onClick={next} style={{ marginTop: 18 }}>
          Continue
          <ArrowRight />
        </PrimaryButton>
      </div>
    </div>
  );
}
