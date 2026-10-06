import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Clock, Pin } from '../components/Icon';
import { EmptyState, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton, TextButton } from '../components/ui';
import { useApp } from '../AppContext';
import { createIteration2ShareLink, getBeach, getIteration2MyCleanups, USE_MOCK } from '../api';
import {
  formatEventDate,
  formatEventTimeRange,
  eventCleanups,
  getCleanupEvent,
} from '../iteration2';
import { fetchCleanupEvent, joinCleanupEventData, leaveCleanupEventData } from '../iteration2Api';
import { attentionStateFor, C } from '../theme';
import type { BeachDetail } from '../types';
import { useAsyncData } from '../useAsyncData';
import { CleanupGuide, WildlifeGuide } from '../components/CleanupGuide';
import { fetchEventCleanups } from '../iteration2Api';
import { eventCanCheckIn, eventIsAvailable, eventPhase, useEventClock } from '../eventAvailability';
import { useAppBack } from '../navigation';
import '../styles/community-alignment.css';

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
  const { data: beach, loading: beachLoading, error: beachError, refresh: refreshBeach } = useAsyncData<BeachDetail | null>(
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
  const [sharePath, setSharePath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSharePath(null);
    if (USE_MOCK) return;
    createIteration2ShareLink({ eventId })
      .then((link) => { if (active) setSharePath(link.path); })
      .catch(() => { if (active) setSharePath(null); });
    return () => { active = false; };
  }, [eventId]);

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

  const shareUrl = sharePath ? new URL(sharePath, window.location.origin).toString() : '';
  const shareText = `${event.beachName} cleanup · ${formatEventDate(event.date)}`;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`;

  const participation = [
    { label: 'Join', done: joined },
    { label: 'Check in on the day', done: checkedIn },
    { label: 'Attendance recorded', done: attendanceRecorded },
  ];

  return (
    <div className="screen scroll-y event-alignment" style={{ zIndex: 24 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={goBack} />

        <div className="i2-hero i2-hero-compact">
          <SectionLabel size="sm" tone="dark">COMMUNITY CLEANUP</SectionLabel>
          <h1 style={{ margin: '8px 0 0', fontSize: 25, lineHeight: 1.08, letterSpacing: '-.6px' }}>{event.beachName}</h1>
          <div className="i2-event-meta">
            <span><Clock color={C.lime} />{formatEventDate(event.date)} · {formatEventTimeRange(event.startsAt, event.endsAt)}</span>
            <span><Pin color={C.lime} />{event.area}</span>
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
          <InfoChip color={attendanceRecorded ? C.green : C.muted} background={attendanceRecorded ? C.greenBg : undefined} style={{ marginTop: 12 }}>
            {attendanceRecorded ? 'Attendance recorded' : joined ? 'Attendance not recorded' : 'Not joined'}
          </InfoChip>
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

        <div className="i2-card">
          <SectionLabel size="sm">BEACH CONTEXT</SectionLabel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
            <div>
              <strong style={{ display: 'block', color: C.ink2, fontSize: 14.5 }}>{event.beachName}</strong>
              <span style={{ display: 'block', marginTop: 4, color: C.muted, fontSize: 11.5 }}>{event.area}</span>
            </div>
            <InfoChip>{cleanups.length} {cleanups.length === 1 ? 'cleanup' : 'cleanups'}</InfoChip>
          </div>
          {beachLoading ? <p className="coastal-footnote" role="status">Loading current Beach Attention…</p> : beachError ? (
            <div>
              <p className="coastal-footnote">Current Beach Attention could not be loaded.</p>
              <TextButton onClick={() => void refreshBeach()}>Retry beach data</TextButton>
            </div>
          ) : beach && (
            <p className="coastal-footnote">Current Beach Attention: <strong>{attentionStateFor(beach.severity, beach.insufficientData, beach.validReports).pageLabel}</strong></p>
          )}
          {event.source === 'weekly' && <p className="coastal-footnote">Weekly cleanups are scheduled for Moderate, High or Severe Beach Attention. Low or insufficient data pauses new scheduling; already planned activities and registrations remain.</p>}
          <GhostButton onClick={() => nav(`/beach/${event.beachId}`)} style={{ marginTop: 12 }}>View beach data <ArrowRight color={C.navy} /></GhostButton>
        </div>

        <CleanupGuide recorded={cleanupRecorded} />
        <WildlifeGuide />
        <div className="i2-card">
          <SectionLabel size="sm">SHARE</SectionLabel>
          <a href={shareUrl ? whatsapp : undefined} target="_blank" rel="noreferrer" aria-disabled={!shareUrl} className="btn-primary press event-share-details">Share Event Details</a>
          {USE_MOCK && <p className="coastal-footnote">Public sharing is available when connected to the shared service.</p>}
        </div>

        <GhostButton onClick={() => sharePath && nav(sharePath)} disabled={!sharePath}>Open public sharing page</GhostButton>
        {joined && available && !attendanceRecorded && !cleanupRecorded && <TextButton onClick={leave} disabled={updating}>Leave Event</TextButton>}
      </div>
    </div>
  );
}
