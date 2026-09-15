import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, Check, Upload } from '../components/Icon';
import { Alert, Callout, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import {
  analyseCleanupPhoto,
  CLEANUP_BAND_UNITS,
  completeCleanup,
  formatEventDate,
  getCleanupEvent,
  getCleanupTarget,
  type CleanupHandling,
} from '../iteration2';
import { C, formatDate } from '../theme';
import type { LitterCategory, QuantityBand, QuantityByCategory } from '../types';

const HANDLING: CleanupHandling[] = ['Collected for disposal', 'Recycled / handled', 'Not recorded'];
const CLEANUP_CATEGORIES: LitterCategory[] = ['Fishing gear', 'Plastic', 'Glass', 'Metal', 'Other', 'Paper'];
const BANDS: QuantityBand[] = ['Small', 'Medium', 'Large', 'Very Large'];

export default function CleanupScreen() {
  const { beachId = '' } = useParams();
  const [params] = useSearchParams();
  const eventId = params.get('event');
  const targetReportId = params.get('target') ?? undefined;
  const nav = useNavigate();
  const { user, showToast } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const idempotencyKey = useRef<string | null>(null);
  const [event, setEvent] = useState<Awaited<ReturnType<typeof getCleanupEvent>>>(null);
  const [target, setTarget] = useState<Awaited<ReturnType<typeof getCleanupTarget>>>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<QuantityByCategory>({});
  const [handling, setHandling] = useState<CleanupHandling>('Collected for disposal');
  const [note, setNote] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photoUsed, setPhotoUsed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoName = photoFile?.name ?? null;

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getCleanupTarget(beachId, targetReportId), eventId ? getCleanupEvent(eventId) : Promise.resolve(null)])
      .then(([targetResult, eventResult]) => {
        if (!active) return;
        setTarget(targetResult);
        setEvent(eventResult);
        setQuantities(targetResult ? { ...targetResult.remainingQuantities } : {});
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load cleanup details.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [beachId, eventId, targetReportId]);

  const categories = useMemo(
    () => target ? (Object.keys(target.remainingQuantities) as LitterCategory[]) : CLEANUP_CATEGORIES,
    [target],
  );

  if (loading) {
    return <div className="screen scroll-y"><div className="measure i2-page"><BackButton onClick={() => nav(eventId ? `/events/${eventId}` : `/beach/${beachId}`)} /><SectionLabel size="sm">Loading cleanup…</SectionLabel></div></div>;
  }

  async function usePhotoSuggestion() {
    if (!photoFile) {
      inputRef.current?.click();
      return;
    }
    setAnalysing(true);
    setError(null);
    try {
      const suggestion = await analyseCleanupPhoto(photoFile, target);
      const hasSuggestion = Object.keys(suggestion).length > 0;
      if (hasSuggestion) {
        setQuantities(suggestion);
        setPhotoUsed(true);
        showToast('AI suggestions added — please confirm them');
      } else {
        setPhotoUsed(false);
        setError(target
          ? 'No remaining litter band was suggested. Confirm the post-cleanup bands manually.'
          : 'No removed litter band was suggested. Confirm the cleanup bands manually.');
      }
      setPhotoFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI suggestion is unavailable. Confirm the quantity bands manually.');
    } finally {
      setAnalysing(false);
    }
  }

  async function submit() {
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const cleanup = await completeCleanup({
        participantId: user.participantId,
        beachId,
        targetReportId: target?.reportId,
        eventId,
        ...(target ? { remainingQuantities: quantities } : { removedQuantities: quantities }),
        handling,
        note,
        idempotencyKey: idempotencyKey.current,
      });
      idempotencyKey.current = null;
      nav(`/cleanup/result/${cleanup.id}`, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not record this cleanup.');
    } finally {
      setSubmitting(false);
    }
  }

  function setBand(category: LitterCategory, value: string) {
    setQuantities((current) => {
      const next = { ...current };
      if (!value) delete next[category];
      else next[category] = value as QuantityBand;
      return next;
    });
    setError(null);
  }

  function markNoneRemaining() {
    if (!target) return;
    setQuantities({});
    setError(null);
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (!['image/jpeg', 'image/png'].includes(file.type)) {
            setError('Use a JPG or PNG image.');
            return;
          }
          setPhotoFile(file);
          setPhotoUsed(false);
          setError(null);
        }}
      />
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(event ? `/events/${event.id}` : `/beach/${beachId}`)} />
        <div>
          <SectionLabel size="sm">ADD A CLEANUP</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>{target ? 'Confirm what remains' : 'Confirm what you removed'}</h1>
          <p className="i2-subtitle">
            {target
              ? 'Use quantity bands for the litter left after cleanup. Categories with nothing left can be set to None.'
              : 'Record removed litter with Small, Medium, Large, or Very Large bands.'}
          </p>
        </div>

        {target ? (
          <div className="i2-card">
            <SectionLabel size="sm">REPORTED LITTER AT THIS BEACH</SectionLabel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 720, color: C.ink2 }}>{target.beachName}</div>
                <div style={{ marginTop: 4, fontSize: 11.5, color: C.muted }}>Report {target.reportId} · {formatDate(target.reportedAt)}</div>
              </div>
              <InfoChip color={C.green} background={C.greenBg}>Linked report</InfoChip>
            </div>
            <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.line}`, display: 'grid', gap: 7 }}>
              {(Object.entries(target.remainingQuantities) as [LitterCategory, QuantityBand][]).map(([category, band]) => (
                <div key={category} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11.5 }}>
                  <span style={{ color: C.muted }}>{category}</span><strong>{band}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Callout title="No prior report required" tone="reassurance">
            You can record a cleanup at this beach at any time. Record only the litter bands you actually removed; this standalone cleanup will not alter an unrelated report.
          </Callout>
        )}

        {event && (
          <Callout title="Linked activity" tone="quiet">
            {event.beachName} · {formatEventDate(event.date)}. A completed cleanup can satisfy the event evidence requirement after check-in.
          </Callout>
        )}

        <div className="i2-card">
          <SectionLabel size="sm">OPTIONAL AI SUGGESTION</SectionLabel>
          <p style={{ margin: '7px 0 12px', fontSize: 12, lineHeight: 1.5, color: C.muted }}>
            Optional photo · processed, then discarded
          </p>
          <button type="button" className="i2-field press" onClick={() => inputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left' }}>
            <span style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(11,33,97,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {photoName ? <Camera color={C.navy} /> : <Upload color={C.navy} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 13 }}>{photoName ?? (photoUsed ? 'Photo processed and discarded' : 'Choose after-cleanup photo')}</strong>
              <span style={{ display: 'block', marginTop: 2, color: C.dim, fontSize: 10.5 }}>JPG or PNG · optional</span>
            </span>
          </button>
          {photoName && <PrimaryButton onClick={usePhotoSuggestion} disabled={analysing} height={48} style={{ marginTop: 10 }}>{analysing ? 'Checking photo…' : 'Get editable suggestions'}</PrimaryButton>}
          {photoUsed && <Callout title="AI suggestion" tone="reassurance" icon={<Check color={C.green} />} style={{ marginTop: 10 }}>These bands are only a suggestion — edit any row before you confirm.</Callout>}
        </div>

        <div className="i2-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
            <SectionLabel size="sm">{target ? 'LITTER REMAINING' : 'LITTER REMOVED'}</SectionLabel>
            {target && <button type="button" onClick={markNoneRemaining} style={{ fontSize: 11, fontWeight: 720, color: C.navy }}>Mark none remaining</button>}
          </div>
          <div style={{ marginTop: 8 }}>
            {categories.map((category) => {
              const before = target?.remainingQuantities[category];
              const allowedBands = target && before
                ? BANDS.filter((band) => CLEANUP_BAND_UNITS[band] <= CLEANUP_BAND_UNITS[before])
                : BANDS;
              return (
                <label key={category} className="i2-quantity-row">
                  <span>
                    <strong style={{ display: 'block', fontSize: 13.5, color: C.ink2 }}>{category}</strong>
                    <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: C.dim }}>
                      {before ? `Before cleanup: ${before}` : 'Choose a band only if this category was removed'}
                    </span>
                  </span>
                  <select
                    className="i2-field"
                    aria-label={`${category} ${target ? 'remaining quantity band' : 'removed quantity band'}`}
                    value={quantities[category] ?? ''}
                    onChange={(event) => setBand(category, event.target.value)}
                  >
                    <option value="">{target ? 'None remaining' : 'Not recorded'}</option>
                    {allowedBands.map((band) => <option key={band} value={band}>{band}</option>)}
                  </select>
                </label>
              );
            })}
          </div>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">HANDLING</SectionLabel>
          <label style={{ display: 'block', marginTop: 10 }}>
            <span style={{ display: 'block', marginBottom: 6, fontSize: 11.5, color: C.muted }}>What happened to the collected litter?</span>
            <select className="i2-field" value={handling} onChange={(event) => setHandling(event.target.value as CleanupHandling)}>
              {HANDLING.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label style={{ display: 'block', marginTop: 12 }}>
            <span style={{ display: 'block', marginBottom: 6, fontSize: 11.5, color: C.muted }}>Optional note</span>
            <textarea className="i2-field" rows={3} maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example: bagged and placed at the collection point" />
          </label>
        </div>

        {error && <Alert title="Cleanup not saved" tone="error">{error}</Alert>}

        <PrimaryButton onClick={submit} disabled={submitting}>{submitting ? 'Recording…' : 'Record cleanup'}</PrimaryButton>
        <TextButton onClick={() => nav(event ? `/events/${event.id}` : `/beach/${beachId}`)}>Cancel</TextButton>
      </div>
    </div>
  );
}
