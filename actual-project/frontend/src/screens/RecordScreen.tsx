// Details step of a report: what was found, and how much of it.
// The whole severity score rests on the answers collected here.
// Litter is mixed, so the draft holds one amount per category instead of
// forcing a single choice. And nobody carries scales to a beach, so we ask for
// four rough bands - a number would look precise and be invented.
// The same screen doubles as the form for correcting a report already filed.
import { useNavigate } from 'react-router-dom';
import { CAME_FROM_DETAILS } from '../flowRules';
import { useEffect, useRef, useState } from 'react';
import { getBeaches, photoPreviewUrl } from '../api';
import { ArrowRight, Alert } from '../components/Icon';
import { BackButton, PrimaryButton, StepBadge } from '../components/ui';
import { C, MONO, NOISE, QUANTITY_DESC } from '../theme';
import { useApp } from '../AppContext';
import type { BeachSummary, LitterCategory, QuantityBand } from '../types';

// Display order, not scoring order. Plastic sits first because it is the
// commonest answer. The weights that decide the score live in scoring.ts.
const CATEGORIES: LitterCategory[] = ['Plastic', 'Fishing gear', 'Glass', 'Metal', 'Paper', 'Other'];
// Each band is drawn three ways on its button: dots, the word, and a short
// description. Two people judging the same beach then tend to pick alike.
const QUANTITIES: QuantityBand[] = ['Small', 'Medium', 'Large', 'Very Large'];

export default function RecordScreen() {
  const nav = useNavigate();
  const { draft, patchDraft } = useApp();
  // Errors stay hidden until Continue is pressed. Turning fields red before
  // anyone has tried anything just tells the user off for not being finished.
  const [showErrors, setShowErrors] = useState(false);
  // The error box near the foot of the form. It carries role="alert" so a
  // screen reader announces it, and tabIndex={-1} so this ref can focus it.
  const errorRef = useRef<HTMLDivElement>(null);
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);

  useEffect(() => {
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeaches([]));
  }, []);

  // Focus that box the moment it appears. A sighted user simply sees it; a
  // keyboard user would sit on Continue wondering why nothing happened.
  useEffect(() => {
    if (showErrors) errorRef.current?.focus();
  }, [showErrors]);

  const beach = beaches.find((b) => b.id === draft.beachId);
  // `in`, not a truthiness test. A category ticked but not yet answered is
  // stored as an explicit undefined, so a falsy check would drop the tick.
  const picked = CATEGORIES.filter((c) => c in draft.quantities);
  const missCat = picked.length === 0;

  // Ticked, but no amount chosen yet - the half-filled rows.
  const noBand = picked.filter((c) => !draft.quantities[c]);

  // previewUrl is gone after a refresh, so fall back to the stored key. The
  // last option covers corrections, where the photo only exists on the server.
  const photoUrl =
    draft.photo?.previewUrl || photoPreviewUrl(draft.photo?.photoKey) || draft.existingPhotoUrl;

  function toggleCategory(cat: LitterCategory) {
    // A fresh object, never a mutation. React compares by identity, so editing
    // the old one in place would leave the screen looking unchanged.
    const next = { ...draft.quantities };
    // undefined rather than a default amount is what makes "ticked but not
    // answered" visible. Guessing "Small" would invent a measurement.
    if (cat in next) delete next[cat];
    else next[cat] = undefined;
    patchDraft({ quantities: next });
    setShowErrors(false);
  }

  function setBand(cat: LitterCategory, q: QuantityBand) {

    // Tapping the amount you already chose clears the category. Mis-taps are
    // common on a phone, and there would otherwise be no way to undo one.
    const next = { ...draft.quantities };
    if (next[cat] === q) delete next[cat];
    else next[cat] = q;
    patchDraft({ quantities: next });
    setShowErrors(false);
  }

  // Continue validates instead of disabling itself. A disabled button never
  // says why it is disabled; this one points at the row that is missing.
  function next() {
    if (missCat || noBand.length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    // Stamp the navigation so the review screen knows the details screen is
    // genuinely the previous history entry, and its back button can pop.
    nav('/report/review', { state: { from: CAME_FROM_DETAILS } });
  }

  // Built in layers. The user's own photo is the background, so the evidence
  // stays in front of them while they answer questions about it; grain stands
  // in when there is no photo. The dark wash over the top is not decoration -
  // the white back button and step badge sit over a picture we have never
  // seen, and could vanish against bright sand.
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
          /* Empty alt on purpose: the photo is decoration here, and the same
             picture was already described on the photo step. */
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
          /* Which beach this report is being filed against, kept on screen
             while they answer. Someone who picked the wrong one two steps
             ago should find out here, not after submitting. */
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
          {draft.editingReportId ? 'Correct your report' : 'What did you find?'}
        </div>
        {draft.editingReportId && (
          <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 14, background: C.tint, border: `1px solid ${C.line}`, color: C.slate, fontSize: 11.5, lineHeight: 1.45 }}>
            <b style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.12em' }}>CORRECT REPORT</b>
            <div style={{ marginTop: 3 }}>
              {draft.editingStatusNote || 'Your existing beach and photo are kept unless you choose to change them.'}
            </div>
            <button type="button" onClick={() => nav('/report/confirm', { replace: true })} style={{ color: C.navy, fontWeight: 700, fontSize: 11.5, marginTop: 6 }}>
              Change beach
            </button>
            <button type="button" onClick={() => nav('/report/photo', { replace: true })} style={{ color: C.navy, fontWeight: 700, fontSize: 11.5, marginTop: 6, marginLeft: 12 }}>
              Replace photo
            </button>
          </div>
        )}
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
                {/* The chosen amount is echoed on the chip too, so every answer
                    can be checked in one glance instead of scrolling. */}
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
                          <span style={{ fontSize: 8.5, color: active ? 'rgba(247,248,250,.78)' : C.dim, textAlign: 'center', lineHeight: 1.1 }}>
                            {QUANTITY_DESC[q]}
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

        {/* The box names the categories still missing an amount, rather than
            saying "some fields are incomplete". With six possible rows, a
            vague message means hunting. */}
        {showErrors && (missCat || noBand.length > 0) && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
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
