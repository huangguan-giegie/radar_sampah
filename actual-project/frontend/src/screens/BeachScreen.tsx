import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getBeach } from '../api';
import { BeachCover } from '../components/BeachCover';
import { Camera, Check, ChevronRight, Clock, SpeciesIcon } from '../components/Icon';
import { BackButton, GhostButton, Label, PrimaryButton, Skeleton } from '../components/ui';
import {
  C,
  MONO,
  NOISE,
  SEVERITY,
  formatDate,
  freshStyle,
  freshnessLabel,
} from '../theme';
import { useApp } from '../AppContext';
import type { BeachDetail } from '../types';

const COMP_COLORS = ['#B8FF36', '#2C4A8C', '#5470A8', '#7A879B', '#98A4B5', '#CBD3E0'];

export default function BeachScreen() {
  const { beachId = '' } = useParams();
  const nav = useNavigate();
  const { user, resetDraft, patchDraft } = useApp();
  const [b, setB] = useState<BeachDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoading(true);
    getBeach(beachId)
      .then((data) => setB(data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [beachId]);

  const startReport = () => {
    resetDraft();
    patchDraft({ beachId });
    nav(user ? '/report/photo' : `/identity?next=${encodeURIComponent('/report/photo')}`);
  };

  if (loading || !b) {
    return (
      <div className="screen scroll-y" style={{ zIndex: 20 }}>
        <div className="pt-page" style={{ paddingInline: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <BackButton onClick={() => nav(-1)} />
          {failed ? (
            <div style={{ color: C.red, fontSize: 14 }}>Could not load this beach.</div>
          ) : (
            <>
              <Skeleton h={240} r={24} />
              <Skeleton h={120} r={24} />
              <Skeleton h={200} r={24} />
            </>
          )}
        </div>
      </div>
    );
  }

  const sev = b.severity ? SEVERITY[b.severity] : null;
  const fs = freshStyle(b.freshnessKind);
  // 数量档只有四级，条形宽度按档位画，不再是占比
  const BAND_WIDTH: Record<string, string> = {
    Small: '25%', Medium: '50%', Large: '75%', 'Very Large': '100%',
  };

  return (
    <div className="screen scroll-y" style={{ zIndex: 20 }}>
      {/* 头图 */}
      <BeachCover coverImageUrl={b.coverImageUrl} scene={b.scene} alt={b.name} style={{ height: 300 }}>
        {!b.coverImageUrl && (
          <div style={{ position: 'absolute', inset: 0, opacity: 0.32, backgroundImage: NOISE }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(9,24,52,.35) 0%,transparent 30%,transparent 52%,rgba(9,22,48,.72) 100%)' }} />
        <BackButton dark onClick={() => nav(-1)} style={{ position: 'absolute', top: 'var(--top-inset)', left: 18, zIndex: 5 }} />
        <div style={{ position: 'absolute', left: 20, right: 20, bottom: 52 }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.2em', color: 'rgba(9,26,64,.8)', marginBottom: 8 }}>
            STRAIT OF MALACCA · WEST COAST · {b.habitatTag}
          </div>
          <div style={{ fontSize: 33, fontWeight: 650, letterSpacing: '-.8px', color: C.bg, lineHeight: 1.05 }}>
            {b.name}
          </div>
          <div style={{ fontSize: 13.5, color: 'rgba(232,238,245,.8)', marginTop: 5 }}>
            {b.area} · Malaysia
          </div>
        </div>
      </BeachCover>

      {/* 严重度概览卡 */}
      <div
        style={{
          margin: '-40px 16px 0',
          position: 'relative',
          background: 'rgba(255,255,255,.92)',
          backdropFilter: 'blur(18px) saturate(150%)',
          border: '1px solid rgba(255,255,255,.8)',
          borderRadius: 24,
          padding: 18,
          boxShadow: '0 22px 46px -18px rgba(14,30,64,.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.dim }}>
              LITTER SEVERITY
            </div>
            {sev ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <div style={{ fontSize: 29, fontWeight: 750, letterSpacing: '.02em', color: sev.text }}>
                  {b.severity?.toUpperCase()}
                </div>
                <span style={{ display: 'flex', gap: 3, alignItems: 'flex-end', paddingBottom: 5 }}>
                  {[0, 1, 2, 3].map((i) => (
                    <i
                      key={i}
                      style={{
                        display: 'block',
                        width: 5,
                        height: 9 + i * 4,
                        borderRadius: 3,
                        background: b.band !== null && i < b.band ? sev.col : 'rgba(30,36,44,.14)',
                      }}
                    />
                  ))}
                </span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.2px', color: C.muted, marginTop: 6 }}>
                  Insufficient data
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: C.dim, marginTop: 5, maxWidth: 210 }}>
                  Fewer than three valid reports. This is not a sign that the beach is clean.
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: 'rgba(11,33,97,.06)', fontSize: 11.5, fontWeight: 600, color: C.ink2, whiteSpace: 'nowrap' }}>
              <Check size={11} color={C.slate} strokeWidth={2.2} />
              {b.validReports} valid reports
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999, background: fs.bg, fontSize: 11.5, fontWeight: 600, color: fs.c, whiteSpace: 'nowrap' }}>
              <i style={{ width: 6, height: 6, borderRadius: 3, background: fs.dot, display: 'block' }} />
              {freshnessLabel(b.freshnessKind, b.lastReportedAt)}
            </div>
          </div>
        </div>

        {b.freshnessKind === 'stale' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: '11px 13px', borderRadius: 16, background: 'rgba(30,36,44,.05)', border: '1px solid rgba(30,36,44,.12)' }}>
            <Clock style={{ flex: 'none', marginTop: 1 }} />
            <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: C.muted }}>
              The most recent verified report is older than 90&nbsp;days. Conditions may have changed
              in either direction.
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 16px calc(var(--safe-bottom) + 36px)', display: 'flex', flexDirection: 'column', gap: 22 }}>
        {/* 成分 */}
        <div>
          <Label style={{ marginBottom: 12 }}>LITTER COMPOSITION</Label>
          {b.composition ? (
            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 24, padding: 20, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {b.composition.map((c, i) => (
                <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 88, flex: 'none', fontSize: 12.5, fontWeight: 620, color: C.ink2 }}>
                    {c.category}
                  </span>
                  <div style={{ flex: 1, height: 14, borderRadius: 7, background: 'rgba(11,33,97,.05)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: BAND_WIDTH[c.quantity] ?? '25%',
                        height: '100%',
                        borderRadius: 7,
                        background: COMP_COLORS[i % COMP_COLORS.length],
                      }}
                    />
                  </div>
                  <span style={{ width: 62, flex: 'none', textAlign: 'right', fontFamily: MONO, fontSize: 9.5, color: C.muted }}>
                    {c.quantity}
                  </span>
                </div>
              ))}
              <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.1em', color: C.faint, marginTop: 4 }}>
                {b.compositionSource
                  ? `FROM THE REPORT ON ${formatDate(b.compositionSource.createdAt).toUpperCase()} · BROAD CATEGORIES`
                  : 'BROAD CATEGORIES'}
              </div>
            </div>
          ) : (
            <div style={{ border: '1.5px dashed rgba(11,33,97,.18)', borderRadius: 24, padding: 22, textAlign: 'center' }}>
              <div style={{ fontSize: 13.5, fontWeight: 640, color: C.muted }}>
                No verified report yet
              </div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>
                Be the first — this shows what the newest verified report found here.
              </div>
            </div>
          )}
        </div>

        {/* 计分方法入口 */}
        <button
          type="button"
          onClick={() => nav('/method')}
          className="press"
          style={{
            background: C.deep,
            borderRadius: 24,
            padding: 20,
            color: C.bg,
            position: 'relative',
            overflow: 'hidden',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', border: '1px solid rgba(184,255,54,.15)' }} />
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.dim }}>
            HOW THIS BAND IS CALCULATED
          </div>
          <div style={{ fontSize: 15.5, fontWeight: 650, marginTop: 9 }}>Same rule for every beach</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 11 }}>
            {[
              'Only valid, non-duplicate records count — duplicates and incomplete records are excluded.',
              'Category weight × quantity band, averaged across the reporting window.',
              'Four fixed bands: Low · Moderate · High · Severe.',
            ].map((t) => (
              <div key={t} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5, lineHeight: 1.5, color: C.mist }}>
                <i style={{ width: 5, height: 5, borderRadius: 3, background: C.lime, display: 'block', flex: 'none', marginTop: 6 }} />
                {t}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 13, paddingTop: 11 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.1em', color: '#8290A8', lineHeight: 1.7 }}>
              SAME RULE FOR ALL BEACHES
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 650, color: C.lime, whiteSpace: 'nowrap' }}>
              Full method <ChevronRight size={12} color={C.lime} strokeWidth={2.4} />
            </span>
          </div>
        </button>

        {/* 生物多样性 */}
        <div>
          <Label style={{ marginBottom: 12 }}>BIODIVERSITY NEARBY · {b.habitat}</Label>
          <div className="scroll-x" style={{ display: 'flex', gap: 12, paddingBottom: 6, margin: '0 -16px', paddingLeft: 16, paddingRight: 16 }}>
            {b.species.map((sp) => (
              <div key={sp.name} style={{ width: 196, flex: 'none', background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden' }}>
                <BeachCover coverImageUrl={b.coverImageUrl} scene={b.scene} style={{ height: 88 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,24,52,.25)' }} />
                  <div
                    style={{
                      position: 'absolute',
                      left: 14,
                      bottom: -16,
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      background: C.bg,
                      border: '1px solid rgba(11,33,97,.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 6px 14px -6px rgba(14,30,64,.4)',
                    }}
                  >
                    <SpeciesIcon glyph={sp.glyph} />
                  </div>
                </BeachCover>
                <div style={{ padding: '24px 14px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 650, letterSpacing: '-.1px' }}>{sp.name}</div>
                  {sp.scientificName && (
                    <div style={{ fontSize: 11, fontStyle: 'italic', color: C.dim, marginTop: 1 }}>
                      {sp.scientificName}
                      {sp.threatCategory ? ` · ${sp.threatCategory}` : ''}
                    </div>
                  )}
                  <div style={{ fontSize: 11.5, lineHeight: 1.5, color: C.muted, marginTop: 5 }}>{sp.text}</div>

                  {sp.likelihood && (
                    /* Epic 5 建模概率。刻意不用严重度那套配色，也不做成条形图 ——
                       它和垃圾严重度是两回事，绝不能被读成同一个指标。 */
                    <div
                      style={{
                        marginTop: 10,
                        padding: '9px 10px',
                        borderRadius: 12,
                        background: sp.likelihood.placeholder ? 'rgba(154,106,20,.07)' : 'rgba(43,78,162,.06)',
                        border: `1px dashed ${sp.likelihood.placeholder ? 'rgba(154,106,20,.32)' : 'rgba(43,78,162,.25)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 15,
                            fontWeight: 650,
                            color: sp.likelihood.placeholder ? '#9A6A14' : '#2B4EA2',
                          }}
                        >
                          {sp.likelihood.percent}%
                        </span>
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: 7.5,
                            letterSpacing: '.1em',
                            color: sp.likelihood.placeholder ? '#9A6A14' : '#2B4EA2',
                          }}
                        >
                          {sp.likelihood.placeholder ? 'PLACEHOLDER · NOT YET MODELLED' : 'MODELLED · ESTIMATE'}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, lineHeight: 1.45, color: C.dim, marginTop: 3 }}>
                        {sp.likelihood.basis}
                      </div>
                    </div>
                  )}

                  {sp.source.dataset === 'pending' ? (
                    /* 没有真实出处时露出来，绝不显示一条编造的引用 */
                    <div
                      style={{
                        marginTop: 9,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'rgba(217,162,75,.14)',
                        border: '1px solid rgba(217,162,75,.35)',
                        borderRadius: 6,
                        padding: '4px 7px',
                        fontFamily: MONO,
                        fontSize: 7.5,
                        letterSpacing: '.08em',
                        color: '#8A6420',
                      }}
                    >
                      <i style={{ width: 4, height: 4, borderRadius: 2, background: '#D9A24B', display: 'block' }} />
                      SOURCE PENDING · NOT YET FROM FISHBASE / OBIS
                    </div>
                  ) : (
                    <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '.08em', color: C.faint, marginTop: 9, lineHeight: 1.5 }}>
                      SOURCE · {sp.source.citation}
                      {sp.source.accessedAt ? ` · accessed ${sp.source.accessedAt}` : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, background: C.tint, borderRadius: 20, padding: '16px 17px' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.14em', color: C.slate }}>
              WHY LITTER MAY MATTER HERE
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: C.ink2, marginTop: 7 }}>
              {b.ecologicalNote}
            </div>
            <div style={{ fontSize: 10.5, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>
              {b.species.some((sp) => sp.likelihood?.placeholder)
                ? 'Any percentage shown here is a placeholder while the occurrence model is being built — not yet a modelled figure, never a confirmed sighting, and never a measure of litter severity or of ecological recovery.'
                : b.species.some((sp) => sp.likelihood)
                  ? 'Percentages are modelled from habitat type and past survey records — an estimate of how likely a species is to occur here, never a confirmed sighting, and never a measure of litter severity or of ecological recovery.'
                  : 'Potential conservation relevance — context only, never proof of current presence or of ecological recovery.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <PrimaryButton onClick={startReport}>
            <Camera size={16} strokeWidth={1.9} />
            Report Litter Here
          </PrimaryButton>
          <GhostButton onClick={() => nav('/map')}>Back to Map</GhostButton>
        </div>
      </div>
    </div>
  );
}
