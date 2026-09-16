import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, Clock, Pin } from '../components/Icon';
import { EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import {
  formatEventDate,
  getCleanupTarget,
  getCleanupEvent,
  eventCanRecordAttendance,
  eventHasEvidence,
} from '../iteration2';
import { confirmAttendanceData, fetchCleanupEvent, fetchCleanupTarget, joinCleanupEventData, leaveCleanupEventData } from '../iteration2Api';
import { C } from '../theme';
import { useAsyncData } from '../useAsyncData';

export default function EventScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const { user, showToast } = useApp();
  const { data: event, setData: setEvent, loading, error } = useAsyncData(
    () => fetchCleanupEvent(eventId),
    [eventId, user?.participantId],
    getCleanupEvent(eventId),
  );
  const { data: cleanupTarget } = useAsyncData(
    () => event ? fetchCleanupTarget(event.beachId) : Promise.resolve(null),
    [event?.beachId],
    event ? getCleanupTarget(event.beachId) : null,
  );
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (loading && !event) {
    return <div className="screen scroll-y"><div className="measure i2-page"><EmptyState title="Loading activity…" body="Checking the latest shared activity details." /></div></div>;
  }

  if (!event) {
    return (
      <div className="screen scroll-y">
        <div className="measure i2-page">
          <BackButton onClick={() => nav('/community')} />
          <EmptyState title="Activity not found" body={error ?? 'This cleanup date may have changed or is no longer listed.'} action="View activities" onAction={() => nav('/community')} />
        </div>
      </div>
    );
  }

  const participantId = user?.participantId;
  const joined = Boolean(participantId && event.joinedBy.includes(participantId));
  const checkIn = participantId ? event.checkIns[participantId] : undefined;
  const checkedIn = checkIn === 'within_area';
  const attendanceRecorded = Boolean(participantId && event.attendanceBy.includes(participantId));
  const hasEvidence = Boolean(participantId && eventHasEvidence(event, participantId));
  const canConfirmAttendance = Boolean(participantId && eventCanRecordAttendance(event, participantId));

  async function join() {
    if (!participantId) {
      nav(`/identity?next=${encodeURIComponent(`/events/${eventId}`)}`);
      return;
    }
    try {
      const updated = await joinCleanupEventData(eventId, participantId);
      setEvent(updated);
      showToast('Activity joined');
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Could not join this activity');
    }
  }

  async function leave() {
    if (!participantId) return;
    try {
      const updated = await leaveCleanupEventData(eventId, participantId);
      setEvent(updated);
      showToast('You left this activity');
    } catch (reason) {
      showToast(reason instanceof Error ? reason.message : 'Could not leave this activity');
    }
  }

  const shareUrl = `${window.location.origin}/share/events/${event.id}`;
  const shareText = `${event.beachName} cleanup · ${formatEventDate(event.date)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;

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

  async function systemShare() {
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

  const participation = [
    { label: 'Join', done: joined },
    { label: 'Check in on the day', done: checkedIn },
    { label: 'Add a report or cleanup', done: hasEvidence },
    { label: 'Confirm attendance', done: attendanceRecorded },
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
            <div className="i2-stat"><strong>{event.attendanceCount}</strong><span>RECORDED</span></div>
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
          ) : canConfirmAttendance ? (
            <PrimaryButton onClick={async () => {
              try {
                setEvent(await confirmAttendanceData(eventId, participantId!));
                showToast('Attendance recorded');
              } catch (reason) {
                showToast(reason instanceof Error ? reason.message : 'Could not confirm attendance');
              }
            }}>
              Confirm attendance <ChevronRight color={C.lime} />
            </PrimaryButton>
          ) : cleanupTarget ? (
            <PrimaryButton onClick={() => nav(`/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>
              Add a Cleanup <ChevronRight color={C.lime} />
            </PrimaryButton>
          ) : (
              <PrimaryButton onClick={() => nav(`/beach/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Report litter here <ChevronRight color={C.lime} /></PrimaryButton>
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
            <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-ghost press i2-share-button">WhatsApp</a>
            <button type="button" className="btn-ghost press i2-share-button" onClick={systemShare} disabled={sharing}>{sharing ? 'Opening…' : 'Share…'}</button>
            <button type="button" className={`btn-primary press i2-share-button${copied ? ' i2-copy-success' : ''}`} onClick={copyLink}>
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>

        <GhostButton onClick={() => nav(`/share/events/${event.id}`)}>Open public sharing page</GhostButton>
        {joined && !attendanceRecorded && <TextButton onClick={leave}>Leave activity</TextButton>}
      </div>
    </div>
  );
}
