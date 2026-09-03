// Everything this volunteer has submitted, and what became of each report.
//
// The point of the screen is accountability in both directions. The user can
// see that their work was kept, and see plainly which reports did not count
// and why - with a way to open any of them and correct it.
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getBeaches, getMyReports } from '../api';
import { BeachCover } from '../components/BeachCover';
import { Camera } from '../components/Icon';
import { ErrorNote, Skeleton } from '../components/ui';
import { C, MONO, formatDate } from '../theme';
import { StatusBadge, type BadgeStatus } from '../components/ds';
import { useApp } from '../AppContext';
import { formatReportComposition, historicalPhotoUnavailable } from '../flowRules';
import type { BeachSummary, LitterReport } from '../types';

// Three tabs, not four. Duplicate and Incomplete both sit under "Excluded"
// because from the user's side they are the same question - "why is this not
// counted?" - and the badge on each row still gives the exact reason.
type Tab = 'All' | 'Counted' | 'Excluded';

const TABS: Tab[] = ['All', 'Counted', 'Excluded'];

export default function MyReportsScreen() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const { patchDraft, resetDraft, setLastSavedReport, reportsVersion } = useApp();

  // The tab lives in the URL, not in useState. That makes /reports?tab=Counted
  // a real link, which is how the tiles on the home and account pages jump
  // straight to the right filter, and it survives a refresh.
  const tab = (params.get('tab') as Tab) ?? 'All';
  const [reports, setReports] = useState<LitterReport[]>([]);
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);


  // Named so the Retry button in the error panel can call the same code.
  function loadReports() {
    setLoading(true);
    setFailed(false);
    getMyReports()
      .then((list) => setReports(list))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }

  // Runs again whenever reportsVersion changes, so a report submitted a moment
  // ago is already in this list when the user arrives.
  useEffect(loadReports, [reportsVersion]);

  useEffect(() => {
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeaches([]));
  }, []);


  // The thumbnail behind the row: the beach cover if we have it, otherwise a
  // gradient. Never an empty grey box - a row with a hole in it looks like the
  // report itself is damaged.
  function coverOf(beachId: string) {
    const beach = beaches.find((b) => b.id === beachId);
    return {
      url: beach ? beach.coverImageUrl : null,
      scene: beach ? beach.scene : 'linear-gradient(160deg,#4E9EC9,#1C4A85)',
    };
  }


  // Filter in the browser. The full list is already here, so re-asking the
  // server for a subset would make switching tabs slower than it needs to be.
  let rows = reports;
  if (tab === 'Counted') rows = reports.filter((r) => r.status === 'Counted');
  if (tab === 'Excluded') rows = reports.filter((r) => r.status !== 'Counted');

  return (
    <div className="screen scroll-y" style={{ zIndex: 24 }}>
      <div
        className="anim-fade-up pt-page-lg measure"
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
                aria-pressed={active}
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

        {!loading && failed && (
          <div style={{ marginTop: 8 }}>
            <ErrorNote
              title="Couldn't load your reports"
              body="They're still saved — this is just the connection."
              onRetry={loadReports}
            />
          </div>
        )}

        {/* Three empty states, never confused with each other: still loading,
            the request failed, or genuinely nothing yet. A first-time user must
            not be shown an error, and a user whose connection dropped must not
            be told they have never contributed. */}
        {!loading && !failed && rows.length === 0 && (
          <div style={{ border: '1.5px dashed rgba(11,33,97,.18)', borderRadius: 24, padding: '36px 24px', textAlign: 'center', marginTop: 8 }}>
            <div style={{ width: 52, height: 52, borderRadius: 26, background: 'rgba(11,33,97,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <Camera size={22} color={C.dim} strokeWidth={1.7} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 650, marginTop: 12, color: C.ink2 }}>Your first one's waiting</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 5, lineHeight: 1.5 }}>
              Next time you're at the coast, snap what you see.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r) => {
            return (
              <button
                key={r.id}
                type="button"
                // Every row opens the correction flow, not only the excluded
                // ones. A row that takes focus and then does nothing tells a
                // keyboard or screen reader user it is broken.
                onClick={() => {
                  resetDraft();
                  // Left over from the last submission. The route guard in
                  // App.tsx reads it when a draft is not ready for the step
                  // being opened, and would send this edit back to the list.
                  setLastSavedReport(null);
                  patchDraft({
                    editingReportId: r.id,
                    beachId: r.beachId,
                    beachName: r.beachName,
                    quantities: { ...r.quantities },
                    locationSource: r.locationSource ?? 'manual',
                    coords: null,
                    existingPhotoUrl: r.photoUrl ?? null,
                    existingPhotoKey: r.photoKey ?? null,
                    // An old report can carry a photo key whose file we can no
                    // longer show. Working it out here means the edit screens
                    // say the photo is unavailable instead of drawing an empty
                    // frame, and the photo step is not skipped over.
                    existingPhotoUnavailable: historicalPhotoUnavailable(r.photoUrl, r.photoKey),
                    editingStatus: r.status,
                    editingStatusNote: r.statusNote ?? null,
                  });
                  nav('/report/details', { replace: true });
                }}
                // The visible row is three separate scraps of text, so a screen
                // reader would run them together. This gives the button one
                // clear name and says what pressing it does.
                aria-label={`Correct report for ${r.beachName}`}
                className="card-hover"
                style={{
                  display: 'flex',
                  gap: 13,
                  background: C.white,
                  border: `1px solid ${C.line}`,
                  borderRadius: 22,
                  padding: 13,
                  width: '100%',
                  cursor: 'pointer',
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
                    <StatusBadge status={r.status.toLowerCase() as BadgeStatus} indicator>{r.status}</StatusBadge>
                  </div>
                  {/* A report holds a count per litter category, so the row
                      needs the shared formatter to fold the whole findings
                      table into one line that always reads the same way. */}
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3, lineHeight: 1.45 }}>
                    {formatReportComposition(r.quantities)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.faint, marginTop: 3 }}>
                    {formatDate(r.createdAt)}
                  </div>
                  {/* The server's explanation of why this one was excluded,
                      printed on the row itself. Without it "Incomplete" is a
                      verdict with no reason attached. */}
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

        {/* The guide stays on screen instead of hiding behind a help link.
            These words decide whether a volunteer's work counted, so the
            definitions belong next to them. */}
        <div style={{ marginTop: 4, padding: '13px 15px', borderRadius: 16, background: 'rgba(11,33,97,.03)', border: '1px solid rgba(11,33,97,.07)' }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '.14em', color: C.dim }}>STATUS GUIDE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11.5, lineHeight: 1.55, color: C.muted, marginTop: 7 }}>
            {/* The guide has to name the tabs, not just the statuses. It used
                to explain Counted, Duplicate and Incomplete while the tabs
                above read All / Counted / Excluded - so the word "Excluded" was
                on screen twice with nothing anywhere saying which statuses land
                under it, leaving the reader to infer it. Naming Excluded and
                folding its two statuses into that line also makes the guide
                shorter than it was. */}
            {[
              { s: 'Counted', c: C.green, t: 'counts toward the beach rating' },
              { s: 'Excluded', c: C.muted, t: 'Duplicate (same participant, beach and local day as an existing counted report) or Incomplete (missing field or unusable photo — correctable). Neither changes any beach rating.' },
            ].map((r) => (
              <div key={r.s}>
                <b style={{ color: r.c }}>{r.s}</b> — {r.t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
