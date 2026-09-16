import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, Check, Upload } from '../components/Icon';
import { Alert, Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import {
  analyseCleanupPhoto,
  formatEventDate,
  getCleanupEvent,
  getCleanupForTarget,
  getCleanupTarget,
  QUANTITY_BANDS,
  type CleanupHandling,
} from '../iteration2';
import { fetchCleanupEvent, fetchCleanupForTarget, fetchCleanupTarget, submitCleanup } from '../iteration2Api';
import { C, MONO, formatDate } from '../theme';
import type { LitterCategory, QuantityBand } from '../types';
import { useAsyncData } from '../useAsyncData';

const HANDLING: CleanupHandling[] = ['Collected for disposal', 'Recycled / handled', 'Not recorded'];

export default function CleanupScreen() {
  const { beachId = '' } = useParams();
  const [params] = useSearchParams();
  const eventId = params.get('event');
  const nav = useNavigate();
  const { user, showToast } = useApp();
  const { data: event, loading: eventLoading } = useAsyncData(
    () => eventId ? fetchCleanupEvent(eventId) : Promise.resolve(null),
    [eventId, user?.participantId],
    eventId ? getCleanupEvent(eventId) : null,
  );
  const { data: target, loading: targetLoading, error: targetError } = useAsyncData(
    () => fetchCleanupTarget(beachId),
    [beachId],
    getCleanupTarget(beachId),
  );
  const { data: existing, loading: existingLoading } = useAsyncData(
    () => target ? fetchCleanupForTarget(target.reportId) : Promise.resolve(null),
    [target?.reportId],
    target ? getCleanupForTarget(target.reportId) : null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const [afterBands, setAfterBands] = useState<Partial<Record<LitterCategory, QuantityBand>>>({});
  const [handling, setHandling] = useState<CleanupHandling>('Not recorded');
  const [note, setNote] = useState('');
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [photoUsed, setPhotoUsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const categories = useMemo(
    () => target ? (Object.keys(target.remainingBands) as LitterCategory[]).filter((category) => target.remainingBands[category]) : [],
    [target],
  );

  if ((eventLoading || targetLoading || existingLoading) && !target && !existing) {
    return <div className="screen scroll-y"><div className="measure i2-page"><Alert title="Loading cleanup" tone="caution">Checking the latest report and cleanup state.</Alert></div></div>;
  }

  if (existing) {
    return (
      <div className="screen scroll-y">
        <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
          <BackButton onClick={() => nav(event ? `/events/${event.id}` : `/beach/${beachId}`)} />
          <Alert title="Already cleaned up" tone="caution">
            This recorded-litter target already has a cleanup. Nothing new was saved.
          </Alert>
          <div className="i2-card">
            <SectionLabel size="sm">EXISTING CLEANUP</SectionLabel>
            <h1 style={{ margin: '8px 0 0', fontSize: 22 }}>{existing.beachName}</h1>
            <p className="i2-subtitle">{formatDate(existing.createdAt)} · cleanup score {existing.score}</p>
          </div>
          <PrimaryButton onClick={() => nav(`/cleanup/result/${existing.id}`)}>View cleanup result</PrimaryButton>
          <GhostButton onClick={() => nav(`/beach/${beachId}`)}>Back to beach</GhostButton>
        </div>
      </div>
    );
  }

  if (!target) {
    return (
      <div className="screen scroll-y">
        <div className="measure i2-page">
          <BackButton onClick={() => nav(event ? `/events/${event.id}` : `/beach/${beachId}`)} />
          <EmptyState
            title="Nothing to clean up yet"
            body={targetError ?? 'A cleanup must be linked to a report at this beach.'}
            action="Report litter here"
            onAction={() => nav(`/beach/${beachId}`)}
          />
        </div>
      </div>
    );
  }

  const cleanupTarget = target;

  async function usePhotoSuggestion() {
    if (!photoName) {
      inputRef.current?.click();
      return;
    }
    setAnalysing(true);
    setError(null);
    try {
      const suggestion = await analyseCleanupPhoto(photoName, cleanupTarget);
      setAfterBands(suggestion);
      setPhotoUsed(true);
      setPhotoName(null);
      if (inputRef.current) inputRef.current.value = '';
      showToast('AI suggestions added — please confirm them');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'AI suggestion is unavailable. Choose the remaining bands manually.');
    } finally {
      setAnalysing(false);
    }
  }

  async function submit() {
    if (!user) return;
    setError(null);
    setSubmitting(true);
    try {
      const cleanup = await submitCleanup({
        participantId: user.participantId,
        targetReportId: cleanupTarget.reportId,
        eventId,
        afterBands,
        handling,
        note,
      });
      nav(`/cleanup/result/${cleanup.id}`, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not record this cleanup.');
    } finally {
      setSubmitting(false);
    }
  }

  function removeEverything() {
    const all: Partial<Record<LitterCategory, QuantityBand>> = {};
    categories.forEach((category) => { all[category] = 'Small'; });
    setAfterBands(all);
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
          setPhotoName(file.name);
          setPhotoUsed(false);
          setError(null);
        }}
      />
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(event ? `/events/${event.id}` : `/beach/${beachId}`)} />
        <div>
          <SectionLabel size="sm">ADD A CLEANUP</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>Confirm what you removed</h1>
          <p className="i2-subtitle">Select a lower remaining band only for litter you cleared.</p>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">REPORTED LITTER AT THIS BEACH</SectionLabel>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 720, color: C.ink2 }}>{target.beachName}</div>
              <div style={{ marginTop: 4, fontSize: 11.5, color: C.muted }}>Report {target.reportId} · {formatDate(target.reportedAt)}</div>
            </div>
            <InfoChip color={C.green} background={C.greenBg}>Eligible</InfoChip>
          </div>
          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 10, color: C.muted }}>
            CONFIRM BANDS, NOT EXACT COUNTS
          </div>
        </div>

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
            <SectionLabel size="sm">BANDS AFTER CLEANUP</SectionLabel>
            <button type="button" onClick={removeEverything} style={{ fontSize: 11, fontWeight: 720, color: C.navy }}>All Small</button>
          </div>
          <div style={{ marginTop: 8 }}>
            {categories.map((category) => (
              <label key={category} className="i2-quantity-row">
                <span>
                  <strong style={{ display: 'block', fontSize: 13.5, color: C.ink2 }}>{category}</strong>
                  <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: C.dim }}>Before: {target.remainingBands[category]}</span>
                </span>
                <select
                  className="i2-field"
                  aria-label={`${category} remaining band after cleanup`}
                  value={afterBands[category] ?? ''}
                  onChange={(event) => {
                    const band = event.target.value as QuantityBand;
                    setAfterBands((current) => ({ ...current, [category]: band }));
                    setError(null);
                  }}
                >
                  <option value="" disabled>Choose band</option>
                  {QUANTITY_BANDS.map((band) => <option key={band} value={band}>{band}</option>)}
                </select>
              </label>
            ))}
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

        <PrimaryButton onClick={submit} disabled={submitting || Object.keys(afterBands).length === 0}>{submitting ? 'Saving cleanup…' : 'Confirm cleanup'}</PrimaryButton>
        <TextButton onClick={() => nav(event ? `/events/${event.id}` : `/beach/${beachId}`)}>Cancel</TextButton>
      </div>
    </div>
  );
}
