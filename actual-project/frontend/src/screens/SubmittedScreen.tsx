// The result screen: what happened to the report that was just submitted.
//
// It shows one of three outcomes - Counted, Duplicate, Incomplete - and treats
// all three as a SAVED report, not a failure. Duplicate and Incomplete reports
// still belong to the volunteer and can still be corrected. Telling somebody
// their walk on the beach was wasted is how you lose them.
//
// The wording for each outcome is in reportOutcome() in flowRules.ts.
import { Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { ArrowRight, Check, ChevronRight } from '../components/Icon';
import { GhostButton, PrimaryButton } from '../components/ui';
import { C, MONO } from '../theme';
import { useApp } from '../AppContext';
import { reportOutcome } from '../flowRules';

export default function SubmittedScreen() {
  const nav = useNavigate();
  const { lastSavedReport: saved, patchDraft, resetDraft, setLastSavedReport } = useApp();

  // Clear the draft only now, once this screen has mounted.
  //
  // It is not cleared at submit time on purpose. The review page's route guard
  // reads the draft, so clearing it before the navigation had committed would
  // make the guard see an empty draft and bounce the user back to step 1
  // instead of showing this confirmation. By the time this runs, they are
  // safely here. See finishReportSubmission() in flowRules.ts.
  //
  // The empty dependency list means once per mount, never on a re-render.
  useEffect(() => {
    if (saved) resetDraft();
  }, []);


  // The report shown here is the one POST just returned, held in shared state.
  // We deliberately do not fetch it again: a second request that was slow or
  // failed would throw the user off the very screen confirming their work.
  //
  // Landing here with nothing means the page was opened directly, so send them
  // to their reports list rather than showing an empty confirmation.
  if (!saved) return <Navigate to="/reports" replace />;

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
              report was excluded, while our text can only describe the rule in
              general. */}
          <div style={{ fontSize: 13, color: C.muted, marginTop: 10, lineHeight: 1.5, maxWidth: 296 }}>
            {saved.statusNote || outcome.message}
          </div>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 22, overflow: 'hidden' }}>
          {row('Beach', saved.beachName)}
          {row('Category', saved.category)}
          {row('Quantity', saved.quantity)}
          {/* The actual number this report contributed. Showing it, rather
              than only the category, means a volunteer can follow their own
              report through to the beach's score instead of taking it on
              trust. Two decimals, because the weights produce values like
              1.70 and rounding to a whole number would hide real differences. */}
          {row('Report score', saved.reportScore.toFixed(2))}
          {row('Location', 'Beach level only', undefined, true)}
        </div>

        {/* A link to the scoring rules, offered at the moment the user first
            has a stake in them. This is when "how was that decided?" actually
            occurs to somebody. */}
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
              report are cleared: while a saved report is still set, any report
              step the new draft has not reached yet redirects to the reports
              list, which would push this new report out of the flow. */}
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
            <GhostButton
              height={50}
              style={{ borderRadius: 16, fontSize: 13.5 }}
              // "Correct report" starts a new draft pre-filled from the saved
              // report. resetDraft() first, then fill: patching on top of
              // whatever was left would mix two reports together. The saved
              // report is cleared for the same reason as above.
              //
              // editingReportId is what turns the flow into an edit - the photo
              // becomes optional and the submit becomes a PATCH. The old photo
              // key comes along so the volunteer does not have to take the
              // picture again, and the old status and note come along so the
              // edit screens can say what needs fixing. locationSource is kept
              // as it was, but coords are left null: we remember HOW the beach
              // was located without re-using coordinates the user has not
              // confirmed for this new submission.
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
                  editingStatus: saved.status,
                  editingStatusNote: saved.statusNote ?? null,
                  locationSource: saved.locationSource ?? 'manual',
                  coords: null,
                });


                // replace: this confirmation page is used up by the
                // correction. If it stayed in the history, Back would return to
                // a page still offering "Correct report", and pressing it again
                // would reset the half-finished correction.
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
