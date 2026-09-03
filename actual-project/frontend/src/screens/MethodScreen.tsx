import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScoringMethod } from '../api';
import { SCORING_METHOD } from '../scoring';
import { BackButton, GhostButton, Label } from '../components/ui';
import { C, MONO, severityLabel } from '../theme';
import type { ScoringMethod } from '../types';


function warnIfRuleDiffers(remote: ScoringMethod) {
  const local = SCORING_METHOD;
  const diffs: string[] = [];
  const cmp = (label: string, a: unknown, b: unknown) => {
    if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${label}: local ${JSON.stringify(a)} vs backend ${JSON.stringify(b)}`);
  };
  cmp('windowDays', local.windowDays, remote.windowDays);
  cmp('minReports', local.minReports, remote.minReports);
  cmp('categoryWeights', local.categoryWeights, remote.categoryWeights);
  cmp('quantityWeights', local.quantityWeights, remote.quantityWeights);
  cmp('bands', local.bands, remote.bands);
  cmp('reportAggregation', local.reportAggregation, remote.reportAggregation);
  cmp('beachAggregation', local.beachAggregation, remote.beachAggregation);
  cmp('ruleVersion', local.ruleVersion, remote.ruleVersion);
  if (diffs.length) {
    console.warn('[scoring] The backend rule differs from scoring.ts:\n  ' + diffs.join('\n  '));
  }
}

const limitations = (m: ScoringMethod) => [
  'More visits means more reports, not more litter.',
  'Bands are estimates by eye — comparable in order of magnitude only.',
  `Conditions move faster than a ${m.windowDays}-day window can show.`,
  'This is reported litter, not water quality, ecology or safety.',
  'Biodiversity context sits beside this score and never feeds into it.',
];

export default function MethodScreen() {
  const nav = useNavigate();


  const [m, setM] = useState<ScoringMethod>(SCORING_METHOD);

  useEffect(() => {
    let alive = true;
    getScoringMethod()
      .then((remote) => {
        if (!alive) return;
        if (import.meta.env.DEV) warnIfRuleDiffers(remote);
        setM(remote);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="screen scroll-y" style={{ zIndex: 28 }}>
      <div className="pt-page" style={{ position: 'relative', paddingInline: 20, paddingBottom: 22, background: C.deep, color: C.bg, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 170, height: 170, borderRadius: '50%', border: '1px solid rgba(184,255,54,.14)' }} />

        <div className="measure">
          <BackButton
            onClick={() => nav(-1)}
            dark
            style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)' }}
          />
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.18em', color: '#8290A8', marginTop: 20 }}>
            DETERMINISTIC · PUBLISHED · SAME FOR ALL BEACHES
          </div>
          <div style={{ fontSize: 29, fontWeight: 640, letterSpacing: '-.7px', marginTop: 8, lineHeight: 1.1 }}>
            How the severity band is decided
          </div>
          <div style={{ fontSize: 14.5, lineHeight: 1.65, color: C.cloud, marginTop: 10 }}>
            No model and no judgement call in the litter score — the same arithmetic runs on
            every eligible report. The species occurrence score on a beach page is a separate,
            modelled figure, and it never enters this calculation.
          </div>
        </div>
      </div>

      <div className="measure" style={{ padding: '20px 16px calc(var(--safe-bottom) + 36px)', display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 24, padding: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '.16em', color: C.muted, fontWeight: 600 }}>
            THE RULE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 }}>
            {[
              { of: 'ONE CATEGORY', is: 'category weight × quantity level' },
              { of: 'ONE REPORT', is: 'highest category score (Max)' },
              { of: 'ONE BEACH', is: `median of eligible report scores, last ${m.windowDays} days` },
            ].map((f) => (
              <div key={f.of} style={{ background: C.tint, borderRadius: 14, padding: '11px 14px' }}>
                <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.14em', color: C.dim }}>{f.of}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink3, marginTop: 4, lineHeight: 1.4 }}>
                  {f.is}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 22, marginTop: 18 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.14em', color: C.dim, marginBottom: 2 }}>
                CATEGORY
              </div>
              {m.categoryWeights.map((w) => (
                <div key={w.category} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: C.ink2 }}>{w.category}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: C.ink3 }}>
                    {w.weight.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.14em', color: C.dim, marginBottom: 2 }}>
                QUANTITY
              </div>
              {m.quantityWeights.map((w) => (
                <div key={w.quantity} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, color: C.ink2 }}>{w.quantity}</span>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: C.ink3 }}>{w.weight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>


        <div>
          <Label style={{ marginBottom: 11 }}>BANDS</Label>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden' }}>
            {m.bands.map((b, i) => (
              <div
                key={b.band}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  padding: '12px 16px',
                  borderBottom: i === m.bands.length - 1 ? 'none' : '1px solid rgba(11,33,97,.05)',
                }}
              >
                <i style={{ width: 9, height: 9, borderRadius: 5, background: b.color, display: 'block', flex: 'none' }} />
                <span style={{ fontSize: 14.5, fontWeight: 660, flex: 1 }}>{severityLabel(b.band)}</span>
                <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 600, color: C.ink2 }}>{b.range}</span>
              </div>
            ))}
          </div>
        </div>


        <div>
          <Label style={{ marginBottom: 11 }}>WHEN NO BAND IS SHOWN</Label>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, padding: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              [`Under ${m.minReports} reports`, 'Insufficient data'],
              [`Nothing in ${m.windowDays} days`, 'Not recently reported'],
              ['Duplicate or incomplete', 'Never counted at all'],
            ].map(([when, then]) => (
              <div key={when} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
                <span style={{ color: C.muted }}>{when}</span>
                <span style={{ fontWeight: 640, color: C.ink2, textAlign: 'right' }}>{then}</span>
              </div>
            ))}
            <div style={{ marginTop: 5, padding: '11px 13px', borderRadius: 14, background: 'rgba(124,169,139,.12)', fontSize: 13, lineHeight: 1.55, color: '#3E6B52', fontWeight: 600 }}>
              No band is never the same as a clean beach.
            </div>
          </div>
        </div>


        <div>
          <Label style={{ marginBottom: 11 }}>LIMITATIONS</Label>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {limitations(m).map((t) => (
              <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13.5, lineHeight: 1.6, color: C.slate }}>
                <i style={{ width: 5, height: 5, borderRadius: 3, background: C.faint, display: 'block', flex: 'none', marginTop: 6 }} />
                {t}
              </div>
            ))}
          </div>
        </div>

        <GhostButton onClick={() => nav(-1)} height={54} style={{ borderRadius: 17, fontSize: 14.5 }}>
          Back
        </GhostButton>
      </div>
    </div>
  );
}
