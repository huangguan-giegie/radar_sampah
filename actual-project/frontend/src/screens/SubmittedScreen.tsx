import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getMyReports } from '../api';
import { ArrowRight, Check, ChevronRight } from '../components/Icon';
import { GhostButton, PrimaryButton, Skeleton } from '../components/ui';
import { C, MONO } from '../theme';
import { useApp } from '../AppContext';
import type { LitterReport } from '../types';
import { reportOutcome } from '../flowRules';

export default function SubmittedScreen() {
  const nav = useNavigate();
  const { lastSavedReportId, patchDraft, resetDraft, reportsVersion } = useApp();
  const [reports, setReports] = useState<LitterReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyReports()
      .then((list) => setReports(list))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [reportsVersion]);

  const saved = reports.find((r) => r.id === lastSavedReportId);

  if (!lastSavedReportId) return <Navigate to="/reports" replace />;

  if (loading) {
    return (
      <div className="screen scroll-y" style={{ zIndex: 26 }}>
        <div className="pt-page-lg" style={{ paddingInline: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Skeleton h={80} r={40} />
          <Skeleton h={28} />
          <Skeleton h={180} r={22} />
        </div>
      </div>
    );
  }

  if (!saved) return <Navigate to="/reports" replace />;

  const outcome = reportOutcome(saved.status);
  const outcomeColor =
    outcome.tone === 'success' ? C.green : outcome.tone === 'warning' ? C.red : C.muted;
  const outcomeBackground =
    outcome.tone === 'success'
      ? C.greenBg
      : outcome.tone === 'warning'
        ? 'rgba(196,87,74,.13)'
        : 'rgba(30,36,44,.08)';

  const row = (label: string, value: string, badge?: string, last = false) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: last ? 'none' : '1px solid rgba(11,33,97,.06)',
      }}
    >
      <span style={{ width: 104, flex: 'none', fontSize: 11, fontWeight: 600, color: C.dim }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 630 }}>{value}</span>
      {badge && (
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, letterSpacing: '.08em', color: C.slate, background: 'rgba(11,33,97,.06)', padding: '4px 7px', borderRadius: 7 }}>
          {badge}
        </span>
      )}
    </div>
  );

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <div
        className="anim-fade-up pt-page-lg"
        style={{ paddingInline: 20, paddingBottom: 'calc(var(--safe-bottom) + 32px)', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '6px 0 2px' }}>
          <div
            className="anim-pop-in"
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: outcomeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 44px -14px rgba(11,33,97,.6)',
            }}
          >
            <Check size={34} color={C.white} strokeWidth={2.4} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 650, letterSpacing: '-.7px', marginTop: 14 }}>
            {outcome.title}
          </div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 9,
              padding: '7px 13px',
              borderRadius: 999,
              background: outcomeBackground,
              color: outcomeColor,
              fontSize: 10.5,
              fontWeight: 750,
              letterSpacing: '.08em',
            }}
          >
            {outcome.badge}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.5, maxWidth: 296 }}>
            {outcome.message}
          </div>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden' }}>
          {row('Beach', saved.beachName)}
          {row('Category', saved.category)}
          {row('Quantity', saved.quantity)}
          {row('Location', 'Beach level only', undefined, true)}
        </div>

        <button
          type="button"
          onClick={() => nav('/method')}
          style={{ background: C.tint, borderRadius: 22, padding: '17px 18px', width: '100%' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '.16em', color: C.slate }}>
              HOW IT AFFECTS THE MAP
            </div>
            <ChevronRight color={C.slate} />
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: C.ink2, marginTop: 7 }}>
            Records are scored with the same documented rule for every beach — category weight ×
            quantity band, averaged over the reporting window. Duplicate or incomplete records are
            excluded.
          </div>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <PrimaryButton onClick={() => nav(`/beach/${saved.beachId}`)}>
            View Beach
            <ArrowRight />
          </PrimaryButton>
          <div style={{ display: 'flex', gap: 9 }}>
            <GhostButton
              height={50}
              style={{ borderRadius: 16, fontSize: 13.5 }}
              onClick={() => {
                resetDraft();
                patchDraft({
                  editingReportId: saved.id,
                  beachId: saved.beachId,
                  category: saved.category,
                  quantity: saved.quantity,
                  existingPhotoUrl: saved.photoUrl ?? null,
                  locationSource: 'manual',
                  coords: null,
                });
                nav('/report/details');
              }}
            >
              Correct Record
            </GhostButton>
            <GhostButton height={50} style={{ borderRadius: 16, fontSize: 13.5 }} onClick={() => nav('/reports')}>
              My Records
            </GhostButton>
          </div>
        </div>
      </div>
    </div>
  );
}
