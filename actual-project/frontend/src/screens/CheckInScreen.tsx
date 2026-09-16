import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Pin } from '../components/Icon';
import { Alert, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { useApp } from '../AppContext';
import { eventCanRecordAttendance, eventHasEvidence, formatEventDate, getCleanupEvent, getCleanupTarget, type CheckInState } from '../iteration2';
import { confirmAttendanceData, fetchCleanupEvent, fetchCleanupTarget, recordCheckInData } from '../iteration2Api';
import { C } from '../theme';
import { useAsyncData } from '../useAsyncData';

export default function CheckInScreen() {
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
  const initial = user && event ? event.checkIns[user.participantId] ?? 'idle' : 'idle';
  const [state, setState] = useState<CheckInState>(initial);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user && event) setState(event.checkIns[user.participantId] ?? 'idle');
  }, [event, user]);

  function checkIn() {
    if (!event || !user) return;
    if (!event.joinedBy.includes(user.participantId)) {
      setMessage('Join this activity before checking in.');
      return;
    }
    if (!navigator.geolocation) {
      setState('denied');
      setMessage('Location is not available on this device. Attendance remains Not recorded.');
      return;
    }
    setState('checking');
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const current = { lat: position.coords.latitude, lng: position.coords.longitude };
        try {
          const updated = await recordCheckInData(event.id, user.participantId, current);
          setEvent(updated);
          setState(updated.checkIns[user.participantId] ?? 'within_area');
        } catch (reason) {
          setState('denied');
          setMessage(reason instanceof Error ? reason.message : 'Check-in could not be recorded.');
        }
      },
      () => {
        setState('denied');
        setMessage('Location was not available. Retry when you are ready.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  if (loading && !event) return <div className="screen scroll-y"><div className="measure i2-page"><Alert title="Loading check-in" tone="caution">Checking the latest activity state.</Alert></div></div>;
  if (!event || !user) return <div className="screen scroll-y"><div className="measure i2-page"><Alert title="Check-in unavailable" tone="caution">{error ?? 'This activity could not be found.'}</Alert></div></div>;
  const joined = event.joinedBy.includes(user.participantId);
  const attendanceRecorded = event.attendanceBy.includes(user.participantId);
  const withinArea = state === 'within_area';
  const hasEvidence = eventHasEvidence(event, user.participantId);
  const canConfirmAttendance = eventCanRecordAttendance(event, user.participantId);
  const locationFailed = state === 'denied' || state === 'outside_area';
  const attendanceSteps = [
    ['Joined this event', joined],
    ['Near the beach on the day', withinArea],
    ['Added a report or cleanup for this event', hasEvidence],
    ['Confirmed attendance', attendanceRecorded],
  ] as const;

  const statusTitle = state === 'checking'
    ? 'Checking the beach area…'
    : withinArea
      ? 'Checked in'
      : state === 'outside_area'
        ? 'Outside the beach area'
        : state === 'denied'
          ? 'Location not available'
          : 'Check in on the event day';

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(`/events/${event.id}`)} />
        <div>
          <SectionLabel size="sm">CHECK IN</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>Check in</h1>
        </div>

        <div className="i2-card i2-event-strip">
          <div>
            <strong>{event.beachName} cleanup</strong>
            <span>{formatEventDate(event.date)} · {event.startsAt}–{event.endsAt}</span>
          </div>
          <InfoChip color={joined ? C.green : C.muted} background={joined ? C.greenBg : undefined}>{joined ? 'Joined' : 'Not joined'}</InfoChip>
        </div>

        <div className={`i2-checkin-status${withinArea ? ' is-success' : ''}`}>
          <span className="i2-checkin-icon">
            {withinArea ? <Check size={22} color={C.navy} /> : <Pin size={22} color={C.navy} />}
          </span>
          <div>
            <strong>{statusTitle}</strong>
            <span>{withinArea ? `Near ${event.beachName} · exact location not kept` : 'Only a broad beach-area result is kept.'}</span>
          </div>
        </div>

        {attendanceRecorded && (
          <div className="i2-confirmed-row"><Check size={15} color={C.green} /><strong>Attendance confirmed</strong></div>
        )}

        <div className="i2-privacy-note">
          Exact coordinates are checked only after you tap Check in, then discarded.
        </div>

        <div className="i2-card">
          <SectionLabel size="sm">RECORDED ATTENDANCE NEEDS</SectionLabel>
          <div className="i2-step-list">
            {attendanceSteps.map(([label, done]) => (
              <div className="i2-step" key={label}>
                <span className="i2-step-index" data-done={done}>{done ? <Check size={13} /> : '○'}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <InfoChip color={attendanceRecorded ? C.green : C.muted} background={attendanceRecorded ? C.greenBg : undefined} style={{ marginTop: 12 }}>
            {attendanceRecorded ? 'Recorded attendance' : 'Attendance not recorded yet'}
          </InfoChip>
        </div>

        {message && <Alert title="Check-in not completed" tone="caution">{message}</Alert>}

        <div className="i2-action-stack">
          {withinArea && !attendanceRecorded && canConfirmAttendance ? (
            <>
              <PrimaryButton onClick={async () => {
                try {
                  setEvent(await confirmAttendanceData(event.id, user.participantId));
                  showToast('Attendance recorded');
                  nav(`/events/${event.id}`);
                } catch (reason) {
                  setMessage(reason instanceof Error ? reason.message : 'Attendance could not be confirmed.');
                }
              }}>Confirm attendance</PrimaryButton>
              <GhostButton onClick={() => nav(`/events/${event.id}`)}>Back to activity</GhostButton>
            </>
          ) : withinArea && !attendanceRecorded ? (
            <>
              {cleanupTarget ? (
                <PrimaryButton onClick={() => nav(`/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Add a Cleanup</PrimaryButton>
              ) : (
                <PrimaryButton onClick={() => nav(`/beach/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Report litter here</PrimaryButton>
              )}
              {cleanupTarget && <GhostButton onClick={() => nav(`/beach/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Report litter here instead</GhostButton>}
            </>
          ) : attendanceRecorded ? (
            <PrimaryButton onClick={() => nav(`/events/${event.id}`)}>Back to event</PrimaryButton>
          ) : (
            <>
              <PrimaryButton onClick={checkIn} disabled={state === 'checking'}>{state === 'checking' ? 'Checking…' : state === 'idle' ? 'Check in — use my location' : 'Retry location'}</PrimaryButton>
              {locationFailed && (
                <>
                  {cleanupTarget && <GhostButton onClick={() => nav(`/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Add a Cleanup</GhostButton>}
                  <GhostButton onClick={() => nav(`/beach/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Report litter here instead</GhostButton>
                </>
              )}
            </>
          )}
          {!attendanceRecorded && <GhostButton onClick={() => nav(`/events/${event.id}`)}>Back to activity</GhostButton>}
        </div>
        <p style={{ margin: 0, textAlign: 'center', color: C.dim, fontSize: 11 }}>Being nearby is not proof of a cleanup.</p>
      </div>
    </div>
  );
}
