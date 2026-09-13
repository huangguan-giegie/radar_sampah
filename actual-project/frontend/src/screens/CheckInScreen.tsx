import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Check, Pin } from '../components/Icon';
import { Alert, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { useApp } from '../AppContext';
import { formatEventDate, getCleanupEvent, recordCheckIn, type CheckInState } from '../iteration2';
import { USE_MOCK } from '../api';
import { C } from '../theme';
import { safeNextPath } from '../flowRules';

const BEACH_COORDS: Record<string, { lat: number; lng: number }> = {
  morib: { lat: 2.746, lng: 101.443 },
  remis: { lat: 3.218, lng: 101.306 },
  kelanang: { lat: 2.789, lng: 101.402 },
  bagan: { lat: 2.601, lng: 101.689 },
};

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function CheckInScreen() {
  const { eventId = '' } = useParams();
  const [params] = useSearchParams();
  const nextPath = safeNextPath(params.get('next'));
  const hasReturnPath = params.has('next') && nextPath !== '/home';
  const nav = useNavigate();
  const { user, resetDraft, patchDraft, setLastSavedReport } = useApp();
  const [event, setEvent] = useState<Awaited<ReturnType<typeof getCleanupEvent>>>(null);
  const [state, setState] = useState<CheckInState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCleanupEvent(eventId).then((row) => {
      if (!active) return;
      setEvent(row);
      if (row && user) setState(row.checkIns[user.participantId] ?? 'idle');
    });
    return () => { active = false; };
  }, [eventId, user?.participantId]);

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
        const beach = BEACH_COORDS[event.beachId];
        const current = { lat: position.coords.latitude, lng: position.coords.longitude };
        const mockResult: CheckInState = beach && distanceKm(current, beach) <= 25 ? 'within_area' : 'outside_area';
        try {
          if (USE_MOCK) {
            const updated = await recordCheckIn(event.id, user.participantId, mockResult);
            setEvent(updated);
            setState(mockResult);
          } else {
            const updated = await recordCheckIn(event.id, user.participantId, current);
            setEvent(updated);
            setState('within_area');
          }
        } catch (reason) {
          const code = (reason as { code?: string })?.code;
          setState(code === 'LOCATION_OUT_OF_RANGE' ? 'outside_area' : 'denied');
          setMessage(reason instanceof Error ? reason.message : 'Check-in could not be completed.');
        }
      },
      () => {
        setState('denied');
        setMessage('Location was not available. Retry when you are ready.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function reportAtThisEvent() {
    if (!event) return;
    resetDraft();
    setLastSavedReport(null);
    patchDraft({
      beachId: event.beachId,
      beachName: event.beachName,
      locationSource: 'manual',
      eventId: event.id,
    });
    nav('/report/photo');
  }

  if (!event || !user) return null;
  const joined = event.joinedBy.includes(user.participantId);
  const attendanceRecorded = event.attendanceBy.includes(user.participantId);
  const withinArea = state === 'within_area';
  const locationFailed = state === 'denied' || state === 'outside_area';
  const attendanceSteps = [
    ['Joined this event', joined],
    ['Near the beach on the day', withinArea],
    ['Added a photo report or cleanup', attendanceRecorded],
    ['Attendance recorded automatically', attendanceRecorded],
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
        <BackButton onClick={() => nav(hasReturnPath ? nextPath : `/events/${event.id}`)} />
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
            {attendanceRecorded ? 'Recorded attendance' : 'Attendance not recorded'}
          </InfoChip>
        </div>

        {message && <Alert title="Check-in not completed" tone="caution">{message}</Alert>}

        <div className="i2-action-stack">
          {withinArea && !attendanceRecorded ? (
            <>
              <PrimaryButton onClick={() => nav(hasReturnPath ? nextPath : `/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>{hasReturnPath ? 'Continue' : 'Add a Cleanup'}</PrimaryButton>
              <GhostButton onClick={reportAtThisEvent}>Report litter here instead</GhostButton>
            </>
          ) : attendanceRecorded ? (
            <PrimaryButton onClick={() => nav(hasReturnPath ? nextPath : `/events/${event.id}`)}>{hasReturnPath ? 'Continue' : 'Back to event'}</PrimaryButton>
          ) : (
            <>
              <PrimaryButton onClick={checkIn} disabled={state === 'checking'}>{state === 'checking' ? 'Checking…' : state === 'idle' ? 'Check in — use my location' : 'Retry location'}</PrimaryButton>
              {locationFailed && (
                <>
                  <GhostButton onClick={() => nav(hasReturnPath ? nextPath : `/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>{hasReturnPath ? 'Continue' : 'Add a Cleanup'}</GhostButton>
                  <GhostButton onClick={reportAtThisEvent}>Report litter here instead</GhostButton>
                </>
              )}
            </>
          )}
          {!attendanceRecorded && <GhostButton onClick={() => nav(hasReturnPath ? nextPath : `/events/${event.id}`)}>{hasReturnPath ? 'Return to shared link' : 'Back to activity'}</GhostButton>}
        </div>
        <p style={{ margin: 0, textAlign: 'center', color: C.dim, fontSize: 11 }}>Being nearby is not proof of a cleanup.</p>
      </div>
    </div>
  );
}
