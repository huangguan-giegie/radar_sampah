import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, Clock, Pin } from '../components/Icon';
import { EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import {
  formatEventDate,
  createSharePath,
  getCleanupEvent,
  joinCleanupEvent,
  leaveCleanupEvent,
} from '../iteration2';
import { C } from '../theme';

export default function EventScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const { user, showToast } = useApp();
  const [event, setEvent] = useState<Awaited<ReturnType<typeof getCleanupEvent>>>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharePath, setSharePath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCleanupEvent(eventId).then((row) => { if (active) setEvent(row); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId]);

  useEffect(() => {
    let active = true;
    setSharePath(null);
    createSharePath({ eventId })
      .then((path) => { if (active) setSharePath(path); })
      .catch(() => { if (active) setSharePath(null); });
    return () => { active = false; };
  }, [eventId]);

  if (!event) {
    return (
      <div className="screen scroll-y">
        <div className="measure i2-page">
          <BackButton onClick={() => nav('/community')} />
          <EmptyState title={loading ? 'Loading activity' : 'Activity not found'} body={loading ? 'Fetching the latest activity details.' : 'This cleanup date may have changed or is no longer listed.'} action={loading ? undefined : 'View activities'} onAction={loading ? undefined : () => nav('/community')} />
        </div>
      </div>
    );
  }

  const participantId = user?.participantId;
  const joined = Boolean(participantId && event.joinedBy.includes(participantId));
  const checkIn = participantId ? event.checkIns[participantId] : undefined;
  const checkedIn = checkIn === 'within_area';
  const attendanceRecorded = Boolean(participantId && event.attendanceBy.includes(participantId));

  async function join() {
    if (!participantId) {
      nav(`/identity?next=${encodeURIComponent(`/events/${eventId}`)}`);
      return;
    }
    try {
      const updated = await joinCleanupEvent(eventId, participantId);
      setEvent(updated);
      showToast('Activity joined');
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Could not join this activity.');
    }
  }

  async function leave() {
    if (!participantId) return;
    try {
      const updated = await leaveCleanupEvent(eventId, participantId);
      setEvent(updated);
      showToast('You left this activity');
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Could not leave this activity.');
    }
  }

  const shareUrl = sharePath ? `${window.location.origin}${sharePath}` : '';
  const shareText = `${event.beachName} cleanup · ${formatEventDate(event.date)}`;
  const whatsapp = shareUrl ? `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}` : '';

  async function copyLink() {
    if (!shareUrl) {
      showToast('Secure share link is still loading');
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast('Link copied');
    } catch {
      setCopied(false);
      showToast('Could not copy the link');
    }
  }

  async function systemShare() {
    if (!shareUrl) {
      showToast('Secure share link is still loading');
      return;
    }
    if (!navigator.share) {
      await copyLink();
      return;
    }
    setSharing(true);
    try {
      await navigator.share({ title: 'Radar Sampah cleanup', text: shareText, url: shareUrl });
    } catch {
      // Closing the native share sheet needs no recovery message.
    } finally {
      setSharing(false);
    }
  }

  function shareOnWhatsApp() {
    if (whatsapp) window.open(whatsapp, '_blank', 'noopener,noreferrer');
  }

  const participation = [
    { label: 'Join', done: joined },
    { label: 'Check in on the day', done: checkedIn },
    { label: 'Add a report or cleanup', done: attendanceRecorded },
    { label: 'Attendance recorded automatically', done: attendanceRecorded },
  ];

  return (
    <div className="screen scroll-y" style={{ zIndex: 24 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav('/community')} />

        <div className="i2-hero i2-hero-compact">
          <SectionLabel size="sm" tone="dark">COMMUNITY CLEANUP</SectionLabel>
          <h1 style={{ margin: '8px 0 0', fontSize: 25, lineHeight: 1.08, letterSpacing: '-.6px' }}>{event.beachName}</h1>
          <div className="i2-event-meta">
            <span><Clock color={C.lime} />{formatEventDate(event.date)} · {event.startsAt}–{event.endsAt}</span>
            <span><Pin color={C.lime} />{event.area}</span>
          </div>
          <div className="i2-stat-grid" style={{ marginTop: 15 }}>
            <div className="i2-stat"><strong>{event.participantCount}</strong><span>PARTICIPANTS</span></div>
            <div className="i2-stat"><strong>{event.attendanceBy.length}</strong><span>RECORDED</span></div>
            <div className="i2-stat"><strong style={{ fontSize: 15 }}>{event.status}</strong><span>STATUS</span></div>
          </div>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">YOUR PARTICIPATION</SectionLabel>
          <div className="i2-step-list">
            {participation.map((step, index) => (
              <div className="i2-step" key={step.label}>
                <span className="i2-step-index" data-done={step.done}>{step.done ? <Check size={13} /> : index + 1}</span>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
          <InfoChip color={attendanceRecorded ? C.green : C.muted} background={attendanceRecorded ? C.greenBg : undefined} style={{ marginTop: 12 }}>
            {attendanceRecorded ? 'Attendance recorded' : joined ? 'Attendance not recorded' : 'Not joined'}
          </InfoChip>
        </div>

        <div className="i2-action-stack">
          {!joined ? (
            <PrimaryButton onClick={join}>Join Cleanup</PrimaryButton>
          ) : !checkedIn ? (
            <PrimaryButton onClick={() => nav(`/events/${eventId}/check-in`)}>Check in</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => nav(`/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>
              Add a Cleanup <ChevronRight color={C.lime} />
            </PrimaryButton>
          )}
          {event.cleanupIds.length > 0 && (
            <GhostButton onClick={() => nav(`/events/${event.id}/result`)}>View recorded result</GhostButton>
          )}
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">BEACH CONTEXT</SectionLabel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
            <div>
              <strong style={{ display: 'block', color: C.ink2, fontSize: 14.5 }}>{event.beachName}</strong>
              <span style={{ display: 'block', marginTop: 4, color: C.muted, fontSize: 11.5 }}>{event.area}</span>
            </div>
            <InfoChip>{event.cleanupIds.length} cleanups</InfoChip>
          </div>
          <GhostButton onClick={() => nav(`/beach/${event.beachId}`)} style={{ marginTop: 12 }}>View beach</GhostButton>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">SHARE</SectionLabel>
          <div className="i2-share-grid">
            <button type="button" className="btn-ghost press i2-share-button" onClick={shareOnWhatsApp} disabled={!sharePath}>WhatsApp</button>
            <button type="button" className="btn-ghost press i2-share-button" onClick={systemShare} disabled={sharing || !sharePath}>{sharing ? 'Opening…' : 'Share…'}</button>
            <button type="button" className={`btn-primary press i2-share-button${copied ? ' i2-copy-success' : ''}`} onClick={copyLink} disabled={!sharePath}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
          {!sharePath && <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 11 }}>Preparing a secure event link…</p>}
        </div>

        <GhostButton onClick={() => { if (sharePath) nav(sharePath); }} disabled={!sharePath}>Open public sharing page</GhostButton>
        {joined && !attendanceRecorded && <TextButton onClick={leave}>Leave activity</TextButton>}
      </div>
    </div>
  );
}
