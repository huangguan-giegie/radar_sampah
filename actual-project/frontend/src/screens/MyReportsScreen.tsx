import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getBeaches, getMyReports } from '../api';
import { BeachCover } from '../components/BeachCover';
import { Camera } from '../components/Icon';
import { Skeleton } from '../components/ui';
import { C, MONO, formatDate, statusChip } from '../theme';
import { useApp } from '../AppContext';
import type { BeachSummary, LitterReport } from '../types';

type Tab = 'All' | 'Counted' | 'Excluded';

const TABS: Tab[] = ['All', 'Counted', 'Excluded'];

export default function MyReportsScreen() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { patchDraft, resetDraft, reportsVersion } = useApp();

  const tab = (params.get('tab') as Tab) ?? 'All';
  const [reports, setReports] = useState<LitterReport[]>([]);
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyReports()
      .then((list) => setReports(list))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [reportsVersion]);

  useEffect(() => {
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeaches([]));
  }, []);

  // 缩略图：优先用记录自己的照片，其次海滩封面，最后渐变占位
  function coverOf(beachId: string) {
    const beach = beaches.find((b) => b.id === beachId);
    return {
      url: beach ? beach.coverImageUrl : null,
      scene: beach ? beach.scene : 'linear-gradient(160deg,#4E9EC9,#1C4A85)',
    };
  }

  // 按当前 tab 过滤
  let rows = reports;
  if (tab === 'Counted') rows = reports.filter((r) => r.status === 'Counted');
  if (tab === 'Excluded') rows = reports.filter((r) => r.status !== 'Counted');

  return (
    <div className="screen scroll-y" style={{ zIndex: 24 }}>
      <div
        className="anim-fade-up pt-page-lg"
        style={{ paddingInline: 20, paddingBottom: 132, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-.6px' }}>My Reports</div>

        <div style={{ display: 'flex', gap: 5, background: C.white, border: `1px solid ${C.line}`, padding: 4, borderRadius: 999 }}>
          {TABS.map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setParams(t === 'All' ? {} : { tab: t })}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '9px 0',
                  borderRadius: 999,
                  background: active ? C.navy : 'transparent',
                  color: active ? C.bg : C.muted,
                  fontSize: 11.5,
                  fontWeight: active ? 650 : 600,
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Skeleton h={84} r={22} />
            <Skeleton h={84} r={22} />
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div style={{ border: '1.5px dashed rgba(11,33,97,.18)', borderRadius: 24, padding: '36px 24px', textAlign: 'center', marginTop: 8 }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: 'rgba(11,33,97,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <Camera size={22} color={C.dim} strokeWidth={1.7} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 650, marginTop: 12, color: C.ink2 }}>Your first one's waiting</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>
              Next time you're at the coast, snap what you see — it'll show up right here.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => {
            const chip = statusChip(r.status);
            const fixable = r.status === 'Incomplete';
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  if (!fixable) return;
                  resetDraft();
                  patchDraft({
                    editingReportId: r.id,
                    beachId: r.beachId,
                    category: r.category,
                    quantity: r.quantity,
                    locationSource: 'manual',
                    coords: null,
                    existingPhotoUrl: r.photoUrl ?? null,
                  });
                  nav('/report/photo');
                }}
                className="card-hover"
                style={{
                  display: 'flex',
                  gap: 13,
                  background: C.white,
                  border: `1px solid ${C.line}`,
                  borderRadius: 22,
                  padding: 13,
                  width: '100%',
                  cursor: fixable ? 'pointer' : 'default',
                }}
              >
                <BeachCover
                  coverImageUrl={r.photoUrl ?? coverOf(r.beachId).url}
                  scene={coverOf(r.beachId).scene}
                  style={{ width: 56, height: 56, flex: 'none', borderRadius: 16 }}
                >
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(12,24,52,.2)' }} />
                </BeachCover>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 14.5, fontWeight: 650 }}>{r.beachName}</span>
                    <span style={{ padding: '4px 9px', borderRadius: 999, background: chip.bg, color: chip.c, fontSize: 8.5, fontWeight: 750, letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
                      {r.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                    {r.category} · {r.quantity}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.faint, marginTop: 3 }}>
                    {formatDate(r.createdAt)}
                  </div>
                  {r.statusNote && (
                    <div style={{ fontSize: 11, color: '#8A6420', marginTop: 5, background: 'rgba(217,162,75,.1)', borderRadius: 8, padding: '5px 8px', lineHeight: 1.45 }}>
                      {r.statusNote}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 4, padding: '13px 15px', borderRadius: 16, background: 'rgba(11,33,97,.03)', border: '1px solid rgba(11,33,97,.07)' }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.14em', color: C.dim }}>STATUS GUIDE</div>
          <div style={{ fontSize: 11, lineHeight: 1.65, color: C.muted, marginTop: 6 }}>
            <b style={{ color: C.green }}>Counted</b> — valid and non-duplicate; included in the
            severity calculation. <b style={{ color: C.muted }}>Duplicate</b> — matched an existing
            record for the same beach and day; excluded. <b style={{ color: C.red }}>Incomplete</b> —
            a required field or the photo is unusable; excluded until corrected.
          </div>
        </div>
      </div>
    </div>
  );
}
