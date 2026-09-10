import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, Clock, Pin } from '../components/Icon';
import { Callout, EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import {
  formatEventDate,
  getCleanupEvent,
  joinCleanupEvent,
  leaveCleanupEvent,
} from '../iteration2';
import { C, MONO } from '../theme';

export default function EventScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const { user, showToast } = useApp();
  const [event, setEvent] = useState(() => getCleanupEvent(eventId));
  const [sharing, setSharing] = useState(false);

  if (!event) {
    return (
      <div className="screen scroll-y">
        <div className="measure i2-page">
          <BackButton onClick={() => nav('/community')} />
          <EmptyState title="Activity not found" body="This cleanup date may have changed or is no longer listed." action="View activities" onAction={() => nav('/community')} />
        </div>
      </div>
    );
  }

  const participantId = user?.participantId;
  const joined = Boolean(participantId && event.joinedBy.includes(participantId));
  const checkIn = participantId ? event.checkIns[participantId] : undefined;
  const attendanceRecorded = Boolean(participantId && event.attendanceBy.includes(participantId));

  function join() {
    if (!participantId) {
      nav(`/identity?next=${encodeURIComponent(`/events/${eventId}`)}`);
      return;
    }
    const updated = joinCleanupEvent(eventId, participantId);
    setEvent(updated);
    showToast('Activity joined');
  }

  function leave() {
    if (!participantId) return;
    const updated = leaveCleanupEvent(eventId, participantId);
    setEvent(updated);
    showToast('You left this activity');
  }

  const shareUrl = `${window.location.origin}/share/events/${event.id}`;
  const shareText = `${event.beachName} cleanup · ${formatEventDate(event.date)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied');
    } catch {
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

  return (
    <div className="screen scroll-y" style={{ zIndex: 24 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav('/community')} />

        <div className="i2-hero">
          <SectionLabel size="sm" tone="dark">CLEANUP ACTIVITY · {event.status.toUpperCase()}</SectionLabel>
          <h1 style={{ margin: '9px 0 0', fontSize: 28, lineHeight: 1.08, letterSpacing: '-.7px' }}>{event.beachName}</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 17, color: 'rgba(255,255,255,.82)', fontSize: 12.5 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock color={C.lime} />{formatEventDate(event.date)} · {event.startsAt}–{event.endsAt}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Pin color={C.lime} />{event.area} · broad beach area</span>
          </div>
          <div className="i2-stat-grid" style={{ marginTop: 19 }}>
            <div className="i2-stat"><strong>{event.participantCount}</strong><span>JOINED</span></div>
            <div className="i2-stat"><strong>{event.attendanceBy.length}</strong><span>ATTENDANCE RECORDED</span></div>
            <div className="i2-stat"><strong>{event.cleanupIds.length}</strong><span>CLEANUPS RECORDED</span></div>
          </div>
        </div>

        {joined ? (
          <Callout
            title={attendanceRecorded ? 'Attendance recorded' : checkIn === 'within_area' ? 'Checked in' : 'You joined this activity'}
            tone={attendanceRecorded ? 'reassurance' : 'neutral'}
            icon={<Check color={attendanceRecorded ? C.green : C.navy} />}
          >
            {attendanceRecorded
              ? 'Your broad-area check-in and linked cleanup evidence are complete.'
              : checkIn === 'within_area'
                ? 'Add a report or cleanup for this event to record attendance.'
                : 'Check in at the beach on the activity date. Location is requested only after you choose Check in.'}
          </Callout>
        ) : (
          <Callout title="Public activity" tone="quiet">
            Anyone can view these details. Joining and recording attendance require a participant session.
          </Callout>
        )}

        <div className="i2-card">
          <SectionLabel size="sm">WHAT TO BRING</SectionLabel>
          <div style={{ display: 'grid', gap: 9, marginTop: 12, fontSize: 12.5, lineHeight: 1.45, color: C.slate }}>
            <span>• Reusable gloves and closed shoes</span>
            <span>• Drinking water and sun protection</span>
            <span>• Do not handle sharp or hazardous items</span>
          </div>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">SHARE</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 7, marginTop: 11 }}>
            <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-ghost press" style={{ minHeight: 44, borderRadius: 14, border: `1.5px solid ${C.line2}`, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: C.navy, fontWeight: 650, fontSize: 12 }}>WhatsApp</a>
            <button type="button" className="btn-ghost press" onClick={systemShare} disabled={sharing} style={{ minHeight: 44, borderRadius: 14, border: `1.5px solid ${C.line2}`, color: C.navy, fontWeight: 650, fontSize: 12 }}>{sharing ? 'Opening…' : 'Share…'}</button>
            <button type="button" className="btn-primary press" onClick={copyLink} style={{ minHeight: 44, borderRadius: 14, background: C.navy, color: C.white, fontWeight: 650, fontSize: 12 }}>Copy link</button>
          </div>
          <p style={{ margin: '9px 0 0', color: C.muted, fontSize: 11, lineHeight: 1.5 }}>
            The link opens only this event and its beach report. No friends list, messaging or contact import.
          </p>
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">ATTENDANCE</SectionLabel>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
            Join and Check-in are separate. Attendance is recorded only after a broad-area check and linked report or cleanup evidence for this beach.
          </p>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 11 }}>
            <InfoChip>{joined ? 'Joined' : 'Not joined'}</InfoChip>
            <InfoChip>{checkIn === 'within_area' ? 'Checked in' : 'Not checked in'}</InfoChip>
            <InfoChip color={attendanceRecorded ? C.green : C.muted} background={attendanceRecorded ? C.greenBg : undefined}>
              {attendanceRecorded ? 'Recorded' : 'Not recorded'}
            </InfoChip>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {!joined ? (
            <PrimaryButton onClick={join}>Join Cleanup</PrimaryButton>
          ) : checkIn !== 'within_area' ? (
            <PrimaryButton onClick={() => nav(`/events/${eventId}/check-in`)}>Check in</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => nav(`/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>
              Add cleanup evidence <ChevronRight color={C.lime} />
            </PrimaryButton>
          )}
          {event.cleanupIds.length > 0 && (
            <GhostButton onClick={() => nav(`/events/${event.id}/result`)}>View recorded result</GhostButton>
          )}
          <GhostButton onClick={() => nav(`/share/events/${event.id}`)}>Open public sharing page</GhostButton>
          {joined && !attendanceRecorded && <TextButton onClick={leave}>Leave activity</TextButton>}
        </div>

        <div style={{ fontFamily: MONO, fontSize: 9, lineHeight: 1.55, letterSpacing: '.08em', color: C.faint, textAlign: 'center' }}>
          EXACT GPS IS NEVER PUBLISHED OR RETAINED
        </div>
      </div>
    </div>
  );
}
