import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { createReport, getBeaches, photoPreviewUrl, updateReport } from '../api';
import { ArrowRight, Info, Shield } from '../components/Icon';
import { BackButton, ErrorNote, PrimaryButton, StepBadge, TextButton } from '../components/ui';
import { C } from '../theme';
import { OverlayChip, StatusBadge } from '../components/ds';
import { useApp } from '../AppContext';
import type { BeachSummary, LitterCategory, QuantityBand } from '../types';
import { buildReportSubmission } from '../flowRules';

export default function ReviewScreen() {
  const nav = useNavigate();
  const { draft, resetDraft, setLastSavedReport, bumpReports, showToast } = useApp();
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeaches([]));
  }, []);

  const beach = beaches.find((b) => b.id === draft.beachId);
  // 刷新过一次的话 previewUrl 是空的，用存储键把图找回来
  const photoUrl =
    draft.photo?.previewUrl || photoPreviewUrl(draft.photo?.photoKey) || draft.existingPhotoUrl;

  async function submit() {
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
      setLastSavedReport(saved);
      bumpReports();
      resetDraft();
      nav('/report/saved', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this record.');
      showToast('Save failed');
    } finally {
      setBusy(false);
    }
  }

  /*
   * 从复核页回详情页：弹掉复核页这一条，别再压一条。
   *
   * 压一条历史会变成 […, details, details]，详情页左上角的返回箭头按下去
   * 停在原地；用 replace 是同样的结果。弹一条之后历史回到 […, confirm, details]，
   * 页内返回和浏览器后退指同一个方向。
   *
   * idx 是 react-router 写在 history state 里的位置。刷新后重开的标签页
   * 可能直接落在复核页上（草稿现在能活过刷新），那时候没有上一条可弹。
   */
  const backToDetails = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) nav(-1);
    else backToDetails();
  };

  // label 当 key：这几行是被 map 出来的，一份记录里同一个类别只会出现一次。
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
            Duplicate or incomplete records are excluded from the severity calculation — the same
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
