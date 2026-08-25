import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { createReport, getBeaches, updateReport } from '../api';
import { ArrowRight, Info, Shield } from '../components/Icon';
import { BackButton, ErrorNote, PrimaryButton, StepBadge, TextButton } from '../components/ui';
import { C, MONO } from '../theme';
import { useApp } from '../AppContext';
import type { BeachSummary } from '../types';

export default function ReviewScreen() {
  const nav = useNavigate();
  const { draft, resetDraft, setLastSavedReportId, bumpReports, showToast } = useApp();
  const [beaches, setBeaches] = useState<BeachSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBeaches()
      .then((list) => setBeaches(list))
      .catch(() => setBeaches([]));
  }, []);

  const beach = beaches.find((b) => b.id === draft.beachId);

  async function submit() {
    if (!draft.beachId || !draft.category || !draft.quantity || !draft.photo) {
      setError('This report is missing a required field. Go back and complete it.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        beachId: draft.beachId,
        category: draft.category,
        quantity: draft.quantity,
        photoId: draft.photo.id,
        locationSource: draft.locationSource ?? 'manual',
        ...(draft.coords ? { coords: draft.coords } : {}),
      };
      const saved = draft.editingReportId
        ? await updateReport(draft.editingReportId, payload)
        : await createReport(payload);
      setLastSavedReportId(saved.id);
      bumpReports();
      resetDraft();
      nav('/report/saved', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this record.');
      showToast('Save failed — please try again');
    } finally {
      setBusy(false);
    }
  }

  const row = (label: string, value: string, action?: () => void, badge?: string) => (
    <button
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
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 8, letterSpacing: '.08em', color: C.slate, background: 'rgba(11,33,97,.06)', padding: '4px 7px', borderRadius: 7 }}>
          {badge}
        </span>
      )}
    </button>
  );

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <div
        className="anim-fade-up pt-page"
        style={{ paddingInline: 20, paddingBottom: 'calc(var(--safe-bottom) + 32px)', display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackButton onClick={() => nav('/report/details')} />
          <StepBadge>STEP 3 OF 3 · REVIEW</StepBadge>
        </div>

        <div>
          <div style={{ fontSize: 29, fontWeight: 640, letterSpacing: '-.7px' }}>Almost there</div>
          <div style={{ fontSize: 13.5, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
            Have a quick look before it goes in. Anything here can still be changed.
          </div>
        </div>

        <div style={{ position: 'relative', height: 150, borderRadius: 24, overflow: 'hidden', background: '#A19C90' }}>
          {draft.photo && (
            <img src={draft.photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          <div style={{ position: 'absolute', left: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 8, letterSpacing: '.1em', color: C.cloud, background: 'rgba(11,33,97,.75)', backdropFilter: 'blur(6px)', padding: '5px 9px', borderRadius: 999 }}>
            <Shield size={10} />
            METADATA REMOVED
          </div>
        </div>

        <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 24, overflow: 'hidden' }}>
          {row('Beach', beach?.name ?? 'Not selected', () => nav('/report/confirm'))}
          {row('Category', draft.category ?? 'Not selected', () => nav('/report/details'))}
          {row('Quantity', draft.quantity ?? 'Not selected', () => nav('/report/details'))}
          {row('Location', 'Beach area confirmed', undefined, 'GPS PRIVATE')}
        </div>

        {error && <ErrorNote title="Could not save" body={error} />}

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: C.tint, borderRadius: 16, padding: '13px 14px' }}>
          <Info style={{ flex: 'none', marginTop: 1 }} />
          <div style={{ fontSize: 12, lineHeight: 1.55, color: C.slate }}>
            Saving stores a standardised record for this beach. Duplicate or incomplete records are
            excluded from the severity calculation — the same rule for every beach.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <PrimaryButton onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Submit Report'}
            {!busy && <ArrowRight />}
          </PrimaryButton>
          <TextButton onClick={() => nav('/report/details')}>Back to details</TextButton>
        </div>
      </div>
    </div>
  );
}
