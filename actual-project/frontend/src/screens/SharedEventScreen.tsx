import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Clock, Pin } from '../components/Icon';
import { EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { useApp } from '../AppContext';
import { eventCleanups, formatEventDate, getCleanupEvent, getCleanupTarget } from '../iteration2';
import { fetchCleanupEvent, fetchCleanupTarget, fetchEventCleanups } from '../iteration2Api';
import { C } from '../theme';
import { useAsyncData } from '../useAsyncData';

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
  const { data: cleanups } = useAsyncData(
    () => fetchEventCleanups(eventId),
    [eventId],
    eventCleanups(eventId),
  );
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

        <div className="i2-hero i2-hero-compact">
          <SectionLabel size="sm" tone="dark">SHARED CLEANUP EVENT</SectionLabel>
          <h1 style={{ margin: '8px 0 0', fontSize: 25, letterSpacing: '-.6px' }}>{event.beachName}</h1>
          <div className="i2-event-meta">
            <span><Clock color={C.lime} />{formatEventDate(event.date)} · {event.startsAt}–{event.endsAt}</span>
            <span><Pin color={C.lime} />{event.area}</span>
          </div>
          <div className="i2-stat-grid" style={{ marginTop: 15 }}>
            <div className="i2-stat"><strong>{event.participantCount}</strong><span>PARTICIPANTS</span></div>
            <div className="i2-stat"><strong>{event.attendanceCount}</strong><span>RECORDED</span></div>
            <div className="i2-stat"><strong style={{ fontSize: 15 }}>{event.status}</strong><span>STATUS</span></div>
          </div>
        </div>

        {target && (
          <div className="i2-card">
            <SectionLabel size="sm">REPORT</SectionLabel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginTop: 10 }}>
              <div>
                <strong style={{ display: 'block', color: C.ink2, fontSize: 14.5 }}>Report {target.reportId.toUpperCase()}</strong>
                <span style={{ display: 'block', marginTop: 4, color: C.muted, fontSize: 11.5 }}>Estimated quantity bands recorded</span>
              </div>
              <InfoChip color={C.green} background={C.greenBg}>Counted</InfoChip>
            </div>
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
            <PrimaryButton onClick={() => nav(`/identity?next=${encodeURIComponent(`/share/events/${event.id}`)}`)}>Create or continue profile</PrimaryButton>
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
