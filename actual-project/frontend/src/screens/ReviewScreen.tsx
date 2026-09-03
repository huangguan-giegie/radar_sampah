// Last step: check everything, then submit.
// Every row can be changed from here. A review screen that shows a mistake
// without a way to fix it makes people guess how many times to press Back,
// and on a phone that usually ends with them starting again.
// New reports and corrections both land here; buildReportSubmission in
// flowRules.ts decides which, so this screen never has to branch on it.
import { useLocation, useNavigate } from 'react-router-dom';
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
  const location = useLocation();
  const { draft, setLastSavedReport, bumpReports, showToast } = useApp();
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  // busy disables the submit button while the request is in flight - the one
  // place a disabled button is right, since a second tap would file twice.
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
    // Two try blocks on purpose. This one is about the DRAFT being wrong, and
    // the user can fix that here. The one below is about the REQUEST failing,
    // which they can only retry. Merged, an outage would read as their fault.
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
      // Order matters. Keep the saved report first, so the next screen needs no
      // second request that might fail. Refresh the counts. Then navigate via
      // finishReportSubmission, which commits the move before the confirmation
      // screen clears the draft - clear it first and this page's route guard
      // sees an empty draft and bounces the user back to step 1.
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
   * Going back to details should pop this page off the history, not push
   * another one. Pushing leaves [..., details, details], so the back arrow on
   * the details screen appears to do nothing - it lands on an identical page.
   *
   * Whether there is anything to pop is read from the router state that the
   * details screen stamps on the navigation. A refreshed tab can open straight
   * on this review page with no such state; backFromReview() in flowRules.ts
   * turns that case into a replace. It lives there because it is tested there
   * - inline, an edit once turned its fallback into a call to itself and locked
   * the screen with a stack overflow.
   */
  const backToDetails = () => {
    const action = backFromReview(location.state as { from?: string } | null);
    if (action.pop) nav(-1);
    else nav(action.to, { replace: true });
  };


  // The label doubles as the React key. A category appears at most once in a
  // report, so it is unique, while an array index would rebind rows to the
  // wrong data as soon as a category was removed.
  //
  // The optional badge is how the location row says what was stored: "GPS
  // PRIVATE" means coordinates were used but stay unpublished, "NO GPS STORED"
  // means there were none. Last screen before the data leaves the phone.
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
          {/* Correcting a report whose original photo will not load. Say so
              plainly, because the old photo is still kept unless they pick
              a replacement. */}
          {draft.existingPhotoUnavailable && !photoUrl && (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', color: C.slate, fontSize: 12 }}>
              Existing photo unavailable. The existing record will be kept unless you choose a replacement photo.
            </div>
          )}
          {(draft.photo?.metadataStripped || draft.existingPhotoUrl || draft.existingPhotoUnavailable) && (
            <OverlayChip style={{ position: 'absolute', left: 12, bottom: 12 }}>
              <Shield size={10} />
              {draft.photo ? 'LOCATION METADATA REMOVED' : draft.existingPhotoUnavailable ? 'EXISTING PHOTO UNAVAILABLE' : 'EXISTING PHOTO RETAINED'}
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
