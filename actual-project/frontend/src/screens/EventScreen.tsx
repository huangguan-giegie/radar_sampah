import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronRight, Clock, Pin } from '../components/Icon';
import { EmptyState, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import { getBeach, getIteration2MyCleanups, USE_MOCK } from '../api';
import { eventInvitationPath, eventInvitationText } from '../eventInvitation';
import {
  formatEventDate,
  formatEventTimeRange,
  eventCleanups,
  getCleanupEvent,
} from '../iteration2';
import { fetchCleanupEvent, joinCleanupEventData, leaveCleanupEventData } from '../iteration2Api';
import { C } from '../theme';
import type { BeachDetail } from '../types';
import { useAsyncData } from '../useAsyncData';
import { CleanupGuide, WildlifeGuide } from '../components/CleanupGuide';
import { fetchEventCleanups } from '../iteration2Api';
import { eventCanCheckIn, eventIsAvailable, eventPhase, useEventClock } from '../eventAvailability';
import { useAppBack } from '../navigation';
import '../styles/community-alignment.css';
import { StaticMap } from '../components/Visuals';
import { beachPhoto } from '../visuals';

export default function EventScreen() {
  const { eventId = '' } = useParams();
  const nav = useNavigate();
  const goBack = useAppBack('/community');
  const now = useEventClock();
  const active = useRef(true);
  const [updating, setUpdating] = useState(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, [eventId]);
  const { user, showToast, reportsVersion } = useApp();
  const { data: event, setData: setEvent, loading, error } = useAsyncData(
    () => fetchCleanupEvent(eventId),
    [eventId, user?.participantId],
    getCleanupEvent(eventId),
  );
  const { data: cleanups } = useAsyncData(() => fetchEventCleanups(eventId), [eventId, reportsVersion], []);
  const { data: beach } = useAsyncData<BeachDetail | null>(
    () => event ? getBeach(event.beachId) : Promise.resolve(null),
    [event?.beachId, reportsVersion], null,
  );
  const { data: ownCleanups } = useAsyncData<{ eventId: string | null }[]>(
    () => !user ? Promise.resolve([]) : USE_MOCK
      ? Promise.resolve(eventCleanups(eventId).filter(cleanup => cleanup.participantId === user.participantId))
      : getIteration2MyCleanups(),
    [eventId, user?.participantId, reportsVersion], [],
  );
  const cleanupRecorded = Boolean(user && ownCleanups.some(cleanup => cleanup.eventId === eventId));

  if (loading && !event) {
    return <div className="screen scroll-y"><div className="measure i2-page"><BackButton onClick={goBack} /><EmptyState title="Loading activity…" body="Checking the latest shared activity details." /></div></div>;
  }

  if (!event) {
    return (
      <div className="screen scroll-y">
        <div className="measure i2-page">
          <BackButton onClick={goBack} />
          <EmptyState title="Activity not found" body={error ?? 'This cleanup date may have changed or is no longer listed.'} action="View activities" onAction={() => nav('/community')} />
        </div>
      </div>
    );
  }

  const participantId = user?.participantId;
  const joined = Boolean(participantId && event.joined);
  const checkedIn = Boolean(participantId && event.checkedIn);
  const attendanceRecorded = Boolean(participantId && event.attendanceConfirmed);
  const phase = eventPhase(event, now);
  const available = eventIsAvailable(event, now);
  const status = phase === 'ended' ? 'Ended' : event.status === 'Closed' ? 'Closed' : phase === 'unavailable' ? 'Unavailable' : phase === 'ongoing' ? 'In progress' : 'Open';

  async function join() {
    if (!event || updating || !eventIsAvailable(event)) return;
    if (!participantId) {
      nav(`/identity?next=${encodeURIComponent(`/events/${eventId}`)}`);
      return;
    }
    setUpdating(true);
    try {
      const updated = await joinCleanupEventData(eventId, participantId);
      if (!active.current) return;
      setEvent(updated);
      showToast('Activity joined');
    } catch (reason) {
      if (active.current) showToast(reason instanceof Error ? reason.message : 'Could not join this activity');
    } finally {
      if (active.current) setUpdating(false);
    }
  }

  async function leave() {
    if (!participantId || updating) return;
    setUpdating(true);
    try {
      const updated = await leaveCleanupEventData(eventId, participantId);
      if (!active.current) return;
      setEvent(updated);
      showToast('You left this activity');
    } catch (reason) {
      if (active.current) showToast(reason instanceof Error ? reason.message : 'Could not leave this activity');
    } finally {
      if (active.current) setUpdating(false);
    }
  }

  const shareUrl = new URL(eventInvitationPath(event.id), typeof window === 'undefined' ? 'http://localhost' : window.location.origin).toString();
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(eventInvitationText(event, shareUrl))}`;

  const participation = [
    { label: 'Join', done: joined },
    { label: 'Check in on the day', done: checkedIn },
    { label: 'Attendance recorded', done: attendanceRecorded },
  ];

  const heroPhoto = beachPhoto(event.beachId, beach?.coverImageUrl);
  const heroMap: [number, number] | null = beach?.lat != null && beach?.lng != null ? [beach.lat, beach.lng] : null;

  return (
    <div className="screen scroll-y event-alignment" style={{ zIndex: 24 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={goBack} />

        <div className={'i2-hero i2-hero-compact' + (heroPhoto || heroMap ? ' has-media' : '')}>
          {heroPhoto ? <div className="hero-media"><img src={heroPhoto} alt={event.beachName} /></div>
            : heroMap && <div className="hero-media"><StaticMap lat={heroMap[0]} lng={heroMap[1]} zoom={12} focus={[0.74, 0.17]} reach={[520, 460]} /></div>}
          {!heroPhoto && heroMap && <span className="hero-media-credit">Location map © OpenStreetMap</span>}
          <SectionLabel size="sm" tone="dark">COMMUNITY CLEANUP</SectionLabel>
          <h1 style={{ margin: '8px 0 0', fontSize: 25, lineHeight: 1.08, letterSpacing: '-.6px' }}>{event.beachName}</h1>
          <div className="i2-event-meta">
            <span><Clock color={C.lime} />{formatEventDate(event.date)} · {formatEventTimeRange(event.startsAt, event.endsAt)}</span>
            <span><Pin color={C.lime} />{event.area}</span>
          </div>
          <div style={{ marginTop: 10, color: C.bg, fontSize: 12.5, lineHeight: 1.45 }}>
            <strong>Meeting point:</strong> {event.meetingPoint || 'To be confirmed by the organiser.'}
            {event.meetingPoint && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.meetingPoint}, ${event.area}`)}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'inline-block', marginLeft: 10, color: C.lime, fontWeight: 700 }}
              >
                Get directions ↗
              </a>
            )}
          </div>
          <div className="i2-stat-grid" style={{ marginTop: 15 }}>
            <div className="i2-stat"><span>Participants</span><strong>{event.participantCount}</strong></div>
            <div className="i2-stat"><span>Recorded Attendance</span><strong>{event.attendanceCount}</strong></div>
            <div className="i2-stat event-status-tile"><span>Status</span><strong style={{ fontSize: 20 }}>{status}</strong></div>
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
        </div>

        <div className="i2-action-stack">
          {cleanupRecorded ? (
            <PrimaryButton onClick={() => nav(`/events/${eventId}/result`)}>View Event Result <ChevronRight color={C.lime} /></PrimaryButton>
          ) : !available && !checkedIn ? (
            <PrimaryButton disabled>{status === 'Ended' ? 'Event Ended' : 'Event Unavailable'}</PrimaryButton>
          ) : !joined ? (
            <PrimaryButton onClick={join} disabled={updating}>{updating ? 'Joining…' : 'Join This Cleanup'}</PrimaryButton>
          ) : !checkedIn ? (
            <PrimaryButton disabled={!eventCanCheckIn(event, now)} onClick={() => eventCanCheckIn(event) && nav(`/events/${eventId}/check-in`)}>{eventCanCheckIn(event, now) ? 'Check in' : 'Check-in opens when the event starts'}</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => nav(`/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>
              Record Your Cleanup Result <ChevronRight color={C.lime} />
            </PrimaryButton>
          )}
          {!cleanupRecorded && cleanups.length > 0 && (
            <GhostButton onClick={() => nav(`/events/${event.id}/result`)}>View recorded result</GhostButton>
          )}
        </div>

        <CleanupGuide recorded={cleanupRecorded} />
        <WildlifeGuide />
        <div className="i2-card">
          <SectionLabel size="sm">INVITE OTHERS</SectionLabel>
          <p className="subtle">Share the date, time and a link to this activity.</p>
          <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-primary press event-share-details">Share Event Invitation</a>
        </div>

        {joined && available && !attendanceRecorded && !cleanupRecorded && <TextButton onClick={leave} disabled={updating}>Leave Event</TextButton>}
      </div>
    </div>
  );
}
