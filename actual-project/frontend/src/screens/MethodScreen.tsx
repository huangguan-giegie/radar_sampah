import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getScoringMethod } from '../api';
import { SCORING_METHOD } from '../scoring';
import { BackButton, GhostButton, Label } from '../components/ui';
import { C, MONO } from '../theme';
import type { ScoringMethod } from '../types';

const LIMITATIONS = [
  'Volunteer coverage is uneven — a beach visited more often produces more records, not necessarily more litter.',
  'Quantity bands are estimates by eye, so scores are comparable in order of magnitude only.',
  'Tides, monsoon season and cleanup events all move conditions faster than the 90-day window can show.',
  'Bands describe reported litter at a beach — not water quality, ecological health, or safety.',
];

export default function MethodScreen() {
  const nav = useNavigate();
  // US4.3 由前端交付：先用前端常量直出（离线、后端未就绪都能看），
  // 后端如果提供了 /scoring-method 再无声升级为后端那份。
  const [m, setM] = useState<ScoringMethod>(SCORING_METHOD);

  useEffect(() => {
    let alive = true;
    getScoringMethod()
      .then((remote) => alive && setM(remote))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="screen scroll-y" style={{ zIndex: 28 }}>
      <div className="pt-page" style={{ position: 'relative', paddingInline: 20, paddingBottom: 22, background: C.deep, color: C.bg, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 170, height: 170, borderRadius: '50%', border: '1px solid rgba(184,255,54,.14)' }} />
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
        <div style={{ fontSize: 13, lineHeight: 1.55, color: C.mist, marginTop: 9 }}>
          No model, no judgement call in the litter severity band. The same arithmetic runs on
          every eligible record, for all MVP beaches.
        </div>
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.55,
            color: '#8290A8',
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,.1)',
          }}
        >
          The biodiversity likelihood percentages on a beach page are a separate, modelled estimate.
          They never feed into the severity band and are never combined with it.
        </div>
      </div>

      <div style={{ padding: '20px 16px calc(var(--safe-bottom) + 36px)', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Step 1 — 规则 */}
        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 24, padding: 20 }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.16em', color: C.dim }}>
            STEP 1 · THE RULE
          </div>
          <div
            style={{
              fontFamily: MONO,
              fontSize: 12.5,
              lineHeight: 1.9,
              color: C.ink3,
              background: C.tint,
              borderRadius: 16,
              padding: '14px 15px',
              marginTop: 11,
              whiteSpace: 'pre-line',
            }}
          >
            {`record score
= category weight × quantity band

beach score
= mean of eligible record scores
  in the last ${m.windowDays} days`}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.6, color: C.muted, marginTop: 11 }}>
            Every record carries equal influence — no weighting by reporter, recency within the
            window, or report volume.
          </div>
        </div>

        {/* Step 2 — 权重 */}
        <div>
          <Label style={{ marginBottom: 11 }}>STEP 2 · WEIGHTS</Label>
          <div style={{ display: 'flex', gap: 11 }}>
            <div style={{ flex: 1, background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, padding: '16px 15px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink2 }}>Category</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {m.categoryWeights.map((w) => (
                  <div key={w.category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{w.category}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 650, color: C.ink3 }}>
                      {w.weight.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, padding: '16px 15px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.ink2 }}>Quantity band</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {m.quantityWeights.map((w) => (
                  <div key={w.quantity} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>{w.quantity}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 650, color: C.ink3 }}>{w.weight}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10.5, lineHeight: 1.5, color: C.faint, marginTop: 12 }}>
                Bands, not counts — volunteers estimate volume, never weigh it.
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 — 阈值 */}
        <div>
          <Label style={{ marginBottom: 11 }}>STEP 3 · THRESHOLDS</Label>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden' }}>
            {m.bands.map((b) => (
              <div key={b.band} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderBottom: '1px solid rgba(11,33,97,.05)' }}>
                <i style={{ width: 9, height: 9, borderRadius: 5, background: b.color, display: 'block', flex: 'none' }} />
                <span style={{ fontSize: 13.5, fontWeight: 640, flex: 1 }}>{b.band}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{b.range}</span>
              </div>
            ))}
            <div style={{ padding: '12px 16px', fontFamily: MONO, fontSize: 8.5, letterSpacing: '.1em', color: C.faint }}>
              FIXED CUT-OFFS · NEVER TUNED PER BEACH
            </div>
          </div>
        </div>

        {/* Step 4 — 缺数据 */}
        <div>
          <Label style={{ marginBottom: 11 }}>STEP 4 · MISSING DATA</Label>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, padding: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                {
                  tag: `< ${m.minReports}`,
                  text: 'Fewer than three eligible records — the band is withheld and the beach reads Insufficient data.',
                  danger: false,
                },
                {
                  tag: `${m.windowDays}d`,
                  text: `Nothing eligible in ${m.windowDays} days — the beach reads Not recently reported, shown separately from severity.`,
                  danger: false,
                },
                {
                  tag: 'OUT',
                  text: 'Duplicate and incomplete records never enter the calculation, the record count, or the map.',
                  danger: true,
                },
              ].map(({ tag, text, danger }) => (
                <div key={tag} style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      letterSpacing: '.08em',
                      color: danger ? C.red : C.muted,
                      background: danger ? 'rgba(196,87,74,.1)' : 'rgba(30,36,44,.06)',
                      padding: '4px 7px',
                      borderRadius: 7,
                      flex: 'none',
                      marginTop: 1,
                    }}
                  >
                    {tag}
                  </span>
                  <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.55, color: C.ink2 }}>{text}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: '12px 13px', borderRadius: 14, background: 'rgba(124,169,139,.12)', fontSize: 12, lineHeight: 1.55, color: '#3E6B52', fontWeight: 600 }}>
              A withheld band is never presented as a clean beach — absence of evidence is reported
              as absence of evidence.
            </div>
          </div>
        </div>

        {/* 敏感性分析 */}
        <div style={{ background: C.deep, borderRadius: 24, padding: 20, color: C.bg }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '.16em', color: C.dim }}>
            SENSITIVITY ANALYSIS
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 650, marginTop: 9 }}>Thresholds were stress-tested</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: C.mist, marginTop: 8 }}>
            Band cut-offs and category weights were varied ±20% across the current MVP dataset.
            Beaches that changed band under any variation are documented, and the published rule is
            the one that kept ordering stable.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: 14, padding: '12px 13px' }}>
              <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 650, color: C.lime }}>±20%</div>
              <div style={{ fontSize: 10.5, color: '#8290A8', marginTop: 3, lineHeight: 1.4 }}>
                weight and threshold variation tested
              </div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: 14, padding: '12px 13px' }}>
              <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 650, color: C.lime }}>4 / 4</div>
              <div style={{ fontSize: 10.5, color: '#8290A8', marginTop: 3, lineHeight: 1.4 }}>
                beaches scored by the identical rule
              </div>
            </div>
          </div>
        </div>

        {/* 局限 */}
        <div>
          <Label style={{ marginBottom: 11 }}>LIMITATIONS</Label>
          <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LIMITATIONS.map((t) => (
              <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.55, color: C.slate }}>
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
