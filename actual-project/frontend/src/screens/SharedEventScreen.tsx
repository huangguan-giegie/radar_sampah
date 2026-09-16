import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Clock, Pin, RadarMark } from '../components/Icon';
import { EmptyState, SectionLabel, StatusBadge } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { useApp } from '../AppContext';
import { eventCleanups, formatEventDate, formatEventTimeRange, getCleanupEvent, getCleanupTarget, quantityBandValue, type CleanupTarget } from '../iteration2';
import { fetchCleanupEvent, fetchCleanupTarget, fetchEventCleanups } from '../iteration2Api';
import { C, formatDate, MONO } from '../theme';
import type { LitterCategory, QuantityBand } from '../types';
import { useAsyncData } from '../useAsyncData';

/** "Plastic · Very Large · Fishing gear · Very Large · +4 categories". The two
 *  biggest bands lead, because they are what a recipient deciding whether to
 *  come and help needs to see; the rest are counted, not listed, so the card
 *  stays one line on a phone. */
function bandSummary(target: CleanupTarget): string | null {
  const entries = (Object.entries(target.remainingBands) as [LitterCategory, QuantityBand | undefined][])
    .filter((entry): entry is [LitterCategory, QuantityBand] => Boolean(entry[1]))
    .sort((a, b) => quantityBandValue(b[1]) - quantityBandValue(a[1]));
  if (entries.length === 0) return null;
  const shown = entries.slice(0, 2).map(([category, band]) => `${category} · ${band}`);
  const rest = entries.length - shown.length;
  return rest > 0 ? `${shown.join(' · ')} · +${rest} ${rest === 1 ? 'category' : 'categories'}` : shown.join(' · ');
}

export default function SharedEventScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { user, showToast } = useApp();
  const [copied, setCopied] = useState(() => params.get('copied') === '1');
  const { data: event, loading, error } = useAsyncData(
    () => fetchCleanupEvent(eventId),
    [eventId, user?.participantId],
    getCleanupEvent(eventId),
  );
  const { data: cleanupTarget } = useAsyncData(
    () => event ? fetchCleanupTarget(event.beachId) : Promise.resolve(null),
    [event?.beachId],
    event ? getCleanupTarget(event.beachId) : null,
  );
  const { data: cleanupData } = useAsyncData(
    () => fetchEventCleanups(eventId),
    [eventId],
    eventCleanups(eventId),
  );
  // The real API starts empty (null) until the list arrives.
  const cleanups = cleanupData ?? [];
  const target = cleanupTarget;

  if (loading && !event) {
    return <div className="screen scroll-y"><div className="measure i2-page"><EmptyState title="Loading shared activity…" body="Checking the latest public activity details." /></div></div>;
  }

  if (!event) {
    return <div className="screen scroll-y"><div className="measure i2-page"><BackButton onClick={() => nav('/community')} /><EmptyState title="Shared activity not found" body={error ?? 'This link does not expose any other reports or activities.'} /></div></div>;
  }

  const shareUrl = `${window.location.origin}/share/events/${event.id}`;
  const joined = Boolean(user && event.joinedBy.includes(user.participantId));

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast('Link copied');
    } catch {
      setCopied(false);
      showToast('Could not copy the link');
    }
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 27 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(`/events/${event.id}`)} />

        <button type="button" onClick={copyLink} className={`i2-link-field press${copied ? ' is-copied' : ''}`}>
          <span>{shareUrl}</span>
          <strong>{copied ? 'Copied' : 'Copy'}</strong>
        </button>

        {copied && (
          <div className="i2-confirmed-row"><Check size={15} color={C.green} /><strong>Link copied</strong></div>
        )}

        {/* Whose page this is, and how the viewer is seeing it. A recipient
            opening a forwarded link lands here with no app chrome around it,
            so the brand row answers "what is this?" before the event does. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: 13, background: C.navy, display: 'grid', placeItems: 'center' }}>
              <RadarMark size={18} />
            </span>
            <strong style={{ color: C.ink2, fontSize: 14.5 }}>Radar Sampah</strong>
          </span>
          <span style={{ padding: '4px 9px', borderRadius: 999, background: C.tint, color: C.dim, fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '.12em' }}>
            {joined ? 'JOINED' : 'PUBLIC VIEW'}
          </span>
        </div>

        <div className="i2-hero i2-hero-compact">
          <SectionLabel size="sm" tone="dark">SHARED CLEANUP EVENT</SectionLabel>
          <h1 style={{ margin: '8px 0 0', fontSize: 25, letterSpacing: '-.6px' }}>{event.beachName}</h1>
          <div className="i2-event-meta">
            <span><Clock color={C.lime} />{formatEventDate(event.date)} · {formatEventTimeRange(event.startsAt, event.endsAt)}</span>
            <span><Pin color={C.lime} />{event.area}</span>
          </div>
          <div className="i2-stat-grid" style={{ marginTop: 15 }}>
            <div className="i2-stat"><strong>{event.participantCount}</strong><span>PARTICIPANTS</span></div>
            <div className="i2-stat"><strong>{event.attendanceCount}</strong><span>RECORDED ATTENDANCE</span></div>
            <div className="i2-stat"><strong style={{ fontSize: 15 }}>{event.status}</strong><span>STATUS</span></div>
          </div>
        </div>

        {target && (
          <div className="i2-card">
            <SectionLabel size="sm">REPORT</SectionLabel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 10 }}>
              <strong style={{ minWidth: 0, overflowWrap: 'anywhere', color: C.navy, fontFamily: MONO, fontSize: 13 }}>{target.reportId.toUpperCase()}</strong>
              {/* Only counted reports become cleanup targets, so this is a fact
                  about the record, not a guess. */}
              <StatusBadge status="counted">Counted</StatusBadge>
            </div>
            {/* The report's current bands. The volunteer number from the
                prototype is not part of the cleanup-target data yet, so the
                provenance line gives the date only. */}
            <span style={{ display: 'block', marginTop: 10, color: C.ink2, fontSize: 13, lineHeight: 1.45 }}>
              {bandSummary(target) ?? 'Estimated quantity bands recorded'}
            </span>
            <span style={{ display: 'block', marginTop: 5, color: C.dim, fontSize: 11.5 }}>
              Reported {formatDate(target.reportedAt) === 'Today' ? 'today' : formatDate(target.reportedAt)}
            </span>
          </div>
        )}

        {cleanups.length > 0 && (
          <div className="i2-confirmed-row">
            <Check size={15} color={C.green} />
            <strong>{cleanups.reduce((sum, cleanup) => sum + cleanup.score, 0)} confirmed band changes</strong>
          </div>
        )}

        <div className="i2-action-stack">
          {cleanups.length > 0 ? (
            <PrimaryButton onClick={() => nav(`/events/${event.id}/result`)}>View cleanup result</PrimaryButton>
          ) : !user ? (
            <PrimaryButton onClick={() => nav(`/identity?next=${encodeURIComponent(`/share/events/${event.id}`)}`)} trailingArrow>Join to clean up</PrimaryButton>
          ) : !joined ? (
            <PrimaryButton onClick={() => nav(`/events/${event.id}`)}>Open activity to join</PrimaryButton>
          ) : cleanupTarget ? (
            <PrimaryButton onClick={() => nav(`/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Clean up this report</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => nav(`/beach/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Report litter here</PrimaryButton>
          )}
          <GhostButton onClick={() => nav(`/events/${event.id}`)}>Back to the event page</GhostButton>
        </div>
      </div>
    </div>
  );
}
