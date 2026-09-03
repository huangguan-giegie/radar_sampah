// The result screen: what happened to the report that was just submitted.
//
// It shows one of three outcomes - Counted, Duplicate, Incomplete - and treats
// all three as a SAVED report, not a failure. Duplicate and incomplete reports
// still belong to the volunteer and can still be corrected. Telling somebody
// their walk on the beach was wasted is how you lose them. Wording lives in
// reportOutcome() in flowRules.ts.
import { useRef } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, Check, ChevronRight } from '../components/Icon';
import { GhostButton, PrimaryButton } from '../components/ui';
import { C, MONO } from '../theme';
import { useApp } from '../AppContext';
import { formatReportComposition, historicalPhotoUnavailable, reportOutcome } from '../flowRules';

export default function SubmittedScreen() {
  const nav = useNavigate();
  const { lastSavedReport: saved, patchDraft, resetDraft, setLastSavedReport } = useApp();

  // Clear the draft only now, once this screen has mounted. Doing it at submit
  // time would let the review page's route guard see an empty draft before the
  // navigation committed and bounce the user back to step 1. The empty
  // dependency list means once per mount, never on a re-render.
  useEffect(() => {
    if (saved) resetDraft();
  }, []);


  // Everything shown here is the report the POST just returned, held in shared
  // state. We never re-fetch it: a slow or failed second request would knock
  // the user off the one screen that is confirming their work.
  //
  // Both exit buttons clear lastSavedReport and then navigate, in one event.
  // React re-renders with saved === null before the navigation commits, so a
  // bare `if (!saved) <Navigate>` beat nav() and sent everyone to /reports.
  // Only redirect on a cold open; on the way out, render nothing for a frame.
  const hadReport = useRef(false);
  if (saved) hadReport.current = true;
  if (!saved && !hadReport.current) return <Navigate to="/reports" replace />;
  if (!saved) return null;

  // Colour and wording both come from the status. Green for counted, red for
  // incomplete, grey for duplicate - and the badge repeats it in words, so the
  // meaning never depends on seeing the colour.
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
      <span style={{ minWidth: 0, flex: 1, fontSize: 13.5, fontWeight: 630, lineHeight: 1.4, overflowWrap: 'anywhere' }}>{value}</span>
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
        className="anim-fade-up pt-page-lg measure"
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
          {/* The server's own note wins when there is one: it knows why THIS
              report was excluded, while our text can only state the rule. */}
          <div style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.5, maxWidth: 296 }}>
            {saved.statusNote || outcome.message}
          </div>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden' }}>
          {row('Beach', saved.beachName)}
          {/* One Findings row, not a Category row and a Quantity row: a single
              report can hold several categories at once. */}
          {row('Findings', formatReportComposition(saved.quantities))}
          {/* The actual number this report contributed. Showing it lets a
              volunteer follow their own report through to the beach's score
              instead of taking it on trust. Two decimals, because the weights
              produce values like 1.70 and rounding would hide the difference. */}
          {row('Report score', saved.reportScore.toFixed(2))}
          {row('Location', 'Beach level only', undefined, true)}
        </div>

        {/* A link to the scoring rules, offered at the moment the user first
            has a stake in them. This is when "how was that decided?" occurs
            to somebody. */}
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
            Reports use the highest category score, and each beach uses the median of counted
            report scores over the reporting window. Duplicate or incomplete reports are excluded.
          </div>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {/* Straight into another report. Both the draft and the just-saved
              report are cleared: while a saved report is still set, any step
              the new draft has not reached yet redirects to the reports list,
              which would push this new report out of the flow. */}
          <PrimaryButton
            onClick={() => {
              resetDraft();
              setLastSavedReport(null);
              nav('/report/photo');
            }}
          >
            Add another report
            <ArrowRight />
          </PrimaryButton>
          <PrimaryButton onClick={() => nav(`/beach/${saved.beachId}`)}>
            View Beach
            <ArrowRight />
          </PrimaryButton>
          <div style={{ display: 'flex', gap: 9 }}>
            {/* "Correct report" pre-fills a new draft from the saved one.
                resetDraft() first, then fill, or two reports blend together.
                editingReportId is what turns the flow into an edit: the photo
                becomes optional and the submit becomes a PATCH. The old photo
                key rides along so the picture need not be retaken, and the
                unavailable flag is set when that key has no working URL.
                Coords stay null - we keep how the beach was found, not a
                position the user has not confirmed for this submission. */}
            <GhostButton
              height={50}
              style={{ borderRadius: 16, fontSize: 13.5 }}
              onClick={() => {
                resetDraft();
                setLastSavedReport(null);
                patchDraft({
                  editingReportId: saved.id,
                  beachId: saved.beachId,
                  beachName: saved.beachName,
                  quantities: { ...saved.quantities },
                  existingPhotoUrl: saved.photoUrl ?? null,
                  existingPhotoKey: saved.photoKey ?? null,
                  existingPhotoUnavailable: historicalPhotoUnavailable(saved.photoUrl, saved.photoKey),
                  editingStatus: saved.status,
                  editingStatusNote: saved.statusNote ?? null,
                  locationSource: saved.locationSource ?? 'manual',
                  coords: null,
                });


                // replace: this confirmation page is used up by the correction.
                // Left in the history, Back would return to a page still
                // offering "Correct report", and pressing it again would reset
                // the half-finished correction.
                nav('/report/details', { replace: true });
              }}
            >
              Correct report
            </GhostButton>
            <GhostButton height={50} style={{ borderRadius: 16, fontSize: 13.5 }} onClick={() => nav('/reports')}>
              My Reports
            </GhostButton>
          </div>
        </div>
      </div>
    </div>
  );
}
