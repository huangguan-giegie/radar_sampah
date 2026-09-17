import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Camera, Check, Upload } from '../components/Icon';
import { Alert, Callout, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { getBeach } from '../api';
import { useApp } from '../AppContext';
import { hasDraftProgress, resumePath } from '../flowRules';
import {
  analyseCleanupPhoto,
  CLEANUP_BAND_UNITS,
  formatEventDate,
  getCleanupEvent,
  getCleanupTarget,
  QUANTITY_BANDS,
  type CleanupHandling,
} from '../iteration2';
import { fetchCleanupEvent, fetchCleanupTarget, submitCleanup } from '../iteration2Api';
import { C, MONO, QUANTITY_DESC, formatDate } from '../theme';
import type { LitterCategory, QuantityBand } from '../types';
import { useAsyncData } from '../useAsyncData';

const HANDLING: CleanupHandling[] = ['Collected for disposal', 'Recycled / handled', 'Not recorded'];

type Bands = Partial<Record<LitterCategory, QuantityBand>>;

// "Plastic · Fishing gear · 4 other categories". The two heaviest bands are
// named because those are what a volunteer will see first on the sand; the
// rest are counted, not listed, so the line stays one line on a phone.
function compositionLine(bands: Bands): string {
  const ranked = (Object.entries(bands) as [LitterCategory, QuantityBand | undefined][])
    .filter((entry): entry is [LitterCategory, QuantityBand] => Boolean(entry[1]))
    .sort((a, b) => CLEANUP_BAND_UNITS[b[1]] - CLEANUP_BAND_UNITS[a[1]]);
  const named = ranked.slice(0, 2).map(([category]) => category);
  const others = ranked.length - named.length;
  return others > 0
    ? [...named, `${others} other ${others === 1 ? 'category' : 'categories'}`].join(' · ')
    : named.join(' · ');
}

export default function CleanupScreen() {
  const { beachId = '' } = useParams();
  const [params] = useSearchParams();
  const eventId = params.get('event');
  const nav = useNavigate();
  const { user, showToast, draft, resetDraft, patchDraft, setLastSavedReport } = useApp();
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [afterBands, setAfterBands] = useState<Bands>({});
  const [handling, setHandling] = useState<CleanupHandling>('Not recorded');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [photoUsed, setPhotoUsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKey = useRef(crypto.randomUUID());
  const categories = useMemo(
    () => target ? (Object.keys(target.remainingBands) as LitterCategory[]).filter((category) => target.remainingBands[category]) : [],
    [target],
  );
  // The after photo is only previewed in this browser tab. The object URL is
  // released as soon as the photo changes or the screen closes, so nothing
  // outlives the "after photo is not kept" promise on the card.
  // Made in an effect rather than during render: StrictMode renders twice in
  // development, and a URL created in render would leak one blob per photo.
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  if ((eventLoading || targetLoading) && !target) {
    return <div className="screen scroll-y"><div className="measure i2-page"><Alert title="Loading cleanup" tone="caution">Checking the latest report and cleanup state.</Alert></div></div>;
  }

  if (!target) {
    // Same start as the beach page's "Report litter here": an unfinished draft
    // is offered back first, and the new report is pre-filled with this beach
    // so the button does what it says instead of only opening the beach.
    const startReport = async () => {
      if (hasDraftProgress(draft)) {
        if (window.confirm('Resume your unfinished report? Choose Cancel to start a new report.')) {
          nav(resumePath(draft));
          return;
        }
      }
      // The report screens show the beach name from the draft. Without an
      // event there is no name on this screen, so look it up; if that fails
      // the report still starts, the beach is confirmed later in the flow.
      const beachName = event?.beachId === beachId
        ? event.beachName
        : await getBeach(beachId).then((b) => b.name).catch(() => null);
      resetDraft();
      setLastSavedReport(null);
      patchDraft({
        beachId,
        beachName,
        linkedEventId: event && user && event.beachId === beachId && event.joined ? event.id : null,
      });
      nav(user ? '/report/photo' : `/identity?next=${encodeURIComponent('/report/photo')}`);
    };
    return (
      <div className="screen scroll-y">
        <div className="measure i2-page">
          <BackButton onClick={() => nav(event ? `/events/${event.id}` : `/beach/${beachId}`)} />
          <div className="i2-card">
            <div style={{ fontSize: 17, fontWeight: 700, color: C.ink2 }}>Nothing to clean up here yet</div>
            <p style={{ margin: '8px 0 0', fontSize: 12.5, lineHeight: 1.5, color: C.muted }}>
              A cleanup is always linked to a litter report at this beach.
            </p>
            {/* A failed lookup is not the same as "no report": say what went
                wrong instead of telling the volunteer the beach has none. */}
            {targetError
              ? <Alert tone="error" style={{ marginTop: 10 }}>{targetError}</Alert>
              : <p style={{ margin: '4px 0 0', fontSize: 12.5, lineHeight: 1.5, fontWeight: 700, color: C.ink2 }}>No current report — add one first.</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginTop: 14 }}>
              <GhostButton height={50} onClick={() => nav(`/beach/${beachId}`)} style={{ fontSize: 14, padding: '10px 8px' }}>Back to beach</GhostButton>
              <PrimaryButton height={50} onClick={startReport} style={{ fontSize: 14, padding: '10px 8px' }}>Report litter here</PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cleanupTarget = target;
  // A score only means something once every category has a confirmed after
  // band, so the preview and the submit button both wait for the full set.
  const bandsComplete = categories.length > 0 && categories.every((category) => afterBands[category]);
  const previewScore = categories.reduce((sum, category) => {
    const before = cleanupTarget.remainingBands[category];
    const after = afterBands[category];
    if (!before || !after) return sum;
    return sum + Math.max(0, CLEANUP_BAND_UNITS[before] - CLEANUP_BAND_UNITS[after]);
  }, 0);
  const allSmall = categories.length > 0 && categories.every((category) => afterBands[category] === 'Small');

  async function usePhotoSuggestion() {
    if (!photo) {
      inputRef.current?.click();
      return;
    }
    setAnalysing(true);
    setError(null);
    try {
      const suggestion = await analyseCleanupPhoto(photo, cleanupTarget);
      setAfterBands(suggestion);
      setPhotoUsed(true);
      setPhoto(null);
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
        idempotencyKey: idempotencyKey.current,
      });
      nav(`/cleanup/result/${cleanup.id}`, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not record this cleanup.');
    } finally {
      setSubmitting(false);
    }
  }

  function removeEverything() {
    const all: Bands = {};
    categories.forEach((category) => { all[category] = 'Small'; });
    setAfterBands(all);
    idempotencyKey.current = crypto.randomUUID();
    setError(null);
  }

  const photoStatus = photoUsed ? 'AI SUGGESTED' : photo ? 'NOT APPLIED' : null;

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
          setPhoto(file);
          setPhotoUsed(false);
          setError(null);
        }}
      />
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(event ? `/events/${event.id}` : `/beach/${beachId}`)} />
        <div>
          <SectionLabel size="sm">ADD A CLEANUP</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>Confirm cleanup bands</h1>
          <p className="i2-subtitle">Select a lower remaining band only for litter you cleared.</p>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">REPORTED LITTER AT THIS BEACH</SectionLabel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, marginTop: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 720, color: C.ink2 }}>{target.beachName}</div>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>
              {categories.length} {categories.length === 1 ? 'CATEGORY' : 'CATEGORIES'}
            </span>
          </div>
          <div style={{ marginTop: 12, paddingTop: 11, borderTop: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 10, color: C.muted }}>
            CONFIRM BANDS, NOT EXACT COUNTS
          </div>
        </div>

        {/* Cleanup targets are only ever Counted reports: the cleanup-targets
            endpoint filters on that status, so the word here is a fact. */}
        <div className="i2-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <SectionLabel size="sm">CLEANUP TARGET</SectionLabel>
            <InfoChip color={C.green} background={C.greenBg}>Eligible</InfoChip>
          </div>
          <div style={{ marginTop: 10, fontSize: 15, fontWeight: 720, color: C.ink2 }}>{target.reportId} · Counted</div>
          <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>{compositionLine(target.remainingBands)}</div>
          <div style={{ marginTop: 4, fontFamily: MONO, fontSize: 10, color: C.dim }}>REPORTED {formatDate(target.reportedAt).toUpperCase()}</div>
          <p style={{ margin: '12px 0 0', paddingTop: 11, borderTop: `1px solid ${C.line}`, fontSize: 12, lineHeight: 1.5, color: C.slate }}>
            All after-cleanup bands Small: remove this report.
          </p>
        </div>

        {event && (
          <Callout title="Linked activity" tone="quiet">
            {event.beachName} · {formatEventDate(event.date)}. A completed cleanup can satisfy the event evidence requirement after check-in.
          </Callout>
        )}

        <div className="i2-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <SectionLabel size="sm">AFTER PHOTO · OPTIONAL</SectionLabel>
            {photoStatus && (
              <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', color: photoUsed ? C.green : C.dim }}>{photoStatus}</span>
            )}
          </div>
          {photo || photoUsed ? (
            <div
              style={{
                position: 'relative',
                marginTop: 12,
                height: 120,
                borderRadius: 16,
                overflow: 'hidden',
                border: `1px solid ${C.line2}`,
                background: photoPreview ? `center / cover no-repeat url("${photoPreview}")` : C.greenBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ position: 'absolute', top: 10, left: 10, padding: '3px 8px', borderRadius: 8, background: C.green, color: C.white, fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '.08em' }}>AFTER</span>
              {!photo && <span style={{ fontSize: 12, fontWeight: 650, color: C.green }}>Photo processed and discarded</span>}
              <button
                type="button"
                className="press"
                onClick={() => inputRef.current?.click()}
                style={{ position: 'absolute', right: 10, bottom: 10, padding: '5px 10px', borderRadius: 9, background: C.white, color: C.navy, fontSize: 11.5, fontWeight: 700 }}
              >
                Retake
              </button>
            </div>
          ) : (
            <button type="button" className="i2-field press" onClick={() => inputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', marginTop: 12 }}>
              <span style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(11,33,97,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Upload color={C.navy} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: 'block', fontSize: 13 }}>Choose after-cleanup photo</strong>
                <span style={{ display: 'block', marginTop: 2, color: C.dim, fontSize: 10.5 }}>JPG or PNG · optional</span>
              </span>
            </button>
          )}
          {photo && (
            <PrimaryButton onClick={usePhotoSuggestion} disabled={analysing} height={48} style={{ marginTop: 10 }}>
              {analysing ? 'Checking photo…' : <><Camera color={C.lime} size={16} /> Get editable suggestions</>}
            </PrimaryButton>
          )}
          {photoUsed && <Callout title="AI suggestion" tone="reassurance" icon={<Check color={C.green} />} style={{ marginTop: 10 }}>These bands are only a suggestion — edit any row before you confirm.</Callout>}
          <p style={{ margin: '10px 0 0', fontSize: 11.5, lineHeight: 1.5, color: C.dim }}>
            Original report photo = before; after photo is not kept.
          </p>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">AFTER-CLEANUP BANDS</SectionLabel>
          {/* The same everyday wording as the report screen. "Small" on its own
              means something different to every volunteer. */}
          <div style={{ marginTop: 6, fontSize: 10.5, color: C.dim, lineHeight: 1.5 }}>
            {QUANTITY_BANDS.map((band) => `${band} · ${QUANTITY_DESC[band]}`).join('   ')}
          </div>
          <div style={{ marginTop: 8 }}>
            {categories.map((category) => {
              const before = target.remainingBands[category];
              return (
                <label key={category} className="i2-quantity-row" style={{ gridTemplateColumns: 'minmax(0,1fr) 124px' }}>
                  <span>
                    <strong style={{ display: 'block', fontSize: 13.5, color: C.ink2 }}>{category}</strong>
                    <span style={{ display: 'block', marginTop: 3, fontSize: 10.5, color: C.dim }}>Before · {before}</span>
                  </span>
                  <select
                    className="i2-field"
                    aria-label={`${category} remaining band after cleanup`}
                    value={afterBands[category] ?? ''}
                    onChange={(event) => {
                      const band = event.target.value as QuantityBand;
                      setAfterBands((current) => ({ ...current, [category]: band }));
                      idempotencyKey.current = crypto.randomUUID();
                      setError(null);
                    }}
                  >
                    <option value="" disabled>Choose band</option>
                    {/* Remaining litter cannot grow during a cleanup, so a band
                        above "before" is shown but cannot be picked. */}
                    {QUANTITY_BANDS.map((band) => (
                      <option key={band} value={band} disabled={Boolean(before && CLEANUP_BAND_UNITS[band] > CLEANUP_BAND_UNITS[before])}>{band}</option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            className="press"
            onClick={removeEverything}
            style={{ width: '100%', marginTop: 10, padding: '11px 12px', borderRadius: 15, border: `1px solid ${allSmall ? C.green : C.line2}`, background: allSmall ? C.greenBg : C.white, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
          >
            <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 8, border: `1.5px solid ${allSmall ? C.green : C.line2}`, background: allSmall ? C.green : C.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {allSmall && <Check color={C.white} size={13} />}
            </span>
            <span style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', fontSize: 13, color: C.ink2 }}>No remaining litter observed</strong>
              <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, color: C.muted }}>Confirm all categories as Small.</span>
            </span>
          </button>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">HANDLING</SectionLabel>
          <div style={{ marginTop: 10 }}>
            <span style={{ display: 'block', marginBottom: 8, fontSize: 11.5, color: C.muted }}>What happened to the collected litter?</span>
            <div className="i2-chip-row" role="group" aria-label="Handling">
              {HANDLING.map((value) => (
                <button key={value} type="button" className="i2-chip press" aria-pressed={handling === value} onClick={() => setHandling(value)}>
                  {value}
                </button>
              ))}
            </div>
          </div>
          <label style={{ display: 'block', marginTop: 12 }}>
            <span style={{ display: 'block', marginBottom: 6, fontSize: 11.5, color: C.muted }}>Optional note</span>
            <textarea className="i2-field" rows={3} maxLength={240} value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example: bagged and placed at the collection point" />
          </label>
        </div>

        <div className="i2-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
          <div style={{ minWidth: 0 }}>
            <SectionLabel size="sm">CLEANUP SCORE</SectionLabel>
            <p style={{ margin: '6px 0 0', fontSize: 12, lineHeight: 1.5, color: C.muted }}>
              {bandsComplete ? 'Band reduction for this cleanup.' : 'Confirm all bands to calculate.'}
            </p>
          </div>
          <strong aria-live="polite" style={{ fontSize: 40, lineHeight: 1, letterSpacing: '-1.5px', color: bandsComplete ? C.navy : C.faint }}>
            {bandsComplete ? previewScore : '—'}
          </strong>
        </div>

        {error && <Alert title="Cleanup not saved" tone="error">{error}</Alert>}

        <PrimaryButton onClick={submit} disabled={submitting || !bandsComplete}>
          {submitting ? 'Saving cleanup…' : bandsComplete ? 'Confirm cleanup' : 'Finish the bands first'}
        </PrimaryButton>
        <TextButton onClick={() => nav(event ? `/events/${event.id}` : `/beach/${beachId}`)}>Cancel</TextButton>
      </div>
    </div>
  );
}
