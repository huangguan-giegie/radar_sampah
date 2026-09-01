// The last step: check everything, then submit.
//
// Every row here can be changed from here. A review screen that only shows you
// your mistake, without a way to fix it, forces the user to guess how many
// times to press Back - and on a phone that usually ends with them starting
// again.
//
// It handles BOTH new reports and corrections to an old one. The difference is
// worked out by buildReportSubmission in flowRules.ts, so this screen does not
// have to branch on it.
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { createReport, getBeaches, photoPreviewUrl, updateReport } from '../api';
import { ArrowRight, Info, Shield } from '../components/Icon';
import { BackButton, ErrorNote, PrimaryButton, StepBadge, TextButton } from '../components/ui';
import { C } from '../theme';
import { OverlayChip, StatusBadge } from '../components/ds';
import { useApp } from '../AppContext';
import type { BeachSummary, LitterCategory, QuantityBand } from '../types';
import { backFromReview, buildReportSubmission, finishReportSubmission } from '../flowRules';

export default function ReviewScreen() {
  const nav = useNavigate();
  const { draft, setLastSavedReport, bumpReports, showToast } = useApp();
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  // busy disables the submit button while the request is in flight - the one
  // place a disabled button is right, because a second tap would file the
  // report twice.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeaches([]));
  }, []);

  const beach = beaches.find((b) => b.id === draft.beachId);

  const photoUrl =
    draft.photo?.previewUrl || photoPreviewUrl(draft.photo?.photoKey) || draft.existingPhotoUrl;

  async function submit() {
    // Two separate try blocks, on purpose. This first one is about the DRAFT
    // being wrong, and the user can fix it here. The second is about the
    // REQUEST failing, which they can only retry. Merging them would report a
    // network outage as a mistake the user made.
    let submission: ReturnType<typeof buildReportSubmission>;
    try {
      submission = buildReportSubmission(draft);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : 'This report is missing a required field.',
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const saved =
        submission.kind === 'update'
          ? await updateReport(submission.reportId, submission.changes)
          : await createReport(submission.payload);
      // Order matters here.
      // 1. keep the saved report, so the next screen can show it without
      //    another request that might fail
      // 2. tell the rest of the app to refresh its counts
      // 3. navigate through finishReportSubmission, which commits the move
      //    BEFORE the draft is cleared - the confirmation screen clears it
      //    after mounting. Clearing first would let this page's own route
      //    guard see an empty draft and bounce the user back to step 1.
      setLastSavedReport(saved);
      bumpReports();
      finishReportSubmission(nav);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this report.');
      showToast('Save failed');
    } finally {
      setBusy(false);
    }
  }


  /*
   * Going back to the details step: pop this page off the history, do not push
   * another one.
   *
   * Pushing would leave the history as [..., details, details], so the back
   * arrow on the details screen would appear to do nothing - it lands on an
   * identical page. Using replace has the same effect. Popping restores
   * [..., confirm, details], so the in-page back button and the browser's own
   * back button finally point the same way.
   *
   * There is one case with nothing to pop: the draft survives a refresh, so a
   * reloaded tab can open directly on this review page. The decision lives in
   * backFromReview() in flowRules.ts, where it is tested - it used to be inline
   * here, and an edit turned its fallback into a call to itself, which locked
   * the whole screen with a stack overflow.
   */
  const backToDetails = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    const action = backFromReview(idx);
    if (action.pop) nav(-1);
    else nav(action.to, { replace: true });
  };


  // The label is used as the React key. These rows come from a map, and within
  // one report a category appears at most once, so the label is unique. Using
  // the array index instead would reassign rows to the wrong data as soon as a
  // category was removed.
  //
  // The optional badge is what the location row uses to say what was stored:
  // "GPS PRIVATE" means coordinates were used but stay unpublished, "NO GPS
  // STORED" means there were none at all. This is the last screen before the
  // data leaves their device, so it is the honest place to say it.
  const row = (label: string, value: string, action?: () => void, badge?: string) => (
    <button
      key={label}
      type="button"
      onClick={action}
      className={action ? 'row-hover' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '14px 17px',
        borderBottom: `1px solid rgba(11,33,97,.06)`,
        width: '100%',
        cursor: action ? 'pointer' : 'default',
      }}
    >
      <span style={{ width: 92, flex: 'none', fontSize: 11.5, fontWeight: 600, color: C.dim }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 640, flex: 1 }}>{value}</span>
      {action && <span style={{ fontSize: 11.5, fontWeight: 700, color: C.navy }}>Change</span>}
      {badge && (
        <StatusBadge status="duplicate" style={{ marginLeft: 'auto' }}>
          {badge}
        </StatusBadge>
      )}
    </button>
  );

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <div
        className="anim-fade-up pt-page measure"
        style={{ paddingInline: 20, paddingBottom: 'calc(var(--safe-bottom) + 32px)', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackButton onClick={() => backToDetails()} />
          <StepBadge>STEP 3 OF 3 · REVIEW</StepBadge>
        </div>

        <div>
          <div style={{ fontSize: 29, fontWeight: 640, letterSpacing: '-.7px' }}>Almost there</div>
        </div>

        <div style={{ position: 'relative', height: 150, borderRadius: 24, overflow: 'hidden', background: '#A19C90' }}>
          {photoUrl && (
            <img src={photoUrl} alt="Report evidence" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          {(draft.photo?.metadataStripped || draft.existingPhotoUrl) && (
            <OverlayChip style={{ position: 'absolute', left: 12, bottom: 12 }}>
              <Shield size={10} />
              {draft.photo ? 'LOCATION METADATA REMOVED' : 'EXISTING PHOTO RETAINED'}
            </OverlayChip>
          )}
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 24, overflow: 'hidden' }}>
          {row('Beach', draft.beachName ?? beach?.name ?? 'Not selected', () => nav('/report/confirm', { replace: true }))}
          {(Object.keys(draft.quantities) as LitterCategory[]).length === 0
            ? row('Litter', 'Not selected', () => backToDetails())
            : (Object.entries(draft.quantities) as [LitterCategory, QuantityBand][]).map(([cat, q]) =>
                row(cat, q ?? 'Not selected', () => backToDetails()),
              )}
          {draft.locationSource === 'gps'
            ? row('Location', 'Beach area confirmed', undefined, 'GPS PRIVATE')
            : row('Location', 'Selected manually', undefined, 'NO GPS STORED')}
        </div>

        {error && <ErrorNote title="Could not save" body={error} />}

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: C.tint, borderRadius: 16, padding: '13px 14px' }}>
          <Info style={{ flex: 'none', marginTop: 1 }} />
          <div style={{ fontSize: 12, lineHeight: 1.55, color: C.slate }}>
            Duplicate or incomplete reports are excluded from the severity calculation — the same
            rule for every beach.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Submit Report'}
            {!busy && <ArrowRight />}
          </PrimaryButton>
          <TextButton onClick={() => backToDetails()}>Back to details</TextButton>
        </div>
      </div>
    </div>
  );
}
