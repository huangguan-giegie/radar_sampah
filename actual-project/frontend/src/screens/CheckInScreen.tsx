import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Pin, Shield } from '../components/Icon';
import { Alert, Callout, InfoChip, SectionLabel } from '../components/ds';
import { BackButton, GhostButton, PrimaryButton } from '../components/ui';
import { useApp } from '../AppContext';
import { formatEventDate, getCleanupEvent, recordCheckIn, type CheckInState } from '../iteration2';
import { C } from '../theme';

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
  const nav = useNavigate();
  const { user } = useApp();
  const event = getCleanupEvent(eventId);
  const initial = user && event ? event.checkIns[user.participantId] ?? 'idle' : 'idle';
  const [state, setState] = useState<CheckInState>(initial);
  const [message, setMessage] = useState<string | null>(null);

  function checkIn() {
    if (!event || !user) return;
    if (!event.joinedBy.includes(user.participantId)) {
      setMessage('Join this activity before checking in.');
      return;
    }
    if (!navigator.geolocation) {
      setState('denied');
      setMessage('This device cannot provide a location. You can still add a report or cleanup, but attendance remains Not recorded.');
      return;
    }
    setState('checking');
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const beach = BEACH_COORDS[event.beachId];
        const current = { lat: position.coords.latitude, lng: position.coords.longitude };
        const result: CheckInState = beach && distanceKm(current, beach) <= 25 ? 'within_area' : 'outside_area';
        recordCheckIn(event.id, user.participantId, result);
        setState(result);
      },
      () => {
        recordCheckIn(event.id, user.participantId, 'denied');
        setState('denied');
        setMessage('Location was not available. Retry when you are ready; your exact coordinates are not stored.');
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  if (!event || !user) return null;
  const attendanceRecorded = event.attendanceBy.includes(user.participantId);

  return (
    <div className="screen scroll-y" style={{ zIndex: 26 }}>
      <div className="measure i2-page anim-fade-up" style={{ paddingBottom: 'calc(var(--safe-bottom) + 34px)' }}>
        <BackButton onClick={() => nav(`/events/${event.id}`)} />
        <div>
          <SectionLabel size="sm">CHECK IN</SectionLabel>
          <h1 className="i2-title" style={{ marginTop: 7 }}>{event.beachName} cleanup</h1>
          <p className="i2-subtitle">{formatEventDate(event.date)} · {event.startsAt}–{event.endsAt}</p>
        </div>

        <div className="i2-card" style={{ padding: 22, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, margin: '0 auto', borderRadius: 32, background: state === 'within_area' ? C.greenBg : 'rgba(11,33,97,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {state === 'within_area' ? <Check size={26} color={C.green} /> : <Pin size={27} color={C.navy} />}
          </div>
          <h2 style={{ margin: '16px 0 0', fontSize: 19, color: C.ink2 }}>
            {state === 'checking' ? 'Checking the broad beach area…' : state === 'within_area' ? 'Checked in' : state === 'outside_area' ? 'You appear to be outside the beach area' : 'Check in on the event day'}
          </h2>
          <p style={{ margin: '7px 0 0', color: C.muted, fontSize: 12.5, lineHeight: 1.55 }}>
            {state === 'within_area'
              ? `Within the ${event.beachName} area — exact GPS discarded.`
              : 'The app checks whether you are near the beach. Exact coordinates are never stored or shown publicly.'}
          </p>
        </div>

        <Callout title="Location privacy" icon={<Shield color={C.navy} />} tone="quiet">
          Location is requested only when you tap Check in — never on page load. A broad-area result is kept; the precise location is discarded.
        </Callout>

        {attendanceRecorded && (
          <Callout title="Attendance confirmed" icon={<Check color={C.green} />} tone="reassurance">
            Stored separately from your Join record.
          </Callout>
        )}

        <div className="i2-card">
          <SectionLabel size="sm">RECORDED ATTENDANCE NEEDS</SectionLabel>
          <div style={{ display: 'grid', gap: 8, marginTop: 11, fontSize: 12.5, color: C.slate }}>
            {[
              ['Logged in', true],
              ['Joined this event', event.joinedBy.includes(user.participantId)],
              ['Near the beach on the day', state === 'within_area'],
              ['Confirmed you were there', attendanceRecorded],
              ['Photo report or cleanup at this beach', attendanceRecorded],
            ].map(([label, done]) => (
              <div key={String(label)} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ color: done ? C.green : C.faint }}>{done ? '✓' : '○'}</span><span>{label}</span>
              </div>
            ))}
          </div>
          <InfoChip color={attendanceRecorded ? C.green : C.muted} background={attendanceRecorded ? C.greenBg : undefined} style={{ marginTop: 12 }}>
            {attendanceRecorded ? 'Recorded attendance' : 'Attendance not recorded'}
          </InfoChip>
        </div>

        {message && <Alert title="Check-in not completed" tone="caution">{message}</Alert>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {state === 'within_area' && !attendanceRecorded ? (
            <>
              <PrimaryButton onClick={() => nav(`/cleanup/${event.beachId}?event=${encodeURIComponent(event.id)}`)}>Add a Cleanup to complete attendance</PrimaryButton>
              <GhostButton onClick={() => nav(`/beach/${event.beachId}`)}>Report litter here instead</GhostButton>
            </>
          ) : state === 'within_area' ? (
            <PrimaryButton onClick={() => nav(`/events/${event.id}`)}>Back to event</PrimaryButton>
          ) : (
            <PrimaryButton onClick={checkIn} disabled={state === 'checking'}>{state === 'checking' ? 'Checking…' : state === 'idle' ? 'Check in — use my location now' : 'Retry check-in'}</PrimaryButton>
          )}
          <GhostButton onClick={() => nav(`/events/${event.id}`)}>Back to activity</GhostButton>
        </div>
        <p style={{ margin: 0, textAlign: 'center', color: C.dim, fontSize: 11 }}>Being nearby is not proof of a cleanup.</p>
      </div>
    </div>
  );
}
