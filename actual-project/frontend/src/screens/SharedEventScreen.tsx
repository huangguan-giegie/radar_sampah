import { useNavigate, useParams } from 'react-router-dom';
import { Check, Clock, Pin, Shield } from '../components/Icon';
import { Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { useApp } from '../AppContext';
import { cleanupTotal, eventCleanups, formatEventDate, getCleanupEvent, getCleanupTargetRecord } from '../iteration2';
import { C } from '../theme';

export default function SharedEventScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const { user, showToast } = useApp();
  const event = getCleanupEvent(eventId);
  const target = event ? getCleanupTargetRecord(event.beachId) : null;
  const cleanups = eventCleanups(eventId);

  if (!event) {
    return <div className="screen scroll-y"><div className="measure i2-page"><BackButton onClick={() => nav('/community')} /><EmptyState title="Shared activity not found" body="This link does not expose any other reports or activities." /></div></div>;
  }

  const shareUrl = window.location.href;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied');
    } catch {
      showToast('Could not copy the link');
    }
  }

  return (
    <div className="screen scroll-y" style={{ zIndex: 27 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(`/events/${event.id}`)} />
        <button type="button" onClick={copyLink} className="i2-field press" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', textAlign: 'left' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5 }}>{shareUrl}</span>
          <strong style={{ flex: 'none', color: C.navy, fontSize: 11 }}>Copy</strong>
        </button>
        <Callout title="Sharing is link-only" tone="quiet" icon={<Shield color={C.navy} />}>
          No friends list and no messaging. This page shows only this activity and its selected litter target.
        </Callout>

        {user && <Callout title="Logged in · back on the shared page" tone="reassurance" icon={<Check color={C.green} />}>You can record a cleanup without losing this event link.</Callout>}

        <div className="i2-hero">
          <SectionLabel size="sm" tone="dark">RADAR SAMPAH · SHARED ACTIVITY</SectionLabel>
          <h1 style={{ margin: '9px 0 0', fontSize: 27, letterSpacing: '-.7px' }}>{event.beachName}</h1>
          <div style={{ display: 'grid', gap: 8, marginTop: 16, color: 'rgba(255,255,255,.82)', fontSize: 12.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock color={C.lime} />{formatEventDate(event.date)} · {event.startsAt}–{event.endsAt}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Pin color={C.lime} />{event.area}</span>
          </div>
          <div style={{ display: 'flex', gap: 7, marginTop: 15, flexWrap: 'wrap' }}>
            <InfoChip color={C.white} background="rgba(255,255,255,.12)">{event.participantCount} joined</InfoChip>
            <InfoChip color={C.white} background="rgba(255,255,255,.12)">{event.attendanceBy.length} attendance recorded</InfoChip>
          </div>
        </div>

        {target && (
          <div className="i2-card">
            <SectionLabel size="sm">SELECTED LITTER TARGET</SectionLabel>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
              <div><strong style={{ display: 'block', fontSize: 14 }}>Report {target.reportId}</strong><span style={{ display: 'block', marginTop: 4, fontSize: 11.5, color: C.muted }}>{cleanupTotal(target)} recorded items remain</span></div>
              <InfoChip color={C.green} background={C.greenBg}>Counted</InfoChip>
            </div>
          </div>
        )}

        {cleanups.length > 0 && (
          <Callout title="Cleanup result available" tone="reassurance" icon={<Check color={C.green} />}>
            {cleanups.reduce((sum, cleanup) => sum + cleanup.score, 0)} items were recorded as removed for this event.
          </Callout>
        )}

        {cleanups.length > 0 ? (
          <PrimaryButton onClick={() => nav(`/events/${event.id}/result`)}>View result</PrimaryButton>
        ) : user ? (
          <PrimaryButton onClick={() => nav(`/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Clean up this report</PrimaryButton>
        ) : (
          <>
            <Callout title="Anyone can view this page" tone="quiet">Log in to record a cleanup. No sign-up is needed; your participant ID and token work like a username and password.</Callout>
            <PrimaryButton onClick={() => nav(`/identity?next=${encodeURIComponent(`/share/events/${event.id}`)}`)}>Log in to clean up</PrimaryButton>
          </>
        )}
        <GhostButton onClick={() => nav(`/events/${event.id}`)}>Back to the event page</GhostButton>
      </div>
    </div>
  );
}
